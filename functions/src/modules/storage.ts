import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { db, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';
import { findMasterByToken } from '../common/masterToken';

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

    const found = await findMasterByToken(token);
    if (!found) throw new HttpsError('not-found', 'Invalid or expired token');

    const { masterId, tenantId } = found;

    const bucket = getStorage().bucket();
    const filePath = 'master-photos/' + tenantId + '/' + masterId + '.jpg';
    const file = bucket.file(filePath);

    const buffer = Buffer.from(photoBase64, 'base64');
    await file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await file.makePublic();

    const photoUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + filePath;

    await db.doc('tenants/' + tenantId + '/masters/' + masterId).update({ photoUrl });

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

    const bucket = getStorage().bucket();
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

    const bucket = getStorage().bucket();
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


// ============ uploadSalonBanner ============

export const uploadSalonBanner = onCall(
  { invoker: 'public', memory: '512MiB' },
  async (request) => {
    const { tenantId, role } = requireAuth(request);
    requireOwnerOrAdmin(role);

    const data = request.data || {};
    const bannerBase64 = data.bannerBase64;

    if (typeof bannerBase64 !== 'string' || !bannerBase64) {
      throw new HttpsError('invalid-argument', 'bannerBase64 is required');
    }

    const base64 = bannerBase64.includes(',')
      ? bannerBase64.split(',')[1]
      : bannerBase64;

    if (!base64) {
      throw new HttpsError('invalid-argument', 'bannerBase64 is invalid');
    }

    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = 1024 * 1024;

    if (buffer.length === 0) {
      throw new HttpsError('invalid-argument', 'bannerBase64 is invalid');
    }
    if (buffer.length > maxBytes) {
      throw new HttpsError('invalid-argument', 'bannerBase64 exceeds maximum 1 MB');
    }

    const infoRef = db.doc('tenants/' + tenantId + '/config/info');
    const infoSnap = await infoRef.get();
    if (!infoSnap.exists) {
      throw new HttpsError('not-found', 'Tenant not found');
    }

    const bucket = getStorage().bucket();
    const path = 'tenant-banners/' + tenantId + '/banner.png';
    const file = bucket.file(path);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public,max-age=31536000',
      },
    });

    await file.makePublic();

    const bannerUrl =
      'https://storage.googleapis.com/' + bucket.name + '/' + path + '?v=' + Date.now();

    await infoRef.update({
      bannerUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { bannerUrl };
  },
);
