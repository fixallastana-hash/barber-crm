import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';

export const TOKEN_TTL_DAYS = 90;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function tokenExpiresAt(days = TOKEN_TTL_DAYS): Timestamp {
  const now = Date.now();
  return Timestamp.fromMillis(now + days * 24 * 60 * 60 * 1000);
}

export type MasterByToken = {
  masterId: string;
  tenantId: string;
  data: FirebaseFirestore.DocumentData;
};

export async function findMasterByToken(token: string): Promise<MasterByToken | null> {
  if (!token || typeof token !== 'string') return null;

  const tokenHash = hashToken(token);
  const now = Timestamp.now();

  const snap = await db
    .collectionGroup('masters')
    .where('accessTokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const masterDoc = snap.docs[0];
  const master = masterDoc.data();

  const expiresAt = master.accessTokenExpiresAt as Timestamp | undefined;
  if (!expiresAt || expiresAt.toMillis() < now.toMillis()) {
    return null;
  }

  const pathParts = masterDoc.ref.path.split('/');
  const tenantId = pathParts[1];

  // Обновить lastUsedAt (не блокируем основной flow)
  void masterDoc.ref.update({ accessTokenLastUsedAt: Timestamp.now() }).catch(() => {});

  return { masterId: masterDoc.id, tenantId, data: master };
}