import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

setGlobalOptions({ region: 'asia-east1' });

export const helloWorld = onCall(() => {
  return { message: 'Hello from Barber CRM Functions' };
});

export const registerSalon = onCall(async (request) => {
  const data = request.data || {};
  const salonName = data.salonName;
  const email = data.email;
  const password = data.password;

  if (!salonName) {
    throw new HttpsError('invalid-argument', 'salonName is required');
  }
  if (!email) {
    throw new HttpsError('invalid-argument', 'email is required');
  }
  if (!password) {
    throw new HttpsError('invalid-argument', 'password is required');
  }

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
  const tenantId = db.collection('tenants').doc().id;

  const batch = db.batch();

  const infoPath = 'tenants/' + tenantId + '/config/info';
  batch.set(db.doc(infoPath), {
    name: salonName,
    widgetSlug: '',
    city: '',
    timezone: 'Asia/Almaty',
    phone: '',
    cancellationWindowHours: 3,
    reminderHours: [3],
    noshowBlockThreshold: 3,
    requireConfirmation: false,
    pendingConfirmationTimeoutMinutes: 30,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    _schemaVersion: 4,
  });

  const limitsPath = 'tenants/' + tenantId + '/config/billingLimits';
  batch.set(db.doc(limitsPath), {
    maxBranches: 1,
    maxMasters: 3,
    maxAppointmentsPerMonth: 500,
    messagesLimitThisMonth: 500,
    messagesUsedThisMonth: 0,
    isBlocked: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const userPath = 'tenants/' + tenantId + '/users/' + uid;
  batch.set(db.doc(userPath), {
    role: 'owner',
    name: '',
    phone: '',
    email: email,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  await auth.setCustomUserClaims(uid, { tenantId: tenantId, role: 'owner' });

  return { success: true, tenantId: tenantId, uid: uid };
});
