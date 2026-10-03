import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './firebase';

export function validateWidgetSlug(slug: unknown): asserts slug is string {
  if (typeof slug !== 'string' || !slug.trim()) {
    throw new HttpsError('invalid-argument', 'slug required');
  }
}

export async function getWidgetTenantId(slug: string): Promise<string> {
  const slugSnap = await db.doc('slugRegistry/' + slug).get();
  if (!slugSnap.exists) throw new HttpsError('not-found', 'Salon not found');
  const slugData = slugSnap.data()!;
  if (slugData.isDeleted === true) throw new HttpsError('not-found', 'Salon not found');
  if (slugData.isAlias === true) {
    throw new HttpsError('failed-precondition', 'Salon slug has changed', {
      newSlug: slugData.redirectsTo || '',
    });
  }
  const tenantId = slugData.tenantId;
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new HttpsError('not-found', 'Salon not found');
  }
  return tenantId;
}