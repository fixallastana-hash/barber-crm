import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';

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
    createdAt: FieldValue.serverTimestamp(),
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
      updatedAt: FieldValue.serverTimestamp(),
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
        updatedAt: FieldValue.serverTimestamp(),
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
        updatedAt: FieldValue.serverTimestamp(),
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

