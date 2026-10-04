import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'barber-crm-dev';
const FUNCTIONS_HOST = 'http://127.0.0.1:5001';
const REGION = 'asia-east1';
const AUTH_HOST = 'http://127.0.0.1:9099';

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();

async function ensureUser(uid: string): Promise<void> {
  try {
    await adminAuth.createUser({ uid });
  } catch (e: any) {
    if (e.code !== 'auth/uid-already-exists') throw e;
  }
}

export async function signIn(
  uid: string,
  claims: { tenantId: string; role: string },
): Promise<string> {
  await ensureUser(uid);
  await adminAuth.setCustomUserClaims(uid, claims);
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`signIn failed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { idToken: string };
  return json.idToken;
}

export type CallResult<T = any> = {
  status: number;
  result?: T;
  error?: { status: string; message: string };
};

export async function callCallable<T = any>(
  name: string,
  data: unknown,
  idToken: string | null,
): Promise<CallResult<T>> {
  const url = `${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/${name}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ data }) });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* ignore */ }
  const out: CallResult<T> = { status: res.status };
  if (body && typeof body === 'object') {
    if ('result' in body) out.result = body.result;
    if ('error' in body) out.error = body.error;
  }
  return out;
}

export type Seed = {
  tenantId: string;
  masterId: string;
  serviceId: string;
  clientId: string;
  ownerUid: string;
  adminUid: string;
  workDate: string;
  offDate: string;
  ownerToken: string;
  adminToken: string;
};

function pickDates(): { workDate: string; offDate: string } {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 21);
  const nextOf = (target: string): string => {
    const d = new Date(start);
    for (let i = 0; i < 7; i++) {
      if (days[d.getUTCDay()] === target) return d.toISOString().slice(0, 10);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    throw new Error('unreachable');
  };
  return { workDate: nextOf('mon'), offDate: nextOf('sun') };
}

export async function seedAll(): Promise<Seed> {
  const tenantId = 'tenantSmoke';
  const ownerUid = 'ownerSmoke';
  const adminUid = 'adminSmoke';
  const masterId = 'm1';
  const serviceId = 's1';
  const clientId = 'c1';

  const ownerToken = await signIn(ownerUid, { tenantId, role: 'owner' });
  const adminToken = await signIn(adminUid, { tenantId, role: 'admin' });

  await adminDb.doc(`tenants/${tenantId}/config/info`).set({
    name: 'Smoke Salon',
    timezone: 'Asia/Almaty',
  });

  const { workDate, offDate } = pickDates();

  const shift = [{ start: 600, end: 1200, branchId: 'b1' }];
  const schedule: Record<string, unknown> = {
    sun: { isWorking: false, shifts: [] },
    mon: { isWorking: true, shifts: shift },
    tue: { isWorking: true, shifts: shift },
    wed: { isWorking: true, shifts: shift },
    thu: { isWorking: true, shifts: shift },
    fri: { isWorking: true, shifts: shift },
    sat: { isWorking: true, shifts: shift },
  };

  await adminDb.doc(`tenants/${tenantId}/masters/${masterId}`).set({
    name: 'Master Smoke',
    isActive: true,
    schedule,
  });

  await adminDb.doc(`tenants/${tenantId}/masters/${masterId}/private/compensation`).set({
    type: 'employee',
    commissionPercent: 50,
  });

  await adminDb.doc(`tenants/${tenantId}/services/${serviceId}`).set({
    name: 'Haircut',
    durationMinutes: 60,
    priceKzt: 10000,
    bufferMinutes: 0,
  });

  await adminDb.doc(`tenants/${tenantId}/clients/${clientId}`).set({
    name: 'Client Smoke',
    phoneNormalized: '+77000000000',
  });

  return { tenantId, masterId, serviceId, clientId, ownerUid, adminUid, workDate, offDate, ownerToken, adminToken };
}