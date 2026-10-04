import { describe, it, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
  const hostPort = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [host, portStr] = hostPort.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'barber-crm-dev',
    firestore: { rules, host, port: Number(portStr) },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const ownerA = () =>
  testEnv.authenticatedContext('ownerA', { tenantId: 'tenantA', role: 'owner' }).firestore();
const adminA = () =>
  testEnv.authenticatedContext('adminA', { tenantId: 'tenantA', role: 'admin' }).firestore();
const masterA = () =>
  testEnv.authenticatedContext('masterA', { tenantId: 'tenantA', role: 'master' }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

describe('tenants/{tid} root', () => {
  it('owner cannot read tenant root', async () => {
    await assertFails(getDoc(doc(ownerA(), 'tenants/tenantA')));
  });
  it('owner cannot write tenant root', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantA'), { x: 1 }));
  });
});

describe('tenants/{tid}/config/info', () => {
  it('anon can read', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'tenants/tenantA/config/info')));
  });
  it('owner can write', async () => {
    await assertSucceeds(setDoc(doc(ownerA(), 'tenants/tenantA/config/info'), { tz: 'Asia/Almaty' }));
  });
  it('admin can write', async () => {
    await assertSucceeds(setDoc(doc(adminA(), 'tenants/tenantA/config/info'), { tz: 'Asia/Almaty' }));
  });
  it('master cannot write', async () => {
    await assertFails(setDoc(doc(masterA(), 'tenants/tenantA/config/info'), { tz: 'X' }));
  });
  it('anon cannot write', async () => {
    await assertFails(setDoc(doc(anon(), 'tenants/tenantA/config/info'), { tz: 'X' }));
  });
});

describe('cross-tenant isolation', () => {
  it('ownerA cannot read tenantB branches', async () => {
    await assertFails(getDoc(doc(ownerA(), 'tenants/tenantB/branches/b1')));
  });
  it('ownerA cannot write tenantB config/info', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantB/config/info'), { tz: 'X' }));
  });
  it('ownerA can read tenantA branches', async () => {
    await assertSucceeds(getDoc(doc(ownerA(), 'tenants/tenantA/branches/b1')));
  });
});

describe('branches', () => {
  it('master can read', async () => {
    await assertSucceeds(getDoc(doc(masterA(), 'tenants/tenantA/branches/b1')));
  });
  it('admin cannot write', async () => {
    await assertFails(setDoc(doc(adminA(), 'tenants/tenantA/branches/b1'), { name: 'x' }));
  });
});

describe('masters', () => {
  it('admin can read', async () => {
    await assertSucceeds(getDoc(doc(adminA(), 'tenants/tenantA/masters/m1')));
  });
  it('master cannot read', async () => {
    await assertFails(getDoc(doc(masterA(), 'tenants/tenantA/masters/m1')));
  });
  it('owner can read private', async () => {
    await assertSucceeds(getDoc(doc(ownerA(), 'tenants/tenantA/masters/m1/private/creds')));
  });
  it('admin cannot read private', async () => {
    await assertFails(getDoc(doc(adminA(), 'tenants/tenantA/masters/m1/private/creds')));
  });
});

describe('clients', () => {
  it('admin can read', async () => {
    await assertSucceeds(getDoc(doc(adminA(), 'tenants/tenantA/clients/c1')));
  });
  it('master cannot read', async () => {
    await assertFails(getDoc(doc(masterA(), 'tenants/tenantA/clients/c1')));
  });
  it('owner cannot write', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantA/clients/c1'), { x: 1 }));
  });
});

describe('clientPhoneIndex', () => {
  it('owner cannot read', async () => {
    await assertFails(getDoc(doc(ownerA(), 'tenants/tenantA/clientPhoneIndex/+77000000000')));
  });
  it('owner cannot write', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantA/clientPhoneIndex/+77000000000'), { x: 1 }));
  });
});

describe('users', () => {
  it('owner can read', async () => {
    await assertSucceeds(getDoc(doc(ownerA(), 'tenants/tenantA/users/u1')));
  });
  it('admin cannot read other user', async () => {
    await assertFails(getDoc(doc(adminA(), 'tenants/tenantA/users/u1')));
  });
  it('self can read', async () => {
    const me = testEnv.authenticatedContext('u1', { tenantId: 'tenantA', role: 'master' }).firestore();
    await assertSucceeds(getDoc(doc(me, 'tenants/tenantA/users/u1')));
  });
  it('owner cannot write users', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantA/users/u1'), { x: 1 }));
  });
});

describe('appointments', () => {
  it('admin can read', async () => {
    await assertSucceeds(getDoc(doc(adminA(), 'tenants/tenantA/appointments/a1')));
  });
  it('master cannot read', async () => {
    await assertFails(getDoc(doc(masterA(), 'tenants/tenantA/appointments/a1')));
  });
  it('owner cannot write', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantA/appointments/a1'), { x: 1 }));
  });
});

describe('financialLedger', () => {
  it('owner can read', async () => {
    await assertSucceeds(getDoc(doc(ownerA(), 'tenants/tenantA/financialLedger/e1')));
  });
  it('admin cannot read', async () => {
    await assertFails(getDoc(doc(adminA(), 'tenants/tenantA/financialLedger/e1')));
  });
  it('owner cannot write', async () => {
    await assertFails(setDoc(doc(ownerA(), 'tenants/tenantA/financialLedger/e1'), { x: 1 }));
  });
});

describe('slugRegistry', () => {
  it('anon cannot read', async () => {
    await assertFails(getDoc(doc(anon(), 'slugRegistry/test-salon')));
  });
  it('owner cannot write', async () => {
    await assertFails(setDoc(doc(ownerA(), 'slugRegistry/test-salon'), { x: 1 }));
  });
});

describe('unknown collections', () => {
  it('owner cannot read unknown subcollection', async () => {
    await assertFails(getDoc(doc(ownerA(), 'tenants/tenantA/random/x')));
  });
});