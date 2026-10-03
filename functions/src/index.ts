import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-east1' });

export * from './modules/branches';
export * from './modules/masters';
export * from './modules/catalog';
export * from './modules/clients';
export * from './modules/auth';
export * from './modules/widget';
export * from './modules/finance';
export * from './modules/masterAccess';
export * from './modules/appointments';
export * from './modules/notifications';
export * from './modules/storage';
export * from './modules/groupAppointments';