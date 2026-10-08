import { initializeApp, getApps } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Configuración pública del proyecto de Firebase (viene de variables de entorno, no del código)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** `null` si falta la configuración: la web sigue funcionando (verificar, registro público) pero sin login. */
export const auth: Auth | null = firebaseConfig.apiKey
  ? getAuth(getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;
