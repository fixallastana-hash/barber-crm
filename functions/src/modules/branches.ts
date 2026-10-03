import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';

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
    createdAt: FieldValue.serverTimestamp(),
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