import { describe, it, beforeAll, expect } from 'vitest';
import { seedAll, callCallable, adminDb, type Seed } from './helpers';

let s: Seed;

beforeAll(async () => {
  s = await seedAll();
});

describe('getAvailableSlots', () => {
  it('returns empty for non-working day', async () => {
    const res = await callCallable('getAvailableSlots', {
      masterId: s.masterId,
      date: s.offDate,
      durationMinutes: 60,
    }, s.ownerToken);
    expect(res.error).toBeUndefined();
    expect((res.result as any).slots).toEqual([]);
  });

  it('returns slots for working day', async () => {
    const res = await callCallable('getAvailableSlots', {
      masterId: s.masterId,
      date: s.workDate,
      durationMinutes: 60,
    }, s.ownerToken);
    expect(res.error).toBeUndefined();
    const slots = (res.result as any).slots as Array<{ start: number; end: number }>;
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].start).toBe(600);
    const last = slots[slots.length - 1];
    expect(last.start).toBe(1140);
    expect(last.end).toBe(1200);
  });
});

describe('createAppointment', () => {
  it('creates appointment doc and ledger slot', async () => {
    const res = await callCallable('createAppointment', {
      masterId: s.masterId,
      clientId: s.clientId,
      serviceIds: [s.serviceId],
      date: s.workDate,
      startMinutes: 600,
    }, s.adminToken);
    expect(res.error).toBeUndefined();
    expect((res.result as any).success).toBe(true);
    const apptId = (res.result as any).appointmentId as string;

    const appt = await adminDb.doc(`tenants/${s.tenantId}/appointments/${apptId}`).get();
    expect(appt.exists).toBe(true);
    const d = appt.data()!;
    expect(d.status).toBe('confirmed');
    expect(d.startMinutes).toBe(600);
    expect(d.endMinutes).toBe(660);
    expect(d.totalPriceKzt).toBe(10000);

    const ledger = await adminDb.doc(`tenants/${s.tenantId}/ledger/${s.masterId}_${s.workDate}`).get();
    expect(ledger.exists).toBe(true);
    const slots = ledger.data()!.slots as any[];
    expect(slots.length).toBe(1);
    expect(slots[0].start).toBe(600);
    expect(slots[0].end).toBe(660);
  });

  it('rejects conflicting slot', async () => {
    const res = await callCallable('createAppointment', {
      masterId: s.masterId,
      clientId: s.clientId,
      serviceIds: [s.serviceId],
      date: s.workDate,
      startMinutes: 600,
    }, s.adminToken);
    expect(res.error).toBeDefined();
    expect(res.error!.message).toContain('slot_taken');
  });

  it('denies master role', async () => {
    const masterRes = await callCallable('createAppointment', {
      masterId: s.masterId,
      clientId: s.clientId,
      serviceIds: [s.serviceId],
      date: s.workDate,
      startMinutes: 700,
    }, null);
    expect(masterRes.error).toBeDefined();
  });
});

describe('updateAppointmentStatus', () => {
  it('rejects invalid transition cancelled -> completed', async () => {
    const create = await callCallable('createAppointment', {
      masterId: s.masterId,
      clientId: s.clientId,
      serviceIds: [s.serviceId],
      date: s.workDate,
      startMinutes: 660,
    }, s.adminToken);
    const apptId = (create.result as any).appointmentId as string;

    const cancel = await callCallable('updateAppointmentStatus', {
      appointmentId: apptId, status: 'cancelled',
    }, s.adminToken);
    expect(cancel.error).toBeUndefined();

    const bad = await callCallable('updateAppointmentStatus', {
      appointmentId: apptId, status: 'completed',
    }, s.adminToken);
    expect(bad.error).toBeDefined();
  });
});

describe('completion writes financial ledger + report', () => {
  it('completes appointment and report totals', async () => {
    const create = await callCallable('createAppointment', {
      masterId: s.masterId,
      clientId: s.clientId,
      serviceIds: [s.serviceId],
      date: s.workDate,
      startMinutes: 720,
    }, s.adminToken);
    const apptId = (create.result as any).appointmentId as string;

    const done = await callCallable('updateAppointmentStatus', {
      appointmentId: apptId, status: 'completed',
    }, s.adminToken);
    expect(done.error).toBeUndefined();

    const report = await callCallable('getFinancialReport', {
      dateFrom: s.workDate, dateTo: s.workDate,
    }, s.ownerToken);
    expect(report.error).toBeUndefined();
    const totals = (report.result as any).totals;
    expect(totals.appointmentsCount).toBeGreaterThanOrEqual(1);
    expect(totals.totalPriceKzt).toBeGreaterThanOrEqual(10000);
    expect(totals.masterEarningKzt).toBe(Math.round(totals.totalPriceKzt / 2));
    expect(totals.salonRevenueKzt).toBe(Math.round(totals.totalPriceKzt / 2));
  });
});