import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFunctions, type Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';

const FUNCTIONS_REGION =
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'asia-east1';

function readEnv(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Создайте web-widget/.env.local по образцу .env.example и пересоберите проект.`,
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: readEnv('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: readEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: readEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: readEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: readEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: readEnv('NEXT_PUBLIC_FIREBASE_APP_ID', process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

let app: FirebaseApp | null = null;
let functionsInstance: Functions | null = null;
let appCheckInstance: AppCheck | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

function initAppCheck(a: FirebaseApp): AppCheck | null {
  if (appCheckInstance) return appCheckInstance;
  if (typeof window === 'undefined') return null;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return null;
  appCheckInstance = initializeAppCheck(a, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheckInstance;
}

export function getFirebaseFunctions(): Functions {
  if (!functionsInstance) {
    const a = getFirebaseApp();
    initAppCheck(a);
    functionsInstance = getFunctions(a, FUNCTIONS_REGION);
  }
  return functionsInstance;
}