import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';
import { generateToken, hashToken, tokenExpiresAt, findMasterByToken } from '../common/masterToken';

// ============ generateMasterToken ============

export const generateMasterToken = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const masterId = data.masterId;
  if (!masterId) {
    throw new HttpsError('invalid-argument', 'masterId is required');
  }

  const masterRef = db.doc('tenants/' + tenantId + '/masters/' + masterId);
  const masterSnap = await masterRef.get();
  if (!masterSnap.exists) {
    throw new HttpsError('not-found', 'Master not found');
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = tokenExpiresAt();

  await masterRef.update({
    accessToken: FieldValue.delete(),
    accessTokenHash: tokenHash,
    accessTokenExpiresAt: expiresAt,
    accessTokenLastUsedAt: null,
    accessTokenGeneratedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, token, expiresAt: expiresAt.toMillis() };
});

// ============ getMasterSchedule (public, by token) ============

export const getMasterSchedule = onCall(
  { invoker: 'public' },
  async (request) => {
    const data = request.data || {};
    const token = data.token;
    const dateFrom = data.dateFrom;
    const dateTo = data.dateTo;

    if (!token || typeof token !== 'string') {
      throw new HttpsError('invalid-argument', 'token is required');
    }
    if (!dateFrom || !dateTo) {
      throw new HttpsError('invalid-argument', 'dateFrom and dateTo required');
    }

    const found = await findMasterByToken(token);
    if (!found) {
      throw new HttpsError('not-found', 'Invalid or expired token');
    }

    const { masterId, tenantId, data: master } = found;

    if (!master.isActive) {
      throw new HttpsError('permission-denied', 'Master is not active');
    }

    const apptsSnap = await db
      .collection('tenants/' + tenantId + '/appointments')
      .where('masterId', '==', masterId)
      .where('date', '>=', dateFrom)
      .where('date', '<=', dateTo)
      .get();

    const appointments = apptsSnap.docs
      .map((d) => {
        const a = d.data();
        return {
          id: d.id,
          date: a.date,
          startMinutes: a.startMinutes,
          endMinutes: a.endMinutes,
          clientName: a.clientName,
          serviceNames: a.serviceNames,
          status: a.status,
        };
      })
      .filter((a) => a.status !== 'cancelled');

    appointments.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return a.startMinutes - b.startMinutes;
    });

    return {
      success: true,
      masterName: master.name,
      masterPhotoUrl: master.photoUrl || '',
      masterRating: master.rating || 0,
      masterRatingCount: master.ratingCount || 0,
      appointments,
    };
  }
);

// ============ submitReview (public) ============

export const submitReview = onCall(
  { invoker: 'public' },
  async (request) => {
    const data = request.data || {};
    const appointmentId = data.appointmentId;
    const rating = Number(data.rating);
    const token = data.token;

    if (!appointmentId) throw new HttpsError('invalid-argument', 'appointmentId required');
    if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'token required');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpsError('invalid-argument', 'rating must be 1-5');
    }

    const apptSnap = await db
      .collectionGroup('appointments')
      .where('reviewToken', '==', token)
      .limit(1)
      .get();

    if (apptSnap.empty) throw new HttpsError('not-found', 'Invalid token');

    const apptDoc = apptSnap.docs[0];
    const appt = apptDoc.data();

    if (apptDoc.id !== appointmentId) throw new HttpsError('invalid-argument', 'mismatch');
    if (appt.status !== 'completed') throw new HttpsError('failed-precondition', 'not completed');
    if (appt.reviewSubmitted === true) throw new HttpsError('already-exists', 'already reviewed');

    const completedAt = appt.completedAt;
    if (completedAt && completedAt.toDate) {
      const daysSince = (Date.now() - completedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 30) throw new HttpsError('failed-precondition', 'Review window expired');
    }

    const pathParts = apptDoc.ref.path.split('/');
    const tenantId = pathParts[1];
    const masterId = appt.masterId as string;

    const reviewRef = db.collection('tenants/' + tenantId + '/reviews').doc();
    await reviewRef.set({
      appointmentId: apptDoc.id,
      masterId,
      clientId: appt.clientId,
      rating,
      createdAt: FieldValue.serverTimestamp(),
    });

    await apptDoc.ref.update({ reviewSubmitted: true, reviewRating: rating });

    const reviewsSnap = await db
      .collection('tenants/' + tenantId + '/reviews')
      .where('masterId', '==', masterId)
      .get();

    let sum = 0;
    let count = 0;
    reviewsSnap.forEach((review) => {
      sum += (review.data().rating as number) || 0;
      count += 1;
    });
    const avg = count > 0 ? sum / count : 0;

    await db.doc('tenants/' + tenantId + '/masters/' + masterId).update({
      rating: Math.round(avg * 10) / 10,
      ratingCount: count,
    });

    return { success: true, rating, avg: Math.round(avg * 10) / 10, count };
  }
);
