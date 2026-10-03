import { HttpsError } from 'firebase-functions/v2/https';

export function requireAuth(request: any) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const tenantId = request.auth.token.tenantId as string | undefined;
  const role = request.auth.token.role as string | undefined;
  if (!tenantId) {
    throw new HttpsError('permission-denied', 'No tenant assigned');
  }
  return { tenantId, role };
}

export function requireOwnerOrAdmin(role: string | undefined) {
  if (role !== 'owner' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only owner or admin allowed');
  }
}

export function requireOwner(role: string | undefined) {
  if (role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owner allowed');
  }
}