import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, type DocumentReference, type DocumentSnapshot } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';
import { dayOfWeekKey } from '../common/time';
import { validateWidgetSlug, getWidgetTenantId } from '../common/widget';

// ============ widgetCreateGroupAppointment (public) ============

type GroupPersonInput = {
  clientName?: string;
  masterId?: string;
  serviceIds?: string[];
    startMinutes?: number;
};

export const widgetCreateGroupAppointment = onCall({ invoker: 'public' }, async (request) => {
  const data = request.data || {};
  const slug = data.slug;
  const date = data.date;
  const startMinutes = Number(data.startMinutes);
  const mode: 'same-master' | 'smart' = data.mode;
  const groupMasterId: string | undefined = data.masterId;
  const people: GroupPersonInput[] = Array.isArray(data.people) ? data.people : [];
  const clientPhone = typeof data.clientPhone === 'string' ? data.clientPhone.trim() : '';
  const consent = data.consent === true;

  validateWidgetSlug(slug);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z'))) {
    throw new HttpsError('invalid-argument', 'date required');
  }
  const perPerson = people.filter((p) => Number.isInteger(p.startMinutes));
  const useIndividual = perPerson.length === people.length && people.length > 0;
  if (!useIndividual && (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes >= 1440)) {
    throw new HttpsError('invalid-argument', 'startMinutes required');
  }
  if (mode !== 'same-master' && mode !== 'smart') {
    throw new HttpsError('invalid-argument', 'mode must be same-master or smart');
  }
  if (!people.length || people.length > 6) {
    throw new HttpsError('invalid-argument', 'people must be 1..6');
  }
  if (mode === 'same-master' && (typeof groupMasterId !== 'string' || !groupMasterId)) {
    throw new HttpsError('invalid-argument', 'masterId required for same-master mode');
  }
  if (!clientPhone) throw new HttpsError('invalid-argument', 'clientPhone required');
  if (!consent) throw new HttpsError('invalid-argument', 'consent required');

  for (const p of people) {
    const pMasterId = mode === 'same-master' ? groupMasterId : p.masterId;
    if (typeof p.clientName !== 'string' || !p.clientName.trim()) {
      throw new HttpsError('invalid-argument', 'clientName required for each person');
    }
    if (typeof pMasterId !== 'string' || !pMasterId) {
      throw new HttpsError('invalid-argument', 'masterId required for each person');
    }
    if (!Array.isArray(p.serviceIds) || !p.serviceIds.length) {
      throw new HttpsError('invalid-argument', 'serviceIds required for each person');
    }
  }

  const tenantId = await getWidgetTenantId(slug);
  const weekday = dayOfWeekKey(date);

  type ResolvedPerson = {
    clientName: string;
    masterId: string;
    masterName: string;
    serviceIds: string[];
    serviceNames: string[];
    durationMinutes: number;
    totalPrice: number;
    bufferMinutes: number;
    branchId: string;
    startMinutes: number;
    endMinutes: number;
    ledgerEndMinutes: number;
  };

  const resolved: ResolvedPerson[] = [];

  for (const p of people) {
    const pMasterId = (mode === 'same-master' ? groupMasterId : p.masterId) as string;
    const pServiceIds = p.serviceIds as string[];

    const serviceSnaps = await Promise.all(
      pServiceIds.map((id) => db.doc('tenants/' + tenantId + '/services/' + id).get())
    );
    if (serviceSnaps.some((s) => !s.exists)) {
      throw new HttpsError('not-found', 'Service not found');
    }
    const services = serviceSnaps.map((s) => s.data()!);
    if (services.some((s) => s.isActive !== true)) {
      throw new HttpsError('failed-precondition', 'Service not active');
    }
    const durationMinutes = services.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
    const totalPrice = services.reduce((sum, s) => sum + Number(s.priceKzt || 0), 0);
    const bufferMinutes = Math.max(...services.map((s) => Number(s.bufferMinutes || 0)), 0);
    const serviceNames = services.map((s) => s.name as string);

    const masterSnap = await db.doc('tenants/' + tenantId + '/masters/' + pMasterId).get();
    if (!masterSnap.exists) throw new HttpsError('not-found', 'Master not found');
    const master = masterSnap.data()!;
    if (!master.isActive) throw new HttpsError('failed-precondition', 'Master not active');
    const daySchedule = master.schedule?.[weekday];
    if (!daySchedule || !daySchedule.isWorking) {
      throw new HttpsError('failed-precondition', 'Master does not work on this day');
    }

    const pStart = typeof p.startMinutes === 'number' ? p.startMinutes : 0;
    resolved.push({
      clientName: (p.clientName as string).trim(),
      masterId: pMasterId,
      masterName: master.name as string,
      serviceIds: pServiceIds,
      serviceNames,
      durationMinutes,
      totalPrice,
      bufferMinutes,
      branchId: '',
      startMinutes: pStart,
      endMinutes: 0,
      ledgerEndMinutes: 0,
    });
  }

  const indicesByMaster = new Map<string, number[]>();
  resolved.forEach((r, i) => {
    const arr = indicesByMaster.get(r.masterId) || [];
    arr.push(i);
    indicesByMaster.set(r.masterId, arr);
  });

  const shiftsByMaster = new Map<string, Array<{ start: number; end: number; branchId?: string }>>();
  for (const mId of indicesByMaster.keys()) {
    const mSnap = await db.doc('tenants/' + tenantId + '/masters/' + mId).get();
    const mData = mSnap.data()!;
    const daySchedule = mData.schedule?.[weekday];
    const shifts = (daySchedule?.shifts || []) as Array<{ start: number; end: number; branchId?: string }>;
    shiftsByMaster.set(mId, shifts);
  }

  for (const indices of indicesByMaster.values()) {
    let cursor = startMinutes;
    for (const i of indices) {
      const r = resolved[i];
      if (useIndividual) {
        r.startMinutes = people[i].startMinutes as number;
      } else {
        r.startMinutes = cursor;
      }
      r.endMinutes = r.startMinutes + r.durationMinutes;
      r.ledgerEndMinutes = r.endMinutes + r.bufferMinutes;
      if (!useIndividual) cursor = r.ledgerEndMinutes;
    }
  }

  for (const r of resolved) {
    const shifts = shiftsByMaster.get(r.masterId)!;
    const shift = shifts.find((s) => r.startMinutes >= s.start && r.endMinutes <= s.end);
    if (!shift) throw new HttpsError('failed-precondition', 'Outside hours');
    r.branchId = shift.branchId || '';
  }

  const digits = clientPhone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new HttpsError('invalid-argument', 'Invalid clientPhone');
  }
  const phoneNormalized = digits.length === 11 && digits.startsWith('8')
    ? '+7' + digits.slice(1)
    : digits.length === 11 && digits.startsWith('7')
      ? '+' + digits
      : digits.length === 10
        ? '+7' + digits
        : '+' + digits;

  const primaryName = resolved[0].clientName;

  const phoneIdxRef = db.doc('tenants/' + tenantId + '/clientPhoneIndex/' + phoneNormalized);
  const phoneIdxSnap = await phoneIdxRef.get();
  let clientId: string;
  if (phoneIdxSnap.exists) {
    clientId = phoneIdxSnap.data()!.clientId as string;
    const clientRef = db.doc('tenants/' + tenantId + '/clients/' + clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) throw new HttpsError('internal', 'Client index is invalid');
    const existing = clientSnap.data()!;
    if (existing.name !== primaryName && !(existing.nameVariants || []).includes(primaryName)) {
      await clientRef.update({ nameVariants: FieldValue.arrayUnion(primaryName) });
    }
  } else {
    const newClientRef = db.collection('tenants/' + tenantId + '/clients').doc();
    clientId = newClientRef.id;
    const batch = db.batch();
    batch.set(newClientRef, {
      name: primaryName,
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
  }

  const blockedSnap = await db.doc('tenants/' + tenantId + '/clients/' + clientId).get();
  if (blockedSnap.data()?.isBlocked === true) {
    throw new HttpsError('permission-denied', 'Client is blocked');
  }

  const crypto = await import('crypto');
  const groupId = 'g_' + crypto.randomBytes(10).toString('hex');
  const groupSize = resolved.length;

  const appointmentRefs = resolved.map(() => db.collection('tenants/' + tenantId + '/appointments').doc());
  const ledgerRefs = new Map<string, DocumentReference>();
  for (const mId of indicesByMaster.keys()) {
    ledgerRefs.set(mId, db.doc('tenants/' + tenantId + '/ledger/' + mId + '_' + date));
  }

  await db.runTransaction(async (tx) => {
    const ledgerSnaps = new Map<string, DocumentSnapshot>();
    for (const [mId, ref] of ledgerRefs) {
      ledgerSnaps.set(mId, await tx.get(ref));
    }

    for (const r of resolved) {
      const snap = ledgerSnaps.get(r.masterId);
      const existingSlots: Array<{ start: number; end: number }> = snap && snap.exists
        ? (snap.data()!.slots || [])
        : [];
      const conflict = existingSlots.some(
        (s) => !(r.ledgerEndMinutes <= s.start || r.startMinutes >= s.end)
      );
      if (conflict) throw new HttpsError('aborted', 'slot_taken');
    }

    resolved.forEach((r, i) => {
      tx.set(appointmentRefs[i], {
        branchId: r.branchId,
        masterId: r.masterId,
        masterName: r.masterName,
        clientId,
        clientName: r.clientName,
        clientPhone: phoneNormalized,
        serviceIds: r.serviceIds,
        serviceNames: r.serviceNames,
        date,
        startMinutes: r.startMinutes,
        endMinutes: r.endMinutes,
        durationMinutes: r.durationMinutes,
        totalPriceKzt: r.totalPrice,
        status: 'confirmed',
        source: 'widget',
        processedEvents: [],
        createdAt: FieldValue.serverTimestamp(),
        _schemaVersion: 4,
        groupId,
        groupIndex: i + 1,
        groupSize,
      });
    });

    for (const [mId, indices] of indicesByMaster) {
      const snap = ledgerSnaps.get(mId);
      const existingSlots: Array<{ start: number; end: number }> = snap && snap.exists
        ? (snap.data()!.slots || [])
        : [];
      const newSlots = indices.map((i) => {
        const r = resolved[i];
        return {
          start: r.startMinutes,
          end: r.ledgerEndMinutes,
          type: 'appointment',
          appointmentId: appointmentRefs[i].id,
          branchId: r.branchId,
        };
      });
      tx.set(ledgerRefs.get(mId)!, {
        masterId: mId,
        date,
        slots: [...existingSlots, ...newSlots],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: false });
    }
  });

  return {
    success: true,
    groupId,
    appointmentIds: appointmentRefs.map((r) => r.id),
  };
});

// ============ cancelAppointmentGroup ============

export const cancelAppointmentGroup = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const groupId = typeof data.groupId === 'string' ? data.groupId.trim() : '';
  if (!groupId) throw new HttpsError('invalid-argument', 'groupId required');

  const apptsSnap = await db
    .collection('tenants/' + tenantId + '/appointments')
    .where('groupId', '==', groupId)
    .get();

  if (apptsSnap.empty) throw new HttpsError('not-found', 'Group not found');

  const toCancel: Array<{
    ref: DocumentReference;
    masterId: string;
    date: string;
    id: string;
  }> = [];

  for (const doc of apptsSnap.docs) {
    const a = doc.data();
    if (a.status === 'cancelled') continue;
    toCancel.push({
      ref: doc.ref,
      masterId: a.masterId as string,
      date: a.date as string,
      id: doc.id,
    });
  }

  if (!toCancel.length) {
    return { success: true, cancelled: 0, skipped: apptsSnap.size };
  }

  const ledgerKeys = new Set<string>();
  for (const c of toCancel) ledgerKeys.add(c.masterId + '_' + c.date);

  const idsByLedger = new Map<string, Set<string>>();
  for (const c of toCancel) {
    const key = c.masterId + '_' + c.date;
    const set = idsByLedger.get(key) || new Set<string>();
    set.add(c.id);
    idsByLedger.set(key, set);
  }

  await db.runTransaction(async (tx) => {
    const ledgerSnaps = new Map<string, DocumentSnapshot>();
    for (const key of ledgerKeys) {
      const ref = db.doc('tenants/' + tenantId + '/ledger/' + key);
      ledgerSnaps.set(key, await tx.get(ref));
    }

    for (const c of toCancel) {
      tx.update(c.ref, {
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    for (const [key, idsSet] of idsByLedger) {
      const snap = ledgerSnaps.get(key);
      if (!snap || !snap.exists) continue;
      const slots = (snap.data()!.slots || []).filter(
        (s: { appointmentId?: string }) => !idsSet.has(s.appointmentId || '')
      );
      tx.update(db.doc('tenants/' + tenantId + '/ledger/' + key), { slots });
    }
  });

  return { success: true, cancelled: toCancel.length };
});

// ============ createGroupAppointment (admin) ============
function normalizePhoneRaw(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return '+' + digits;
}

export const createGroupAppointment = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  requireOwnerOrAdmin(role);

  const data = request.data || {};
  const date = data.date;
  const clientsInput: Array<{
    clientId?: string;
    clientName?: string;
    clientPhone?: string;
    people?: Array<{ masterId?: string; serviceIds?: string[]; startMinutes?: number }>;
  }> = Array.isArray(data.clients) ? data.clients : [];
  const source = typeof data.source === 'string' ? data.source : 'admin';
  const discountPercentRaw = Number((data as { discountPercent?: unknown }).discountPercent || 0);
  const discountPercent = Number.isFinite(discountPercentRaw)
    ? Math.min(50, Math.max(0, Math.round(discountPercentRaw)))
    : 0;

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z'))) {
    throw new HttpsError('invalid-argument', 'date required');
  }
  if (!clientsInput.length) {
    throw new HttpsError('invalid-argument', 'clients required');
  }

  for (const c of clientsInput) {
    const hasId = typeof c.clientId === 'string' && c.clientId.trim();
    const hasNamePhone = typeof c.clientName === 'string' && c.clientName.trim()
      && typeof c.clientPhone === 'string' && c.clientPhone.trim();
    if (!hasId && !hasNamePhone) {
      throw new HttpsError('invalid-argument', 'clientId or (clientName + clientPhone) required for each client');
    }
    const pp = Array.isArray(c.people) ? c.people : [];
    if (!pp.length) {
      throw new HttpsError('invalid-argument', 'each client must have at least one person');
    }
    for (const p of pp) {
      if (typeof p.masterId !== 'string' || !p.masterId) {
        throw new HttpsError('invalid-argument', 'masterId required');
      }
      if (!Array.isArray(p.serviceIds) || !p.serviceIds.length) {
        throw new HttpsError('invalid-argument', 'serviceIds required');
      }
      if (!Number.isInteger(p.startMinutes) || (p.startMinutes as number) < 0 || (p.startMinutes as number) >= 1440) {
        throw new HttpsError('invalid-argument', 'startMinutes required');
      }
    }
  }

  const weekday = dayOfWeekKey(date);
  const resolvedClients: Array<{ clientId: string; clientPhone: string; clientName: string }> = [];

  for (const c of clientsInput) {
    const clientIdInput = typeof c.clientId === 'string' ? c.clientId.trim() : '';
    const clientNameInput = typeof c.clientName === 'string' ? c.clientName.trim() : '';
    const clientPhoneInput = typeof c.clientPhone === 'string' ? c.clientPhone.trim() : '';

    if (clientIdInput) {
      const clientSnap = await db.doc('tenants/' + tenantId + '/clients/' + clientIdInput).get();
      if (!clientSnap.exists) throw new HttpsError('not-found', 'Client not found');
      const client = clientSnap.data()!;
      if (client.isBlocked === true) throw new HttpsError('permission-denied', 'Client is blocked');
      resolvedClients.push({
        clientId: clientIdInput,
        clientPhone: ((client.phoneNormalized as string) || '').trim(),
        clientName: (client.name as string) || clientNameInput || 'Клиент',
      });
    } else {
      const digits = clientPhoneInput.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        throw new HttpsError('invalid-argument', 'Invalid clientPhone');
      }
      const phoneNormalized = normalizePhoneRaw(clientPhoneInput);
      const phoneIdxRef = db.doc('tenants/' + tenantId + '/clientPhoneIndex/' + phoneNormalized);
      const phoneIdxSnap = await phoneIdxRef.get();

      if (phoneIdxSnap.exists) {
        const cid = phoneIdxSnap.data()!.clientId as string;
        const clientRef = db.doc('tenants/' + tenantId + '/clients/' + cid);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) throw new HttpsError('internal', 'Client index is invalid');
        const existing = clientSnap.data()!;
        if (existing.isBlocked === true) throw new HttpsError('permission-denied', 'Client is blocked');
        if (existing.name !== clientNameInput && !(existing.nameVariants || []).includes(clientNameInput)) {
          await clientRef.update({ nameVariants: FieldValue.arrayUnion(clientNameInput) });
        }
        resolvedClients.push({
          clientId: cid,
          clientPhone: phoneNormalized,
          clientName: (existing.name as string) || clientNameInput,
        });
      } else {
        const newClientRef = db.collection('tenants/' + tenantId + '/clients').doc();
        const newId = newClientRef.id;
        const batch = db.batch();
        batch.set(newClientRef, {
          name: clientNameInput,
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
        batch.set(phoneIdxRef, { clientId: newId });
        await batch.commit();
        resolvedClients.push({ clientId: newId, clientPhone: phoneNormalized, clientName: clientNameInput });
      }
    }
  }

  type ResolvedPerson = {
    clientId: string;
    clientPhone: string;
    clientName: string;
    masterId: string;
    masterName: string;
    serviceIds: string[];
    serviceNames: string[];
    durationMinutes: number;
    totalPrice: number;
    originalPrice: number;
    bufferMinutes: number;
    branchId: string;
    startMinutes: number;
    endMinutes: number;
    ledgerEndMinutes: number;
  };

  const resolved: ResolvedPerson[] = [];

  for (let ci = 0; ci < clientsInput.length; ci++) {
    const rc = resolvedClients[ci];
    const pp = clientsInput[ci].people || [];

    for (const p of pp) {
      const pMasterId = p.masterId as string;
      const pServiceIds = p.serviceIds as string[];
      const pStartMinutes = p.startMinutes as number;

      const serviceSnaps = await Promise.all(
        pServiceIds.map((id) => db.doc('tenants/' + tenantId + '/services/' + id).get())
      );
      if (serviceSnaps.some((s) => !s.exists)) throw new HttpsError('not-found', 'Service not found');
      const services = serviceSnaps.map((s) => s.data()!);
      if (services.some((s) => s.isActive !== true)) throw new HttpsError('failed-precondition', 'Service not active');

      const durationMinutes = services.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
      const originalPrice = services.reduce((sum, s) => sum + Number(s.priceKzt || 0), 0);
      const totalPrice = discountPercent > 0
        ? Math.round(originalPrice * (1 - discountPercent / 100))
        : originalPrice;
      const bufferMinutes = Math.max(...services.map((s) => Number(s.bufferMinutes || 0)), 0);
      const serviceNames = services.map((s) => s.name as string);

      const masterSnap = await db.doc('tenants/' + tenantId + '/masters/' + pMasterId).get();
      if (!masterSnap.exists) throw new HttpsError('not-found', 'Master not found');
      const master = masterSnap.data()!;
      if (!master.isActive) throw new HttpsError('failed-precondition', 'Master not active');
      const daySchedule = master.schedule?.[weekday];
      if (!daySchedule || !daySchedule.isWorking) throw new HttpsError('failed-precondition', 'Master does not work on this day');

      const endMinutes = pStartMinutes + durationMinutes;
      const ledgerEndMinutes = endMinutes + bufferMinutes;

      const shifts = (daySchedule.shifts || []) as Array<{ start: number; end: number; branchId?: string }>;
      const shift = shifts.find((s) => pStartMinutes >= s.start && endMinutes <= s.end);
      if (!shift) throw new HttpsError('failed-precondition', 'Outside hours');

      resolved.push({
        clientId: rc.clientId,
        clientPhone: rc.clientPhone,
        clientName: rc.clientName,
        masterId: pMasterId,
        masterName: master.name as string,
        serviceIds: pServiceIds,
        serviceNames,
        durationMinutes,
        totalPrice,
        originalPrice,
        bufferMinutes,
        branchId: shift.branchId || '',
        startMinutes: pStartMinutes,
        endMinutes,
        ledgerEndMinutes,
      });
    }
  }

  const slotsByClientCheck = new Map<string, Array<{ start: number; end: number }>>();
  for (const r of resolved) {
    const arr = slotsByClientCheck.get(r.clientId) || [];
    arr.push({ start: r.startMinutes, end: r.endMinutes });
    slotsByClientCheck.set(r.clientId, arr);
  }
  for (const slots of slotsByClientCheck.values()) {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (!(a.end <= b.start || a.start >= b.end)) {
          throw new HttpsError('failed-precondition', 'Один клиент не может быть у двух мастеров в одно время');
        }
      }
    }
  }

  const slotsByMasterCheck = new Map<string, Array<{ start: number; end: number; clientName: string }>>();
  for (const r of resolved) {
    const arr = slotsByMasterCheck.get(r.masterId) || [];
    arr.push({ start: r.startMinutes, end: r.ledgerEndMinutes, clientName: r.clientName });
    slotsByMasterCheck.set(r.masterId, arr);
  }
  for (const slots of slotsByMasterCheck.values()) {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        const overlap = !(a.end <= b.start || a.start >= b.end);
        if (overlap) {
          throw new HttpsError('failed-precondition',
            'Гости «' + a.clientName + '» и «' + b.clientName + '» пересекаются по времени у одного мастера.');
        }
      }
    }
  }

  const uniqueMasterIds = [...new Set(resolved.map((r) => r.masterId))];
  const ledgerRefs = new Map<string, DocumentReference>();
  for (const mId of uniqueMasterIds) {
    ledgerRefs.set(mId, db.doc('tenants/' + tenantId + '/ledger/' + mId + '_' + date));
  }

  const crypto = await import('crypto');
  const groupId = 'g_' + crypto.randomBytes(10).toString('hex');
  const groupSize = resolved.length;

  const appointmentRefs = resolved.map(() => db.collection('tenants/' + tenantId + '/appointments').doc());

  await db.runTransaction(async (tx) => {
    const ledgerSnaps = new Map<string, DocumentSnapshot>();
    for (const [mId, ref] of ledgerRefs) {
      ledgerSnaps.set(mId, await tx.get(ref));
    }

    for (const r of resolved) {
      const snap = ledgerSnaps.get(r.masterId);
      const existingSlots: Array<{ start: number; end: number }> = snap && snap.exists
        ? (snap.data()!.slots || [])
        : [];
      const conflict = existingSlots.some(
        (s) => !(r.ledgerEndMinutes <= s.start || r.startMinutes >= s.end)
      );
      if (conflict) throw new HttpsError('aborted', 'slot_taken');
    }

    resolved.forEach((r, i) => {
      tx.set(appointmentRefs[i], {
        branchId: r.branchId,
        masterId: r.masterId,
        masterName: r.masterName,
        clientId: r.clientId,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        serviceIds: r.serviceIds,
        serviceNames: r.serviceNames,
        date,
        startMinutes: r.startMinutes,
        endMinutes: r.endMinutes,
        durationMinutes: r.durationMinutes,
        totalPriceKzt: r.totalPrice,
        ...(discountPercent > 0 ? { originalPriceKzt: r.originalPrice, discountPercent } : {}),
        status: 'confirmed',
        source,
        processedEvents: [],
        createdAt: FieldValue.serverTimestamp(),
        _schemaVersion: 4,
        groupId,
        groupIndex: i + 1,
        groupSize,
      });
    });

    const slotsByMaster = new Map<string, Array<{ start: number; end: number; type: string; appointmentId: string; branchId: string }>>();
    resolved.forEach((r, i) => {
      const arr = slotsByMaster.get(r.masterId) || [];
      arr.push({
        start: r.startMinutes,
        end: r.ledgerEndMinutes,
        type: 'appointment',
        appointmentId: appointmentRefs[i].id,
        branchId: r.branchId,
      });
      slotsByMaster.set(r.masterId, arr);
    });

    for (const [mId, newSlots] of slotsByMaster) {
      const snap = ledgerSnaps.get(mId);
      const existingSlots: Array<{ start: number; end: number }> = snap && snap.exists
        ? (snap.data()!.slots || [])
        : [];
      tx.set(ledgerRefs.get(mId)!, {
        masterId: mId,
        date,
        slots: [...existingSlots, ...newSlots],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: false });
    }
  });

  return {
    success: true,
    groupId,
    appointmentIds: appointmentRefs.map((r) => r.id),
  };
});
