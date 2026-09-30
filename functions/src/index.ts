import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFunctions } from 'firebase-admin/functions';
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

export const activateBranch = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const branchId = data.branchId;
  if (!branchId) throw new HttpsError('invalid-argument', 'branchId is required');

  await db.doc('tenants/' + tenantId + '/branches/' + branchId).update({
    isActive: true,
  });

  return { success: true };
});

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

  if (updates.schedule) {
    const schedule = updates.schedule as Record<string, { isWorking: boolean; shifts: Array<{ branchId?: string }> }>;
    const branchSet = new Set<string>();
    for (const day of Object.values(schedule)) {
      if (day.isWorking && day.shifts) {
        for (const shift of day.shifts) {
          if (shift.branchId) branchSet.add(shift.branchId);
        }
      }
    }
    updates.workingBranchIds = Array.from(branchSet);
  }

  await db.doc('tenants/' + tenantId + '/masters/' + masterId).update(updates);
  return { success: true };
});

export const updateMasterCompensation = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  if (role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owner allowed');
  }

  const data = request.data || {};
  const masterId = data.masterId;
  const type = data.type;

  if (!masterId) {
    throw new HttpsError('invalid-argument', 'masterId is required');
  }

  if (type !== 'employee' && type !== 'renter') {
    throw new HttpsError('invalid-argument', 'type must be employee or renter');
  }

  const masterRef = db.doc('tenants/' + tenantId + '/masters/' + masterId);
  const masterSnap = await masterRef.get();

  if (!masterSnap.exists) {
    throw new HttpsError('not-found', 'Master not found');
  }

  function numberValue(value: unknown, fieldName: string, max?: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new HttpsError('invalid-argument', fieldName + ' must be a non-negative number');
    }
    if (max !== undefined && value > max) {
      throw new HttpsError('invalid-argument', fieldName + ' is out of range');
    }
    return value;
  }

  let compensation: Record<string, unknown>;

  if (type === 'employee') {
    compensation = {
      type: 'employee',
      baseSalaryKzt: numberValue(data.baseSalaryKzt, 'baseSalaryKzt'),
      commissionPercent: numberValue(data.commissionPercent, 'commissionPercent', 100),
      bonusKzt: numberValue(data.bonusKzt, 'bonusKzt'),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  } else {
    const rentType = data.rentType;

    if (rentType !== 'fixed' && rentType !== 'percentage') {
      throw new HttpsError('invalid-argument', 'rentType must be fixed or percentage');
    }

    if (rentType === 'fixed') {
      compensation = {
        type: 'renter',
        rentType: 'fixed',
        fixedAmountKzt: numberValue(data.fixedAmountKzt, 'fixedAmountKzt'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    } else {
      compensation = {
        type: 'renter',
        rentType: 'percentage',
        percentageOfRevenue: numberValue(
          data.percentageOfRevenue,
          'percentageOfRevenue',
          100,
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }
  }

  await masterRef.collection('private').doc('compensation').set(compensation, {
    merge: true,
  });

  return { success: true };
});

export const getMasterCompensation = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);

  if (role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owner allowed');
  }

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

  const compensationSnap = await masterRef
    .collection('private')
    .doc('compensation')
    .get();

  if (!compensationSnap.exists) {
    return {
      exists: false,
      compensation: null,
    };
  }

  return {
    exists: true,
    compensation: compensationSnap.data() || null,
  };
});

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

export const activateMaster = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const masterId = data.masterId;
  if (!masterId) throw new HttpsError('invalid-argument', 'masterId is required');

  await db.doc('tenants/' + tenantId + '/masters/' + masterId).update({
    isActive: true,
  });

  return { success: true };
});

export const deleteService = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const serviceId = data.serviceId;
  if (!serviceId) throw new HttpsError('invalid-argument', 'serviceId is required');

  const serviceRef = db.doc('tenants/' + tenantId + '/services/' + serviceId);
  const serviceSnap = await serviceRef.get();
  if (!serviceSnap.exists) throw new HttpsError('not-found', 'Service not found');

  const mastersSnap = await db
    .collection('tenants/' + tenantId + '/masters')
    .where('serviceIds', 'array-contains', serviceId)
    .get();

  const batch = db.batch();
  mastersSnap.forEach((m) => {
    batch.update(m.ref, {
      serviceIds: admin.firestore.FieldValue.arrayRemove(serviceId),
    });
  });
  batch.delete(serviceRef);
  await batch.commit();

  return { success: true };
});

export const deleteCategory = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const categoryId = data.categoryId;
  if (!categoryId) throw new HttpsError('invalid-argument', 'categoryId is required');

  const servicesSnap = await db
    .collection('tenants/' + tenantId + '/services')
    .where('categoryId', '==', categoryId)
    .limit(1)
    .get();

  if (!servicesSnap.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Сначала удалите все услуги в этой категории',
    );
  }

  await db.doc('tenants/' + tenantId + '/categories/' + categoryId).delete();

  return { success: true };
});

export const updateCategory = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const categoryId = data.categoryId;
  const name = data.name;

  if (!categoryId) throw new HttpsError('invalid-argument', 'categoryId is required');
  if (!name) throw new HttpsError('invalid-argument', 'name is required');

  const allowed = [
    'name',
    'iconUrl',
    'iconPositionX',
    'iconPositionY',
    'iconScale',
  ];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (updates.name !== undefined) {
    if (
      typeof updates.name !== 'string' ||
      updates.name.trim().length === 0 ||
      updates.name.trim().length > 100
    ) {
      throw new HttpsError('invalid-argument', 'name is empty or too long');
    }
    updates.name = updates.name.trim();
  }

  if (updates.iconUrl !== undefined && typeof updates.iconUrl !== 'string') {
    throw new HttpsError('invalid-argument', 'iconUrl must be a string');
  }

  if (updates.iconPositionX !== undefined) {
    const value = Number(updates.iconPositionX);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new HttpsError('invalid-argument', 'iconPositionX must be between 0 and 100');
    }
    updates.iconPositionX = value;
  }

  if (updates.iconPositionY !== undefined) {
    const value = Number(updates.iconPositionY);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new HttpsError('invalid-argument', 'iconPositionY must be between 0 and 100');
    }
    updates.iconPositionY = value;
  }

  if (updates.iconScale !== undefined) {
    const value = Number(updates.iconScale);
    if (!Number.isFinite(value) || value < 1 || value > 3) {
      throw new HttpsError('invalid-argument', 'iconScale must be between 1 and 3');
    }
    updates.iconScale = value;
  }

  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await db.doc('tenants/' + tenantId + '/categories/' + categoryId).update(updates);

  const servicesSnap = await db
    .collection('tenants/' + tenantId + '/services')
    .where('categoryId', '==', categoryId)
    .get();

  if (!servicesSnap.empty && updates.name !== undefined) {
    const batch = db.batch();
    servicesSnap.forEach((doc) => {
      batch.update(doc.ref, { categoryName: updates.name });
    });
    await batch.commit();
  }

  return { success: true };
});

export const deactivateCategory = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const categoryId = data.categoryId;
  if (!categoryId) throw new HttpsError('invalid-argument', 'categoryId is required');

  const servicesSnap = await db
    .collection('tenants/' + tenantId + '/services')
    .where('categoryId', '==', categoryId)
    .where('isActive', '==', true)
    .get();

  if (!servicesSnap.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Сначала деактивируйте услуги в этой категории',
    );
  }

  await db.doc('tenants/' + tenantId + '/categories/' + categoryId).update({
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const activateCategory = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const categoryId = data.categoryId;
  if (!categoryId) throw new HttpsError('invalid-argument', 'categoryId is required');

  await db.doc('tenants/' + tenantId + '/categories/' + categoryId).update({
    isActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const createCategory = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const name = data.name;
  if (!name) throw new HttpsError('invalid-argument', 'name is required');

  const categoryId = db.collection('tenants/' + tenantId + '/categories').doc().id;
  await db.doc('tenants/' + tenantId + '/categories/' + categoryId).set({
    name,
    order: data.order || 0,
    iconUrl: '',
    iconPositionX: 50,
    iconPositionY: 50,
    iconScale: 1,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, categoryId };
});

export const createService = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const name = data.name;
  const categoryId = data.categoryId;
  const durationMinutes = data.durationMinutes;
  const priceKzt = data.priceKzt;

  if (!name) throw new HttpsError('invalid-argument', 'name is required');
  if (!categoryId) throw new HttpsError('invalid-argument', 'categoryId is required');
  if (!durationMinutes) throw new HttpsError('invalid-argument', 'durationMinutes is required');
  if (priceKzt === undefined) throw new HttpsError('invalid-argument', 'priceKzt is required');

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    throw new HttpsError('invalid-argument', 'name is empty or too long');
  }
  const durationNum = Number(durationMinutes);
  if (!Number.isInteger(durationNum) || durationNum <= 0) {
    throw new HttpsError('invalid-argument', 'durationMinutes must be a positive integer');
  }
  if (durationNum > 480) {
    throw new HttpsError('invalid-argument', 'durationMinutes exceeds maximum 480');
  }
  const bufferNum = Number(data.bufferMinutes || 0);
  if (!Number.isInteger(bufferNum) || bufferNum < 0) {
    throw new HttpsError('invalid-argument', 'bufferMinutes must be a non-negative integer');
  }
  if (bufferNum > 120) {
    throw new HttpsError('invalid-argument', 'bufferMinutes exceeds maximum 120');
  }
  const priceNum = Number(priceKzt);
  if (!Number.isInteger(priceNum) || priceNum < 0) {
    throw new HttpsError('invalid-argument', 'priceKzt must be a non-negative integer');
  }
  if (priceNum > 10000000) {
    throw new HttpsError('invalid-argument', 'priceKzt exceeds maximum 10000000');
  }

  const catSnap = await db.doc('tenants/' + tenantId + '/categories/' + categoryId).get();
  if (!catSnap.exists) throw new HttpsError('not-found', 'Category not found');
  const categoryName = catSnap.data()!.name as string;

  const serviceId = db.collection('tenants/' + tenantId + '/services').doc().id;
  await db.doc('tenants/' + tenantId + '/services/' + serviceId).set({
    name: name.trim(),
    categoryId,
    categoryName,
    durationMinutes: durationNum,
    bufferMinutes: bufferNum,
    priceKzt: priceNum,
    order: Number(data.order || 0),
    iconUrl: '',
    iconPositionX: 50,
    iconPositionY: 50,
    iconScale: 1,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, serviceId };
});

export const updateService = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const serviceId = data.serviceId;
  if (!serviceId) throw new HttpsError('invalid-argument', 'serviceId is required');

  const allowed = [
    'name',
    'durationMinutes',
    'bufferMinutes',
    'priceKzt',
    'order',
    'iconUrl',
    'iconPositionX',
    'iconPositionY',
    'iconScale',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  if (Object.keys(updates).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields to update');
  }

  if (updates.name !== undefined) {
    if (
      typeof updates.name !== 'string' ||
      updates.name.trim().length === 0 ||
      updates.name.trim().length > 100
    ) {
      throw new HttpsError('invalid-argument', 'name is empty or too long');
    }
    updates.name = updates.name.trim();
  }
  if (updates.durationMinutes !== undefined) {
    const durationNum = Number(updates.durationMinutes);
    if (!Number.isInteger(durationNum) || durationNum <= 0) {
      throw new HttpsError('invalid-argument', 'durationMinutes must be a positive integer');
    }
    if (durationNum > 480) {
      throw new HttpsError('invalid-argument', 'durationMinutes exceeds maximum 480');
    }
    updates.durationMinutes = durationNum;
  }
  if (updates.bufferMinutes !== undefined) {
    const bufferNum = Number(updates.bufferMinutes);
    if (!Number.isInteger(bufferNum) || bufferNum < 0) {
      throw new HttpsError('invalid-argument', 'bufferMinutes must be a non-negative integer');
    }
    if (bufferNum > 120) {
      throw new HttpsError('invalid-argument', 'bufferMinutes exceeds maximum 120');
    }
    updates.bufferMinutes = bufferNum;
  }
  if (updates.priceKzt !== undefined) {
    const priceNum = Number(updates.priceKzt);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      throw new HttpsError('invalid-argument', 'priceKzt must be a non-negative integer');
    }
    if (priceNum > 10000000) {
      throw new HttpsError('invalid-argument', 'priceKzt exceeds maximum 10000000');
    }
    updates.priceKzt = priceNum;
  }
  if (updates.order !== undefined) {
    updates.order = Number(updates.order);
  }
  if (updates.iconUrl !== undefined && typeof updates.iconUrl !== 'string') {
    throw new HttpsError('invalid-argument', 'iconUrl must be a string');
  }
  if (updates.iconPositionX !== undefined) {
    const value = Number(updates.iconPositionX);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new HttpsError('invalid-argument', 'iconPositionX must be between 0 and 100');
    }
    updates.iconPositionX = value;
  }
  if (updates.iconPositionY !== undefined) {
    const value = Number(updates.iconPositionY);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new HttpsError('invalid-argument', 'iconPositionY must be between 0 and 100');
    }
    updates.iconPositionY = value;
  }
  if (updates.iconScale !== undefined) {
    const value = Number(updates.iconScale);
    if (!Number.isFinite(value) || value < 1 || value > 3) {
      throw new HttpsError('invalid-argument', 'iconScale must be between 1 and 3');
    }
    updates.iconScale = value;
  }

  await db.doc('tenants/' + tenantId + '/services/' + serviceId).update(updates);
  return { success: true };
});

export const deactivateService = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const serviceId = data.serviceId;
  if (!serviceId) throw new HttpsError('invalid-argument', 'serviceId is required');

  await db.doc('tenants/' + tenantId + '/services/' + serviceId).update({
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const activateService = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const serviceId = data.serviceId;
  if (!serviceId) throw new HttpsError('invalid-argument', 'serviceId is required');

  await db.doc('tenants/' + tenantId + '/services/' + serviceId).update({
    isActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await auth.setCustomUserClaims(uid, { tenantId, role: 'admin' });

  return { success: true, uid };
});

// ============ helpers for slots ============

function timeToMinutes(t: string): number {
  const parts = t.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function dayOfWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[d.getUTCDay()];
}

function validateWidgetSlug(slug: unknown): asserts slug is string {
  if (typeof slug !== 'string' || !slug.trim()) {
    throw new HttpsError('invalid-argument', 'slug required');
  }
}

async function getWidgetTenantId(slug: string): Promise<string> {
  const slugSnap = await db.doc('slugRegistry/' + slug).get();
  if (!slugSnap.exists) throw new HttpsError('not-found', 'Salon not found');
  const slugData = slugSnap.data()!;
  if (slugData.isDeleted === true) throw new HttpsError('not-found', 'Salon not found');
  if (slugData.isAlias === true) {
    throw new HttpsError('failed-precondition', 'Salon slug has changed', {
      newSlug: slugData.redirectsTo || '',
    });
  }
  const tenantId = slugData.tenantId;
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new HttpsError('not-found', 'Salon not found');
  }
  return tenantId;
}

// ============ widgetGetSalon (public) ============

export const widgetGetSalon = onCall({ invoker: 'public' }, async (request) => {
  const slug = (request.data || {}).slug;
  validateWidgetSlug(slug);

  const slugSnap = await db.doc('slugRegistry/' + slug).get();
  if (!slugSnap.exists) return { status: 'not_found' };
  const slugData = slugSnap.data()!;
  if (slugData.isDeleted === true) return { status: 'gone' };
  if (slugData.isAlias === true && slugData.redirectsTo) {
    return { status: 'redirect', newSlug: slugData.redirectsTo };
  }

  const tenantId = slugData.tenantId as string;
  if (!tenantId) return { status: 'not_found' };

  const [infoSnap, branchesSnap, categoriesSnap, servicesSnap, mastersSnap] =
    await Promise.all([
      db.doc('tenants/' + tenantId + '/config/info').get(),
      db.collection('tenants/' + tenantId + '/branches').get(),
      db.collection('tenants/' + tenantId + '/categories').get(),
      db.collection('tenants/' + tenantId + '/services').get(),
      db.collection('tenants/' + tenantId + '/masters').get(),
    ]);

  if (!infoSnap.exists) return { status: 'not_found' };
  const info = infoSnap.data()!;

  const branches = branchesSnap.docs
    .filter((d) => d.data().isActive === true)
    .map((d) => ({
      id: d.id,
      name: d.data().name,
      address: d.data().address || '',
      city: d.data().city || '',
    }));

  const categories = categoriesSnap.docs
    .filter((d) => d.data().isActive === true)
    .map((d) => ({
      id: d.id,
      name: d.data().name,
      order: d.data().order || 0,
      iconUrl: d.data().iconUrl || '',
      iconPositionX: Number.isFinite(Number(d.data().iconPositionX))
        ? Number(d.data().iconPositionX)
        : 50,
      iconPositionY: Number.isFinite(Number(d.data().iconPositionY))
        ? Number(d.data().iconPositionY)
        : 50,
      iconScale: Number.isFinite(Number(d.data().iconScale))
        ? Number(d.data().iconScale)
        : 1,
    }))
    .sort((a, b) => a.order - b.order);

  const services = servicesSnap.docs
    .filter((d) => d.data().isActive === true)
    .map((d) => ({
      id: d.id,
      name: d.data().name,
      categoryId: d.data().categoryId,
      durationMinutes: d.data().durationMinutes,
      bufferMinutes: d.data().bufferMinutes || 0,
      priceKzt: d.data().priceKzt,
      iconUrl: d.data().iconUrl || '',
      iconPositionX: Number.isFinite(Number(d.data().iconPositionX))
        ? Number(d.data().iconPositionX)
        : 50,
      iconPositionY: Number.isFinite(Number(d.data().iconPositionY))
        ? Number(d.data().iconPositionY)
        : 50,
      iconScale: Number.isFinite(Number(d.data().iconScale))
        ? Number(d.data().iconScale)
        : 1,
    }));

  const masters = mastersSnap.docs
    .filter((d) => d.data().isActive === true)
    .map((d) => ({
      id: d.id,
      name: d.data().name,
      photoUrl: d.data().photoUrl || '',
      rating: d.data().rating || 0,
      ratingCount: d.data().ratingCount || 0,
      serviceIds: d.data().serviceIds || [],
      primaryBranchId: d.data().primaryBranchId || '',
    }));

  return {
    status: 'ok',
    tenant: {
      name: info.name,
      city: info.city,
      phone: info.phone,
      logoUrl: info.logoUrl || '',
      cancellationWindowHours: info.cancellationWindowHours || 3,
    },
    branches,
    categories,
    services,
    masters,
  };
});

// ============ widgetGetSlots (public) ============

export const widgetGetSlots = onCall({ invoker: 'public' }, async (request) => {
  const data = request.data || {};
  const slug = data.slug;
  const masterId = data.masterId;
  const date = data.date;
  const durationMinutes = Number(data.durationMinutes || 0);

  validateWidgetSlug(slug);
  if (typeof masterId !== 'string' || !masterId) {
    throw new HttpsError('invalid-argument', 'masterId required');
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z'))) {
    throw new HttpsError('invalid-argument', 'date required');
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new HttpsError('invalid-argument', 'durationMinutes required');
  }

  const tenantId = await getWidgetTenantId(slug);
  const masterSnap = await db.doc('tenants/' + tenantId + '/masters/' + masterId).get();
  if (!masterSnap.exists) throw new HttpsError('not-found', 'Master not found');
  const master = masterSnap.data()!;
  if (!master.isActive) return { slots: [] };

  const weekday = dayOfWeekKey(date);
  const daySchedule = master.schedule?.[weekday];
  if (!daySchedule || !daySchedule.isWorking) return { slots: [] };
  const shifts: Array<{ start: number; end: number }> = daySchedule.shifts || [];
  if (shifts.length === 0) return { slots: [] };

  const ledgerSnap = await db.doc('tenants/' + tenantId + '/ledger/' + masterId + '_' + date).get();
  const bookedSlots: Array<{ start: number; end: number }> = ledgerSnap.exists
    ? (ledgerSnap.data()!.slots || [])
    : [];
  const slots: Array<{ start: number; end: number; time: string }> = [];
  for (const shift of shifts) {
    let cursor = shift.start;
    while (cursor + durationMinutes <= shift.end) {
      const slotEnd = cursor + durationMinutes;
      const overlaps = bookedSlots.some((b) => !(slotEnd <= b.start || cursor >= b.end));
      if (!overlaps) {
        const h = Math.floor(cursor / 60);
        const m = cursor % 60;
        slots.push({
          start: cursor,
          end: slotEnd,
          time: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'),
        });
      }
      cursor += 15;
    }
  }
  return { slots };
});

// ============ widgetCreateAppointment (public) ============

export const widgetCreateAppointment = onCall({ invoker: 'public' }, async (request) => {
  const data = request.data || {};
  const slug = data.slug;
  const masterId = data.masterId;
  const serviceIds: string[] = Array.isArray(data.serviceIds) ? data.serviceIds : [];
  const date = data.date;
  const startMinutes = Number(data.startMinutes);
  const clientName = typeof data.clientName === 'string' ? data.clientName.trim() : '';
  const clientPhone = typeof data.clientPhone === 'string' ? data.clientPhone.trim() : '';
  const consent = data.consent === true;

  validateWidgetSlug(slug);
  if (typeof masterId !== 'string' || !masterId) throw new HttpsError('invalid-argument', 'masterId required');
  if (!serviceIds.length || serviceIds.some((id) => typeof id !== 'string' || !id)) {
    throw new HttpsError('invalid-argument', 'serviceIds required');
  }
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new HttpsError('invalid-argument', 'serviceIds must be unique');
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z'))) {
    throw new HttpsError('invalid-argument', 'date required');
  }
  if (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes >= 1440) {
    throw new HttpsError('invalid-argument', 'startMinutes required');
  }
  if (!clientName) throw new HttpsError('invalid-argument', 'clientName required');
  if (!clientPhone) throw new HttpsError('invalid-argument', 'clientPhone required');
  if (!consent) throw new HttpsError('invalid-argument', 'consent required');

  const tenantId = await getWidgetTenantId(slug);
  const serviceSnaps = await Promise.all(
    serviceIds.map((id) => db.doc('tenants/' + tenantId + '/services/' + id).get())
  );
  if (serviceSnaps.some((s) => !s.exists)) throw new HttpsError('not-found', 'Service not found');
  const services = serviceSnaps.map((s) => s.data()!);
  if (services.some((s) => s.isActive !== true)) {
    throw new HttpsError('failed-precondition', 'Service not active');
  }
  const totalDuration = services.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
  const totalPrice = services.reduce((sum, s) => sum + Number(s.priceKzt || 0), 0);
  const bufferMinutes = Math.max(...services.map((s) => Number(s.bufferMinutes || 0)));
  if (!Number.isFinite(totalDuration) || totalDuration <= 0 || !Number.isFinite(bufferMinutes)) {
    throw new HttpsError('failed-precondition', 'Invalid service duration');
  }
  const serviceNames = services.map((s) => s.name as string);
  const endMinutes = startMinutes + totalDuration;
  const ledgerEndMinutes = endMinutes + bufferMinutes;

  const masterSnap = await db.doc('tenants/' + tenantId + '/masters/' + masterId).get();
  if (!masterSnap.exists) throw new HttpsError('not-found', 'Master not found');
  const master = masterSnap.data()!;
  if (!master.isActive) throw new HttpsError('failed-precondition', 'Master not active');
  const weekday = dayOfWeekKey(date);
  const daySchedule = master.schedule?.[weekday];
  if (!daySchedule || !daySchedule.isWorking) throw new HttpsError('failed-precondition', 'Not working');
  const shift = (daySchedule.shifts || []).find(
    (s: { start: number; end: number }) => startMinutes >= s.start && endMinutes <= s.end
  );
  if (!shift) throw new HttpsError('failed-precondition', 'Outside hours');
  const branchId = shift.branchId || '';

  const digits = clientPhone.replace(/\D/g, '');
  const phoneNormalized = digits.length === 11 && digits.startsWith('8')
    ? '+7' + digits.slice(1)
    : digits.length === 11 && digits.startsWith('7')
      ? '+' + digits
      : digits.length === 10
        ? '+7' + digits
        : '+' + digits;
  if (digits.length < 10 || digits.length > 15) {
    throw new HttpsError('invalid-argument', 'Invalid clientPhone');
  }

  const phoneIdxRef = db.doc('tenants/' + tenantId + '/clientPhoneIndex/' + phoneNormalized);
  const phoneIdxSnap = await phoneIdxRef.get();
  let clientId: string;
  let clientData: { name: string; phoneNormalized: string };
  if (phoneIdxSnap.exists) {
    clientId = phoneIdxSnap.data()!.clientId as string;
    const clientRef = db.doc('tenants/' + tenantId + '/clients/' + clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) throw new HttpsError('internal', 'Client index is invalid');
    const existingClient = clientSnap.data()!;
    clientData = { name: existingClient.name, phoneNormalized: existingClient.phoneNormalized };
    if (existingClient.name !== clientName && !(existingClient.nameVariants || []).includes(clientName)) {
      await clientRef.update({ nameVariants: admin.firestore.FieldValue.arrayUnion(clientName) });
    }
  } else {
    const newClientRef = db.collection('tenants/' + tenantId + '/clients').doc();
    clientId = newClientRef.id;
    const batch = db.batch();
    batch.set(newClientRef, {
      name: clientName,
      phoneNormalized,
      nameVariants: [],
      totalVisits: 0,
      totalSpentKzt: 0,
      noshowCount: 0,
      isBlocked: false,
      marketingOptOut: false,
      consentGivenAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _schemaVersion: 4,
    });
    batch.set(phoneIdxRef, { clientId });
    await batch.commit();
    clientData = { name: clientName, phoneNormalized };
  }

  const blockedSnap = await db.doc('tenants/' + tenantId + '/clients/' + clientId).get();
  if (blockedSnap.data()?.isBlocked === true) {
    throw new HttpsError('permission-denied', 'Client is blocked');
  }

  const ledgerRef = db.doc('tenants/' + tenantId + '/ledger/' + masterId + '_' + date);
  const appointmentRef = db.collection('tenants/' + tenantId + '/appointments').doc();
  await db.runTransaction(async (tx) => {
    const ledgerTx = await tx.get(ledgerRef);
    const existingSlots: Array<{ start: number; end: number }> = ledgerTx.exists
      ? (ledgerTx.data()!.slots || [])
      : [];
    const conflict = existingSlots.some((s) => !(ledgerEndMinutes <= s.start || startMinutes >= s.end));
    if (conflict) throw new HttpsError('aborted', 'slot_taken');

    tx.set(appointmentRef, {
      branchId,
      masterId,
      masterName: master.name,
      clientId,
      clientName: clientData.name,
      clientPhone: clientData.phoneNormalized,
      serviceIds,
      serviceNames,
      date,
      startMinutes,
      endMinutes,
      durationMinutes: totalDuration,
      totalPriceKzt: totalPrice,
      status: 'confirmed',
      source: 'widget',
      processedEvents: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _schemaVersion: 4,
    });
    tx.set(ledgerRef, {
      masterId,
      date,
      slots: [...existingSlots, {
        start: startMinutes,
        end: ledgerEndMinutes,
        type: 'appointment',
        appointmentId: appointmentRef.id,
        branchId,
      }],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
  });
  return { success: true, appointmentId: appointmentRef.id };
});

// ============ updateWidgetSlug ============

export const updateWidgetSlug = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  if (role !== 'owner') throw new HttpsError('permission-denied', 'Only owner');

  const data = request.data || {};
  let newSlug = (data.slug || '').toString().trim().toLowerCase();
  if (!newSlug) throw new HttpsError('invalid-argument', 'slug required');
  newSlug = newSlug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (newSlug.length < 3) throw new HttpsError('invalid-argument', 'slug too short');
  if (newSlug.length > 50) throw new HttpsError('invalid-argument', 'slug too long');

  const infoRef = db.doc('tenants/' + tenantId + '/config/info');
  const infoSnap = await infoRef.get();
  if (!infoSnap.exists) throw new HttpsError('not-found', 'Tenant not found');
  const oldSlug = (infoSnap.data()!.widgetSlug as string) || '';
  if (oldSlug === newSlug) return { success: true, slug: newSlug };

  const newSlugRef = db.doc('slugRegistry/' + newSlug);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(newSlugRef);
    if (existing.exists) throw new HttpsError('already-exists', 'slug taken');
    tx.set(newSlugRef, {
      tenantId,
      isAlias: false,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (oldSlug) {
      tx.set(db.doc('slugRegistry/' + oldSlug), {
        tenantId,
        isAlias: true,
        redirectsTo: newSlug,
        aliasCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    tx.update(infoRef, {
      widgetSlug: newSlug,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { success: true, slug: newSlug };
});

// ============ getAvailableSlots ============

export const getAvailableSlots = onCall(async (request) => {
  const { tenantId } = requireAuth(request);
  const data = request.data || {};
  const masterId = data.masterId;
  const date = data.date;
  const durationMinutes = Number(data.durationMinutes || 0);

  if (!masterId) throw new HttpsError('invalid-argument', 'masterId is required');
  if (!date) throw new HttpsError('invalid-argument', 'date is required');
  if (!durationMinutes || durationMinutes <= 0) {
    throw new HttpsError('invalid-argument', 'durationMinutes is required');
  }

  const masterSnap = await db.doc('tenants/' + tenantId + '/masters/' + masterId).get();
  if (!masterSnap.exists) throw new HttpsError('not-found', 'Master not found');
  const master = masterSnap.data()!;

  const weekday = dayOfWeekKey(date);
  const daySchedule = master.schedule?.[weekday];
  if (!daySchedule || !daySchedule.isWorking) {
    return { slots: [] };
  }

  const shifts: Array<{ start: number; end: number; branchId: string }> =
    daySchedule.shifts || [];
  if (shifts.length === 0) return { slots: [] };

  const ledgerSnap = await db.doc('tenants/' + tenantId + '/ledger/' + masterId + '_' + date).get();
  const bookedSlots: Array<{ start: number; end: number }> = ledgerSnap.exists
    ? (ledgerSnap.data()!.slots || [])
    : [];

  const slots: Array<{ start: number; end: number; branchId: string; time: string }> = [];

  for (const shift of shifts) {
    let cursor = shift.start;
    while (cursor + durationMinutes <= shift.end) {
      const slotEnd = cursor + durationMinutes;
      const overlaps = bookedSlots.some(
        (b) => !(slotEnd <= b.start || cursor >= b.end)
      );
      if (!overlaps) {
        const h = Math.floor(cursor / 60);
        const m = cursor % 60;
        const time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        slots.push({ start: timeToMinutes(time), end: slotEnd, branchId: shift.branchId, time });
      }
      cursor += 15;
    }
  }

  return { slots };
});

// ============ createAppointment ============

export const createAppointment = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const masterId = data.masterId;
  const clientId = data.clientId;
  const serviceIds: string[] = data.serviceIds || [];
  const date = data.date;
  const startMinutes = Number(data.startMinutes);
  const source = data.source || 'admin';

  if (!masterId) throw new HttpsError('invalid-argument', 'masterId is required');
  if (!clientId) throw new HttpsError('invalid-argument', 'clientId is required');
  if (!serviceIds || serviceIds.length === 0) {
    throw new HttpsError('invalid-argument', 'serviceIds is required');
  }
  if (!date) throw new HttpsError('invalid-argument', 'date is required');
  if (!Number.isFinite(startMinutes)) {
    throw new HttpsError('invalid-argument', 'startMinutes is required');
  }

  const serviceSnaps = await Promise.all(
    serviceIds.map((id) => db.doc('tenants/' + tenantId + '/services/' + id).get())
  );
  for (const s of serviceSnaps) {
    if (!s.exists) throw new HttpsError('not-found', 'Service not found');
  }

  const services = serviceSnaps.map((s) => s.data()!);
  const totalDuration = services.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
  const totalPrice = services.reduce((sum, s) => sum + Number(s.priceKzt || 0), 0);
  const bufferMinutes = Math.max(...services.map((s) => Number(s.bufferMinutes || 0)));
  const serviceNames = services.map((s) => s.name as string);

  const endMinutes = startMinutes + totalDuration;
  const ledgerEndMinutes = endMinutes + bufferMinutes;

  const clientSnap = await db.doc('tenants/' + tenantId + '/clients/' + clientId).get();
  if (!clientSnap.exists) throw new HttpsError('not-found', 'Client not found');
  const client = clientSnap.data()!;

  const masterSnap = await db.doc('tenants/' + tenantId + '/masters/' + masterId).get();
  if (!masterSnap.exists) throw new HttpsError('not-found', 'Master not found');
  const master = masterSnap.data()!;
  if (!master.isActive) throw new HttpsError('failed-precondition', 'Master is not active');

  const weekday = dayOfWeekKey(date);
  const daySchedule = master.schedule?.[weekday];
  if (!daySchedule || !daySchedule.isWorking) {
    throw new HttpsError('failed-precondition', 'Master does not work on this day');
  }
  const shift = (daySchedule.shifts || []).find(
    (s: { start: number; end: number }) =>
      startMinutes >= s.start && endMinutes <= s.end
  );
  if (!shift) {
    throw new HttpsError('failed-precondition', 'Time is outside working hours');
  }
  const branchId = shift.branchId || '';

  const ledgerRef = db.doc('tenants/' + tenantId + '/ledger/' + masterId + '_' + date);
  const appointmentRef = db.collection('tenants/' + tenantId + '/appointments').doc();

  await db.runTransaction(async (tx) => {
    const ledgerTx = await tx.get(ledgerRef);
    const existingSlots: Array<{ start: number; end: number }> = ledgerTx.exists
      ? (ledgerTx.data()!.slots || [])
      : [];

    const conflict = existingSlots.some(
      (s) => !(ledgerEndMinutes <= s.start || startMinutes >= s.end)
    );
    if (conflict) {
      throw new HttpsError('aborted', 'slot_taken');
    }

    tx.set(appointmentRef, {
      branchId,
      masterId,
      masterName: master.name,
      clientId,
      clientName: client.name,
      clientPhone: client.phoneNormalized,
      serviceIds,
      serviceNames,
      date,
      startMinutes,
      endMinutes,
      durationMinutes: totalDuration,
      totalPriceKzt: totalPrice,
      status: 'confirmed',
      source,
      processedEvents: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _schemaVersion: 4,
    });

    tx.set(ledgerRef, {
      masterId,
      date,
      slots: [
        ...existingSlots,
        {
          start: startMinutes,
          end: ledgerEndMinutes,
          type: 'appointment',
          appointmentId: appointmentRef.id,
          branchId,
        },
      ],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
  });

  return { success: true, appointmentId: appointmentRef.id };
});

// ============ updateAppointmentStatus ============

export const updateAppointmentStatus = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const appointmentId = data.appointmentId;
  const newStatus = data.status;

  if (!appointmentId) throw new HttpsError('invalid-argument', 'appointmentId is required');
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled', 'noshow'];
  if (!allowed.includes(newStatus)) {
    throw new HttpsError('invalid-argument', 'Invalid status');
  }

  const apptRef = db.doc('tenants/' + tenantId + '/appointments/' + appointmentId);
  const apptSnap = await apptRef.get();
  if (!apptSnap.exists) throw new HttpsError('not-found', 'Appointment not found');
  const appt = apptSnap.data()!;
  const oldStatus = appt.status;

  const allowedTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled', 'noshow'],
    noshow: ['completed'],
  };
  if (!(allowedTransitions[oldStatus] || []).includes(newStatus)) {
    throw new HttpsError(
      'failed-precondition',
      `Invalid status transition: ${oldStatus} → ${newStatus}`,
    );
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (newStatus === 'completed') {
    if (!appt.reviewToken) {
      const crypto = await import('crypto');
      updates.reviewToken = crypto.randomBytes(16).toString('hex');
    }
    updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await apptRef.update(updates);

  if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
    const ledgerRef = db.doc(
      'tenants/' + tenantId + '/ledger/' + appt.masterId + '_' + appt.date
    );
    const ledgerSnap = await ledgerRef.get();
    if (ledgerSnap.exists) {
      const slots = (ledgerSnap.data()!.slots || []).filter(
        (s: { appointmentId?: string }) => s.appointmentId !== appointmentId
      );
      await ledgerRef.update({ slots });
    }
  }

  return { success: true };
});

// ============ autoNoshow (cron every 30 minutes) ============

export const autoNoshow = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Almaty',
  },
  async () => {
    const now = new Date();
    const thresholdMs = 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - thresholdMs);

    const tenantsSnap = await db.collection('tenants').get();
    let totalProcessed = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const apptsSnap = await db
        .collection('tenants/' + tenantId + '/appointments')
        .where('status', '==', 'confirmed')
        .get();

      const infoSnap = await db.doc('tenants/' + tenantId + '/config/info').get();
      const noshowThreshold = (infoSnap.data()?.noshowBlockThreshold as number) || 3;

      for (const apptDoc of apptsSnap.docs) {
        const appt = apptDoc.data();
        const dateStr = appt.date as string;
        const startMinutes = appt.startMinutes as number;

        const [y, m, d] = dateStr.split('-').map(Number);
        const startUtc = Date.UTC(
          y,
          m - 1,
          d,
          Math.floor(startMinutes / 60) - 5,
          startMinutes % 60
        );
        const startDate = new Date(startUtc);

        if (startDate.getTime() >= cutoff.getTime()) {
          continue;
        }

        const appointmentRef = apptDoc.ref;
        const clientId = appt.clientId as string;
        const eventId = 'noshow:' + apptDoc.id;

        const processed = await db.runTransaction(async (tx) => {
          const appointmentSnap = await tx.get(appointmentRef);

          if (!appointmentSnap.exists) {
            return false;
          }

          const currentAppointment = appointmentSnap.data()!;
          const processedEvents = (currentAppointment.processedEvents as string[]) || [];

          if (processedEvents.includes(eventId)) {
            return false;
          }

          let clientSnap: admin.firestore.DocumentSnapshot | null = null;
          let clientRef: admin.firestore.DocumentReference | null = null;

          if (clientId) {
            clientRef = db.doc('tenants/' + tenantId + '/clients/' + clientId);
            clientSnap = await tx.get(clientRef);
          }

          tx.update(appointmentRef, {
            status: 'noshow',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            processedEvents: admin.firestore.FieldValue.arrayUnion(eventId),
          });

          if (clientRef && clientSnap?.exists) {
            const client = clientSnap.data()!;
            const newNoshowCount = ((client.noshowCount as number) || 0) + 1;
            const updates: Record<string, unknown> = {
              noshowCount: newNoshowCount,
            };

            if (newNoshowCount >= noshowThreshold) {
              updates.isBlocked = true;
            }

            tx.update(clientRef, updates);
          }

          return true;
        });

        if (processed) {
          totalProcessed += 1;
        }
      }
    }

    console.log('autoNoshow: processed ' + totalProcessed + ' appointments');
  }
);

// ============ sendNotificationTask (worker) ============

export const sendNotificationTask = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
      maxBackoffSeconds: 600,
    },
    rateLimits: {
      maxConcurrentDispatches: 5,
    },
  },
  async (req) => {
    const payload = req.data || {};
    const tenantId = payload.tenantId as string;
    const appointmentId = payload.appointmentId as string;
    const event = payload.event as string;

    if (!tenantId || !appointmentId || !event) {
      console.error('sendNotificationTask: missing payload');
      return;
    }

    const apptSnap = await db
      .doc('tenants/' + tenantId + '/appointments/' + appointmentId)
      .get();
    if (!apptSnap.exists) {
      console.log('sendNotificationTask: appointment not found, skip');
      return;
    }
    const appt = apptSnap.data()!;

    const existingSnap = await db
      .collection('tenants/' + tenantId + '/notifications')
      .where('appointmentId', '==', appointmentId)
      .where('event', '==', event)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      console.log('sendNotificationTask: already sent, skip');
      return;
    }

    if (event === 'confirmation' && appt.status !== 'confirmed') {
      console.log('sendNotificationTask: appointment not confirmed, skip');
      return;
    }

    const masterSnap = await db
      .doc('tenants/' + tenantId + '/masters/' + appt.masterId)
      .get();
    if (!masterSnap.exists) {
      console.log('sendNotificationTask: master not found');
      return;
    }
    const master = masterSnap.data()!;
    const waNumber = master.whatsappNumber as string;

    const notifRef = db.collection('tenants/' + tenantId + '/notifications').doc();
    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + 6);

    await notifRef.set({
      appointmentId,
      recipientType: 'master',
      recipientPhone: waNumber,
      event,
      channel: 'whatsapp',
      status: 'pending',
      attemptsCount: 0,
      processedForBilling: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt,
    });

    console.log(
      'MOCK WhatsApp to ' + waNumber + ' (event=' + event + ', appt=' + appointmentId + ')'
    );

    await notifRef.update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      attemptsCount: 1,
    });
  }
);

// ============ onAppointmentCreated trigger ============

export const onAppointmentCreated = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/appointments/{appointmentId}',
    region: 'asia-east1',
  },
  async (event) => {
    const tenantId = event.params.tenantId;
    const appointmentId = event.params.appointmentId;
    const appt = event.data?.data();
    if (!appt) return;
    if (appt.status !== 'confirmed' && appt.status !== 'pending') return;

    const queue = getFunctions().taskQueue('sendNotificationTask');
    await queue.enqueue(
      { tenantId, appointmentId, event: 'confirmation' },
      {
        scheduleDelaySeconds: 30,
        dispatchDeadlineSeconds: 60 * 5,
      }
    );
    console.log('Enqueued: ' + appointmentId);
  }
);

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

  const crypto = await import('crypto');
  const token = crypto.randomBytes(24).toString('hex');

  await masterRef.update({
    accessToken: token,
    accessTokenGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, token };
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

    const mastersSnap = await db
      .collectionGroup('masters')
      .where('accessToken', '==', token)
      .limit(1)
      .get();

    if (mastersSnap.empty) {
      throw new HttpsError('not-found', 'Invalid token');
    }

    const masterDoc = mastersSnap.docs[0];
    const master = masterDoc.data();
    const masterId = masterDoc.id;
    const pathParts = masterDoc.ref.path.split('/');
    const tenantId = pathParts[1];

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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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

// ============ uploadMasterPhoto ============

export const uploadMasterPhoto = onCall(
  { invoker: 'public', memory: '512MiB' },
  async (request) => {
    const data = request.data || {};
    const token = data.token;
    const photoBase64 = data.photoBase64;

    if (!token || typeof token !== 'string') {
      throw new HttpsError('invalid-argument', 'token required');
    }
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      throw new HttpsError('invalid-argument', 'photoBase64 required');
    }

    const sizeBytes = (photoBase64.length * 3) / 4;
    if (sizeBytes > 2 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'Photo too large (max 2MB)');
    }

    const mastersSnap = await db
      .collectionGroup('masters')
      .where('accessToken', '==', token)
      .limit(1)
      .get();

    if (mastersSnap.empty) throw new HttpsError('not-found', 'Invalid token');

    const masterDoc = mastersSnap.docs[0];
    const pathParts = masterDoc.ref.path.split('/');
    const tenantId = pathParts[1];
    const masterId = masterDoc.id;

    const bucket = admin.storage().bucket();
    const filePath = 'master-photos/' + tenantId + '/' + masterId + '.jpg';
    const file = bucket.file(filePath);

    const buffer = Buffer.from(photoBase64, 'base64');
    await file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await file.makePublic();

    const photoUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + filePath;

    await masterDoc.ref.update({ photoUrl });

    return { success: true, photoUrl };
  }
);

// ============ uploadServiceIcon ============

export const uploadServiceIcon = onCall(
  { invoker: 'public', memory: '512MiB' },
  async (request) => {
    const { tenantId, role } = requireAuth(request);
    requireOwnerOrAdmin(role);

    const data = request.data || {};
    const serviceId = data.serviceId;
    const iconBase64 = data.iconBase64;

    if (!serviceId) {
      throw new HttpsError('invalid-argument', 'serviceId is required');
    }
    if (typeof iconBase64 !== 'string' || !iconBase64) {
      throw new HttpsError('invalid-argument', 'iconBase64 is required');
    }

    const base64 = iconBase64.includes(',')
      ? iconBase64.split(',')[1]
      : iconBase64;

    if (!base64) {
      throw new HttpsError('invalid-argument', 'iconBase64 is invalid');
    }

    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = 500 * 1024;

    if (buffer.length === 0) {
      throw new HttpsError('invalid-argument', 'iconBase64 is invalid');
    }
    if (buffer.length > maxBytes) {
      throw new HttpsError('invalid-argument', 'iconBase64 exceeds maximum 500 KB');
    }

    const serviceRef = db.doc('tenants/' + tenantId + '/services/' + serviceId);
    const serviceSnap = await serviceRef.get();
    if (!serviceSnap.exists) {
      throw new HttpsError('not-found', 'Service not found');
    }

    const bucket = admin.storage().bucket();
    const path = 'service-icons/' + tenantId + '/' + serviceId + '.png';
    const file = bucket.file(path);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public,max-age=31536000',
      },
    });

    await file.makePublic();

    const iconUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + path;

    return { iconUrl };
  },
);

// ============ uploadCategoryIcon ============

export const uploadCategoryIcon = onCall(
  { invoker: 'public', memory: '512MiB' },
  async (request) => {
    const { tenantId, role } = requireAuth(request);
    requireOwnerOrAdmin(role);

    const data = request.data || {};
    const categoryId = data.categoryId;
    const iconBase64 = data.iconBase64;

    if (!categoryId) {
      throw new HttpsError('invalid-argument', 'categoryId is required');
    }
    if (typeof iconBase64 !== 'string' || !iconBase64) {
      throw new HttpsError('invalid-argument', 'iconBase64 is required');
    }

    const base64 = iconBase64.includes(',')
      ? iconBase64.split(',')[1]
      : iconBase64;

    if (!base64) {
      throw new HttpsError('invalid-argument', 'iconBase64 is invalid');
    }

    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = 500 * 1024;

    if (buffer.length === 0) {
      throw new HttpsError('invalid-argument', 'iconBase64 is invalid');
    }
    if (buffer.length > maxBytes) {
      throw new HttpsError('invalid-argument', 'iconBase64 exceeds maximum 500 KB');
    }

    const categoryRef = db.doc('tenants/' + tenantId + '/categories/' + categoryId);
    const categorySnap = await categoryRef.get();
    if (!categorySnap.exists) {
      throw new HttpsError('not-found', 'Category not found');
    }

    const bucket = admin.storage().bucket();
    const path = 'category-icons/' + tenantId + '/' + categoryId + '.png';
    const file = bucket.file(path);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public,max-age=31536000',
      },
    });

    await file.makePublic();

    const iconUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + path;

    return { iconUrl };
  },
);