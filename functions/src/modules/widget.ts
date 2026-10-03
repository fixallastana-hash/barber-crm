import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../common/firebase';
import { requireAuth } from '../common/guards';
import { dayOfWeekKey, TENANT_TZ, nowInTenantTimezone } from '../common/time';
import { validateWidgetSlug, getWidgetTenantId } from '../common/widget';

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
      bannerUrl: info.bannerUrl || '',   
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

    const infoSnap = await db.doc('tenants/' + tenantId + '/config/info').get();
    const rawStep = infoSnap.exists ? Number(infoSnap.data()!.slotStepMinutes) : 15;
    const slotStep = Number.isFinite(rawStep) && rawStep > 0 && rawStep <= 60 ? Math.round(rawStep) : 15;
  const weekday = dayOfWeekKey(date);
  const daySchedule = master.schedule?.[weekday];
  if (!daySchedule || !daySchedule.isWorking) return { slots: [] };
  const shifts: Array<{ start: number; end: number }> = daySchedule.shifts || [];
  if (shifts.length === 0) return { slots: [] };

  const ledgerSnap = await db.doc('tenants/' + tenantId + '/ledger/' + masterId + '_' + date).get();
  const bookedSlots: Array<{ start: number; end: number }> = ledgerSnap.exists
    ? (ledgerSnap.data()!.slots || [])
    : [];

  const nowInfo = nowInTenantTimezone(TENANT_TZ);
  const isToday = date === nowInfo.dateStr;
  const minStart = isToday ? nowInfo.minutes : -1;

  const slots: Array<{ start: number; end: number; time: string }> = [];
  for (const shift of shifts) {
    let cursor = shift.start;
    while (cursor + durationMinutes <= shift.end) {
      if (isToday && cursor < minStart) {
        cursor += slotStep;
        continue;
      }
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
      cursor += slotStep;
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
      await clientRef.update({ nameVariants: FieldValue.arrayUnion(clientName) });
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
      consentGivenAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
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
      createdAt: FieldValue.serverTimestamp(),
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
      updatedAt: FieldValue.serverTimestamp(),
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
      createdAt: FieldValue.serverTimestamp(),
    });
    if (oldSlug) {
      tx.set(db.doc('slugRegistry/' + oldSlug), {
        tenantId,
        isAlias: true,
        redirectsTo: newSlug,
        aliasCreatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    tx.update(infoRef, {
      widgetSlug: newSlug,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { success: true, slug: newSlug };
});

