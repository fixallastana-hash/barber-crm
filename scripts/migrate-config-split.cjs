const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ projectId: 'barber-crm-dev', credential: applicationDefault() });
const db = getFirestore();

const PRIVATE_FIELDS = [
  'cancellationWindowHours',
  'reminderHours',
  'noshowBlockThreshold',
  'requireConfirmation',
  'pendingConfirmationTimeoutMinutes',
];

(async () => {
  const slugs = await db.collection('slugRegistry').get();
  const tenantIds = new Set();
  slugs.forEach(d => {
    const t = d.data().tenantId;
    if (t && !d.data().isDeleted) tenantIds.add(t);
  });
  console.log('tenants found:', tenantIds.size);

  for (const tenantId of tenantIds) {
    const infoRef = db.doc(`tenants/${tenantId}/config/info`);
    const privRef = db.doc(`tenants/${tenantId}/config/privateConfig`);
    const [infoSnap, privSnap] = await Promise.all([infoRef.get(), privRef.get()]);
    if (!infoSnap.exists) { console.log(`skip ${tenantId} (no info)`); continue; }

    const info = infoSnap.data() || {};
    const priv = privSnap.exists ? (privSnap.data() || {}) : {};

    const toPriv = {};
    for (const k of PRIVATE_FIELDS) {
      if (info[k] !== undefined && priv[k] === undefined) toPriv[k] = info[k];
    }
    if (Object.keys(toPriv).length > 0) {
      toPriv['updatedAt'] = FieldValue.serverTimestamp();
      if (!privSnap.exists) toPriv['createdAt'] = FieldValue.serverTimestamp();
      await privRef.set(toPriv, { merge: true });
    }

    const toDelete = {};
    for (const k of Object.keys(info)) {
      if (PRIVATE_FIELDS.includes(k)) toDelete[k] = FieldValue.delete();
    }
    if (Object.keys(toDelete).length > 0) {
      await infoRef.update(toDelete);
    }

    console.log(`migrated ${tenantId}: priv+${Object.keys(toPriv).length}, info-${Object.keys(toDelete).length}`);
  }
  console.log('done');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });