import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';

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
      serviceIds: FieldValue.arrayRemove(serviceId),
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

  updates.updatedAt = FieldValue.serverTimestamp();

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
    updatedAt: FieldValue.serverTimestamp(),
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
    updatedAt: FieldValue.serverTimestamp(),
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
    createdAt: FieldValue.serverTimestamp(),
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
    createdAt: FieldValue.serverTimestamp(),
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
    updatedAt: FieldValue.serverTimestamp(),
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
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

