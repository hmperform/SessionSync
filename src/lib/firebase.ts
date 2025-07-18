
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// This function is the single source of truth for configuration status.
export const isFirebaseConfigured = () => {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
};

// Declare the variables. They will be initialized conditionally.
// Assigning them `null as any` is a way to satisfy TypeScript's strict initialization
// while ensuring the consuming code, which uses `isFirebaseConfigured` as a guard, works correctly.
let app: FirebaseApp = null as any;
let auth: Auth = null as any;
let db: Firestore = null as any;
let storage: FirebaseStorage = null as any;

// This check is now the crucial guard that prevents the app from crashing.
if (isFirebaseConfigured()) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (typeof window !== 'undefined') {
    setPersistence(auth, browserSessionPersistence)
      .catch((error) => {
        console.error("Firebase Auth: Error setting persistence to session-only.", error);
      });
  }
} else {
  // This warning will now appear in the server console during build if .env is missing,
  // and in the browser console if the public env vars are missing.
  console.warn("Firebase is not configured. Please check your .env file. Firebase services will be unavailable.");
}

export { app, auth, db, storage };
