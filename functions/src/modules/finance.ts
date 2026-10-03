import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, type DocumentReference, type DocumentSnapshot } from '../common/firebase';
import { requireAuth, requireOwnerOrAdmin } from '../common/guards';

// ============ Financial Ledger helpers ============

type CompensationData = {
  type?: 'employee' | 'renter';
  baseSalaryKzt?: number;
  commissionPercent?: number;
  bonusKzt?: number;
  rentType?: 'fixed' | 'percentage';
  fixedAmountKzt?: number;
  percentageOfRevenue?: number;
};

function calculateEarnings(
  compensation: CompensationData | null,
  totalPriceKzt: number,
): {
  masterEarningKzt: number;
  salonRevenueKzt: number;
  compensationMissing: boolean;
} {
  const total = Math.max(0, Math.round(Number(totalPriceKzt) || 0));

  if (!compensation || !compensation.type) {
    return {
      masterEarningKzt: 0,
      salonRevenueKzt: total,
      compensationMissing: true,
    };
  }

  if (compensation.type === 'employee') {
    const commissionPercent = Math.max(0, Math.min(100, Number(compensation.commissionPercent) || 0));
    const masterEarningKzt = Math.round((total * commissionPercent) / 100);
    return {
      masterEarningKzt,
      salonRevenueKzt: total - masterEarningKzt,
      compensationMissing: false,
    };
  }

  if (compensation.type === 'renter') {
    if (compensation.rentType === 'percentage') {
      const percentage = Math.max(0, Math.min(100, Number(compensation.percentageOfRevenue) || 0));
      const salonRevenueKzt = Math.round((total * percentage) / 100);
      return {
        masterEarningKzt: total - salonRevenueKzt,
        salonRevenueKzt,
        compensationMissing: false,
      };
    }
    // renter + fixed — аренда фиксированная, платится отдельно от визита
    return {
      masterEarningKzt: total,
      salonRevenueKzt: 0,
      compensationMissing: false,
    };
  }

  return {
    masterEarningKzt: 0,
    salonRevenueKzt: total,
    compensationMissing: true,
  };
}

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

  const result = await db.runTransaction(async (tx) => {
    // ============ ALL READS FIRST ============
    const apptSnap = await tx.get(apptRef);
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

    // READ: ledger for cancellation
    let ledgerRef: DocumentReference | null = null;
    let ledgerSnap: DocumentSnapshot | null = null;
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      ledgerRef = db.doc('tenants/' + tenantId + '/ledger/' + appt.masterId + '_' + appt.date);
      ledgerSnap = await tx.get(ledgerRef);
    }

    // READ: compensation for completion
    let compensationSnap: DocumentSnapshot | null = null;
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      const compensationRef = db.doc(
        'tenants/' + tenantId + '/masters/' + appt.masterId + '/private/compensation',
      );
      compensationSnap = await tx.get(compensationRef);
    }

    // ============ ALL WRITES AFTER ============
    const updates: Record<string, unknown> = {
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (newStatus === 'completed') {
      if (!appt.reviewToken) {
        const crypto = await import('crypto');
        updates.reviewToken = crypto.randomBytes(16).toString('hex');
      }
      updates.completedAt = FieldValue.serverTimestamp();
    }

    tx.update(apptRef, updates);

    if (ledgerRef && ledgerSnap && ledgerSnap.exists) {
      const slots = (ledgerSnap.data()!.slots || []).filter(
        (s: { appointmentId?: string }) => s.appointmentId !== appointmentId,
      );
      tx.update(ledgerRef, { slots });
    }

    if (compensationSnap !== null) {
      const compensation = compensationSnap.exists
        ? (compensationSnap.data() as CompensationData)
        : null;

      const totalPriceKzt = Number(appt.totalPriceKzt) || 0;
      const earnings = calculateEarnings(compensation, totalPriceKzt);

      const entryRef = db.collection('tenants/' + tenantId + '/financialLedger').doc();
      tx.set(entryRef, {
        appointmentId,
        masterId: appt.masterId,
        masterName: appt.masterName || '',
        clientId: appt.clientId || '',
        clientName: appt.clientName || '',
        date: appt.date || '',
        completedAt: FieldValue.serverTimestamp(),
        totalPriceKzt,
        masterEarningKzt: earnings.masterEarningKzt,
        salonRevenueKzt: earnings.salonRevenueKzt,
        compensationMissing: earnings.compensationMissing,
        compensationSnapshot: compensation
          ? {
              type: compensation.type || null,
              commissionPercent: compensation.commissionPercent ?? null,
              rentType: compensation.rentType ?? null,
              percentageOfRevenue: compensation.percentageOfRevenue ?? null,
              fixedAmountKzt: compensation.fixedAmountKzt ?? null,
              baseSalaryKzt: compensation.baseSalaryKzt ?? null,
              bonusKzt: compensation.bonusKzt ?? null,
            }
          : null,
        source: appt.source || 'admin',
        createdAt: FieldValue.serverTimestamp(),
        _schemaVersion: 4,
      });
    }

    return { success: true, changed: true };
  });

  return result;
});


// ============ getFinancialReport (owner only) ============

export const getFinancialReport = onCall(async (request) => {
  const { tenantId, role } = requireAuth(request);
  if (role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owner allowed');
  }

  const data = request.data || {};
  const dateFrom = typeof data.dateFrom === 'string' ? data.dateFrom : '';
  const dateTo = typeof data.dateTo === 'string' ? data.dateTo : '';
  const masterIdFilter = typeof data.masterId === 'string' && data.masterId ? data.masterId : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    throw new HttpsError('invalid-argument', 'dateFrom and dateTo must be YYYY-MM-DD');
  }
  if (dateFrom > dateTo) {
    throw new HttpsError('invalid-argument', 'dateFrom must be <= dateTo');
  }

  let query: any = db
    .collection('tenants/' + tenantId + '/financialLedger')
    .where('date', '>=', dateFrom)
    .where('date', '<=', dateTo);

  if (masterIdFilter) {
    query = query.where('masterId', '==', masterIdFilter);
  }

  const snap = await query.get();

  type Entry = {
    date: string;
    masterId: string;
    masterName: string;
    totalPriceKzt: number;
    masterEarningKzt: number;
    salonRevenueKzt: number;
    compensationMissing: boolean;
  };

  const entries: Entry[] = snap.docs.map((d: any) => {
    const v = d.data();
    return {
      date: (v.date as string) || '',
      masterId: (v.masterId as string) || '',
      masterName: (v.masterName as string) || '—',
      totalPriceKzt: Number(v.totalPriceKzt) || 0,
      masterEarningKzt: Number(v.masterEarningKzt) || 0,
      salonRevenueKzt: Number(v.salonRevenueKzt) || 0,
      compensationMissing: v.compensationMissing === true,
    };
  });

  const totals = {
    totalPriceKzt: 0,
    masterEarningKzt: 0,
    salonRevenueKzt: 0,
    appointmentsCount: entries.length,
    compensationMissingCount: 0,
  };

  const byMasterMap = new Map<string, {
    masterId: string;
    masterName: string;
    appointmentsCount: number;
    totalPriceKzt: number;
    masterEarningKzt: number;
    salonRevenueKzt: number;
  }>();

  const byDayMap = new Map<string, {
    date: string;
    appointmentsCount: number;
    totalPriceKzt: number;
    masterEarningKzt: number;
    salonRevenueKzt: number;
  }>();

  for (const e of entries) {
    totals.totalPriceKzt += e.totalPriceKzt;
    totals.masterEarningKzt += e.masterEarningKzt;
    totals.salonRevenueKzt += e.salonRevenueKzt;
    if (e.compensationMissing) totals.compensationMissingCount += 1;

    const m = byMasterMap.get(e.masterId) || {
      masterId: e.masterId,
      masterName: e.masterName,
      appointmentsCount: 0,
      totalPriceKzt: 0,
      masterEarningKzt: 0,
      salonRevenueKzt: 0,
    };
    m.appointmentsCount += 1;
    m.totalPriceKzt += e.totalPriceKzt;
    m.masterEarningKzt += e.masterEarningKzt;
    m.salonRevenueKzt += e.salonRevenueKzt;
    if (e.masterName !== '—') m.masterName = e.masterName;
    byMasterMap.set(e.masterId, m);

    const day = byDayMap.get(e.date) || {
      date: e.date,
      appointmentsCount: 0,
      totalPriceKzt: 0,
      masterEarningKzt: 0,
      salonRevenueKzt: 0,
    };
    day.appointmentsCount += 1;
    day.totalPriceKzt += e.totalPriceKzt;
    day.masterEarningKzt += e.masterEarningKzt;
    day.salonRevenueKzt += e.salonRevenueKzt;
    byDayMap.set(e.date, day);
  }

  const byMaster = [...byMasterMap.values()].sort(
    (a, b) => b.salonRevenueKzt - a.salonRevenueKzt,
  );
  const byDay = [...byDayMap.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  return { totals, byMaster, byDay };
});
