import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { db, FieldValue, type DocumentReference, type DocumentSnapshot } from '../common/firebase';

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

          let clientSnap: DocumentSnapshot | null = null;
          let clientRef: DocumentReference | null = null;

          if (clientId) {
            clientRef = db.doc('tenants/' + tenantId + '/clients/' + clientId);
            clientSnap = await tx.get(clientRef);
          }

          tx.update(appointmentRef, {
            status: 'noshow',
            updatedAt: FieldValue.serverTimestamp(),
            processedEvents: FieldValue.arrayUnion(eventId),
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
      createdAt: FieldValue.serverTimestamp(),
      expireAt,
    });

    console.log(
      'MOCK WhatsApp to ' + waNumber + ' (event=' + event + ', appt=' + appointmentId + ')'
    );

    await notifRef.update({
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
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


