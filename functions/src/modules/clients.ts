import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, auth, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return '+7' + digits.slice(1);
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return '+7' + digits;
  }
  return '+' + digits;
}

export const createClient = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const name = data.name;
  const phone = data.phone;
  if (!name) throw new HttpsError('invalid-argument', 'name is required');
  if (!phone) throw new HttpsError('invalid-argument', 'phone is required');

  const phoneNormalized = normalizePhone(phone);

  const indexRef = db.doc('tenants/' + tenantId + '/clientPhoneIndex/' + phoneNormalized);
  const existing = await indexRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'Client with this phone already exists');
  }

  const clientId = db.collection('tenants/' + tenantId + '/clients').doc().id;
  const batch = db.batch();

  batch.set(db.doc('tenants/' + tenantId + '/clients/' + clientId), {
    name,
    phoneNormalized,
    nameVariants: [],
    totalVisits: 0,
    totalSpentKzt: 0,
    noshowCount: 0,
    isBlocked: false,
    marketingOptOut: false,
    createdAt: FieldValue.serverTimestamp(),
    _schemaVersion: 4,
  });

  batch.set(indexRef, { clientId });
  await batch.commit();

  return { success: true, clientId };
});

export const updateClient = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const clientId = data.clientId;
  if (!clientId) throw new HttpsError('invalid-argument', 'clientId is required');

  const allowed = ['name', 'marketingOptOut', 'isBlocked'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  if (Object.keys(updates).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields to update');
  }

  await db.doc('tenants/' + tenantId + '/clients/' + clientId).update(updates);
  return { success: true };
});

export const blockClient = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const clientId = data.clientId;
  const blocked = data.blocked === true;
  if (!clientId) throw new HttpsError('invalid-argument', 'clientId is required');

  await db.doc('tenants/' + tenantId + '/clients/' + clientId).update({
    isBlocked: blocked,
  });

  return { success: true };
});

export const createAdmin = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  if (role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owner can create admins');
  }

  const data = request.data || {};
  const name = data.name;
  const email = data.email;
  const password = data.password;
  const phone = data.phone || '';

  if (!name) throw new HttpsError('invalid-argument', 'name is required');
  if (!email) throw new HttpsError('invalid-argument', 'email is required');
  if (!password) throw new HttpsError('invalid-argument', 'password is required');

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password });
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Email already registered');
    }
    throw new HttpsError('internal', error.message || 'Unknown error');
  }

  const uid = userRecord.uid;

  await db.doc('tenants/' + tenantId + '/users/' + uid).set({
    role: 'admin',
    name,
    phone,
    email,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await auth.setCustomUserClaims(uid, { tenantId, role: 'admin' });

  return { success: true, uid };
});

