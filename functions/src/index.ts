import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

setGlobalOptions({ region: 'asia-east1' });

// ============ helpers ============

function requireAuth(request: any) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const tenantId = request.auth.token.tenantId as string | undefined;
  const role = request.auth.token.role as string | undefined;
  if (!tenantId) {
    throw new HttpsError('permission-denied', 'No tenant assigned');
  }
  return { tenantId, role };
}

function requireOwnerOrAdmin(role: string | undefined) {
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only owner or admin allowed');
  }
}

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

  batch.set(db.doc('tenants/' + tenantId + '/config/info'), {
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

  batch.set(db.doc('tenants/' + tenantId + '/config/billingLimits'), {
    maxBranches: 1,
    maxMasters: 3,
    maxAppointmentsPerMonth: 500,
    messagesLimitThisMonth: 500,
    messagesUsedThisMonth: 0,
    isBlocked: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  batch.set(db.doc('tenants/' + tenantId + '/users/' + uid), {
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

export const updateSalonInfo = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const allowedFields = [
    'name', 'city', 'phone', 'whatsappBusinessNumber', 'logoUrl', 'dgisUrl',
    'cancellationWindowHours', 'reminderHours', 'noshowBlockThreshold',
    'requireConfirmation', 'pendingConfirmationTimeoutMinutes',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields to update');
  }

  updates['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
  await db.doc('tenants/' + tenantId + '/config/info').update(updates);

  return { success: true };
});

export const createBranch = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const name = data.name;
  if (!name) throw new HttpsError('invalid-argument', 'name is required');

  const branchId = db.collection('tenants/' + tenantId + '/branches').doc().id;
  const workingHours = data.workingHours || {
    mon: { open: 600, close: 1200 },
    tue: { open: 600, close: 1200 },
    wed: { open: 600, close: 1200 },
    thu: { open: 600, close: 1200 },
    fri: { open: 600, close: 1200 },
    sat: { open: 660, close: 1140 },
    sun: null,
  };

  await db.doc('tenants/' + tenantId + '/branches/' + branchId).set({
    name,
    address: data.address || '',
    city: data.city || '',
    phone: data.phone || '',
    workingHours,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, branchId };
});

export const updateBranch = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const branchId = data.branchId;
  if (!branchId) throw new HttpsError('invalid-argument', 'branchId is required');

  const allowedFields = ['name', 'address', 'city', 'phone', 'workingHours'];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields to update');
  }

  await db.doc('tenants/' + tenantId + '/branches/' + branchId).update(updates);
  return { success: true };
});

export const deactivateBranch = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const branchId = data.branchId;
  if (!branchId) throw new HttpsError('invalid-argument', 'branchId is required');

  await db.doc('tenants/' + tenantId + '/branches/' + branchId).update({
    isActive: false,
  });

  return { success: true };
});

// ============ createMaster ============

export const createMaster = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const name = data.name;
  const whatsappNumber = data.whatsappNumber;
  if (!name) throw new HttpsError('invalid-argument', 'name is required');
  if (!whatsappNumber) throw new HttpsError('invalid-argument', 'whatsappNumber is required');

  const masterId = db.collection('tenants/' + tenantId + '/masters').doc().id;

  const defaultSchedule = {
    mon: { isWorking: true, shifts: [{ start: 600, end: 1200, branchId: '' }] },
    tue: { isWorking: true, shifts: [{ start: 600, end: 1200, branchId: '' }] },
    wed: { isWorking: true, shifts: [{ start: 600, end: 1200, branchId: '' }] },
    thu: { isWorking: true, shifts: [{ start: 600, end: 1200, branchId: '' }] },
    fri: { isWorking: true, shifts: [{ start: 600, end: 1200, branchId: '' }] },
    sat: { isWorking: true, shifts: [{ start: 660, end: 1140, branchId: '' }] },
    sun: { isWorking: false, shifts: [] },
  };

  await db.doc('tenants/' + tenantId + '/masters/' + masterId).set({
    name,
    whatsappNumber,
    type: data.type || 'employee',
    photoUrl: data.photoUrl || '',
    primaryBranchId: data.primaryBranchId || '',
    workingBranchIds: [],
    serviceIds: [],
    color: data.color || '#4A90D9',
    schedule: defaultSchedule,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    _schemaVersion: 4,
  });

  return { success: true, masterId };
});

// ============ updateMaster ============

export const updateMaster = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const masterId = data.masterId;
  if (!masterId) throw new HttpsError('invalid-argument', 'masterId is required');

  const allowedFields = [
    'name', 'whatsappNumber', 'photoUrl', 'primaryBranchId',
    'color', 'serviceIds', 'schedule',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields to update');
  }

  await db.doc('tenants/' + tenantId + '/masters/' + masterId).update(updates);
  return { success: true };
});

// ============ deactivateMaster ============

export const deactivateMaster = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const masterId = data.masterId;
  if (!masterId) throw new HttpsError('invalid-argument', 'masterId is required');

  await db.doc('tenants/' + tenantId + '/masters/' + masterId).update({
    isActive: false,
  });

  return { success: true };
});
