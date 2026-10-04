import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, auth, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';

export const helloWorld = onCall({ invoker: 'public' }, () => {
  return { message: 'Hello from Barber CRM Functions' };
});

export const registerSalon = onCall({ invoker: 'public' }, async (request) => {
  const data = request.data || {};
  const salonName = data.salonName;
  const email = data.email;
  const password = data.password;

  if (!salonName) throw new HttpsError('invalid-argument', 'salonName is required');
  if (!email) throw new HttpsError('invalid-argument', 'email is required');
  if (!password) throw new HttpsError('invalid-argument', 'password is required');

  let userRecord: Awaited<ReturnType<typeof auth.createUser>>;
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

  batch.set(db.doc('tenants/' + tenantId + '/config/info'), {
    name: salonName,
    widgetSlug: '',
    city: '',
    timezone: 'Asia/Almaty',
    phone: '',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    _schemaVersion: 4,
  });

  batch.set(db.doc('tenants/' + tenantId + '/config/privateConfig'), {
    cancellationWindowHours: 3,
    reminderHours: [3],
    noshowBlockThreshold: 3,
    requireConfirmation: false,
    pendingConfirmationTimeoutMinutes: 30,
    createdAt: FieldValue.serverTimestamp(),
    _schemaVersion: 4,
  });

  batch.set(db.doc('tenants/' + tenantId + '/config/billingLimits'), {
    maxBranches: 1,
    maxMasters: 3,
    maxAppointmentsPerMonth: 500,
    messagesLimitThisMonth: 500,
    messagesUsedThisMonth: 0,
    isBlocked: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(db.doc('tenants/' + tenantId + '/users/' + uid), {
    role: 'owner',
    name: '',
    phone: '',
    email: email,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    await batch.commit();
    await auth.setCustomUserClaims(uid, { tenantId: tenantId, role: 'owner' });
  } catch (err) {
    try {
      await auth.deleteUser(uid);
    } catch {
      /* ignore rollback failure */
    }
    throw new HttpsError('internal', 'Registration failed, please try again');
  }

  return { success: true, tenantId: tenantId, uid: uid };
});

export const updateSalonInfo = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const publicFields = [
    'name', 'city', 'phone', 'whatsappBusinessNumber', 'logoUrl', 'dgisUrl',
  ];
  const privateFields = [
    'cancellationWindowHours', 'reminderHours', 'noshowBlockThreshold',
    'requireConfirmation', 'pendingConfirmationTimeoutMinutes',
  ];

  const publicUpdates: Record<string, unknown> = {};
  const privateUpdates: Record<string, unknown> = {};
  for (const key of publicFields) {
    if (data[key] !== undefined) publicUpdates[key] = data[key];
  }
  for (const key of privateFields) {
    if (data[key] !== undefined) privateUpdates[key] = data[key];
  }

  if (Object.keys(publicUpdates).length === 0 && Object.keys(privateUpdates).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields to update');
  }

  const ts = FieldValue.serverTimestamp();
  if (Object.keys(publicUpdates).length > 0) {
    publicUpdates['updatedAt'] = ts;
    await db.doc('tenants/' + tenantId + '/config/info').update(publicUpdates);
  }
  if (Object.keys(privateUpdates).length > 0) {
    privateUpdates['updatedAt'] = ts;
    await db.doc('tenants/' + tenantId + '/config/privateConfig').update(privateUpdates);
  }

  return { success: true };
});


