'use client';

import { useAuth } from './auth-context';

export function useCurrentUser() {
  return useAuth();
}
