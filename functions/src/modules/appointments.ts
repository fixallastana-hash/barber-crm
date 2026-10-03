import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';
import { timeToMinutes, dayOfWeekKey, TENANT_TZ, nowInTenantTimezone } from '../common/time';

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

  const nowInfo = nowInTenantTimezone(TENANT_TZ);
  const isToday = date === nowInfo.dateStr;
  const minStart = isToday ? nowInfo.minutes : -1;

  const slots: Array<{ start: number; end: number; branchId: string; time: string }> = [];

  for (const shift of shifts) {
    let cursor = shift.start;
    while (cursor + durationMinutes <= shift.end) {
      if (isToday && cursor < minStart) {
        cursor += 15;
        continue;
      }
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
  const discountPercentRaw = Number((data as { discountPercent?: unknown }).discountPercent || 0);
  const discountPercent = Number.isFinite(discountPercentRaw)
    ? Math.min(50, Math.max(0, Math.round(discountPercentRaw)))
    : 0;

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
  const originalPrice = services.reduce((sum, s) => sum + Number(s.priceKzt || 0), 0);
  const totalPrice = discountPercent > 0
    ? Math.round(originalPrice * (1 - discountPercent / 100))
    : originalPrice;
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
      ...(discountPercent > 0 ? { originalPriceKzt: originalPrice, discountPercent } : {}),
      status: 'confirmed',
      source,
      processedEvents: [],
      createdAt: FieldValue.serverTimestamp(),
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
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: false });
  });

  return { success: true, appointmentId: appointmentRef.id };
});



