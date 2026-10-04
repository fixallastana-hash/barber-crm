import { createHash } from 'crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from './firebase';

type Options = {
  endpoint: string;
  limit: number;
  windowSec: number;
  keySuffix?: string;
};

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 16);
}

function getClientIp(request: any): string {
  const raw = request?.rawRequest;
  const xff = raw?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return raw?.ip || 'unknown';
}

export async function enforceRateLimit(request: any, opts: Options): Promise<void> {
  const ip = getClientIp(request);
  const parts = [opts.endpoint, sha1(ip)];
  if (opts.keySuffix) parts.push(sha1(opts.keySuffix));
  const docId = parts.join('_');
  const ref = db.doc('rateLimits/' + docId);

  const now = Date.now();
  const resetAt = now + opts.windowSec * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, { count: 1, resetAt, endpoint: opts.endpoint });
      return;
    }
    const d = snap.data()!;
    const curReset = typeof d.resetAt === 'number' ? d.resetAt : 0;
    const curCount = typeof d.count === 'number' ? d.count : 0;
    if (curReset <= now) {
      tx.set(ref, { count: 1, resetAt, endpoint: opts.endpoint });
      return;
    }
    if (curCount >= opts.limit) {
      throw new HttpsError('resource-exhausted', 'rate_limit_exceeded');
    }
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}