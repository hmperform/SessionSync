
// Ensure you have firebase installed: npm install firebase
// Replace with your actual Firebase project configuration in your .env.local or directly here if not sensitive.
// For this example, we assume you'll replace placeholders manually for now.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, setPersistence, browserSessionPersistence } from 'firebase/auth'; // Added setPersistence, browserSessionPersistence
import { getFirestore, type Firestore } from 'firebase/firestore';
// import { getAnalytics, type Analytics } from "firebase/analytics"; // Optional

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBhe_SSyUTFo5Qvx3wUE6Hxo9GDMVPGcAw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sessionsync-wbo8u.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sessionsync-wbo8u",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sessionsync-wbo8u.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "919307914288",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:919307914288:web:3d762e6dd81242d0ec71f5",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID" // Optional, G-XXXXXXXXXX
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
// let analytics: Analytics | undefined; // Optional

if (getApps().length === 0) {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey === "AIzaSyBhe_SSyUTFo5Qvx3wUE6Hxo9GDMVPGcAw" && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === undefined) {
    if (firebaseConfig.apiKey === "YOUR_API_KEY_PLACEHOLDER_IF_IT_WAS_DIFFERENT") { 
         console.warn(
            "Firebase is not configured. Please add your Firebase config to src/lib/firebase.ts or environment variables."
         );
    }
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Set auth persistence to session-only
  setPersistence(auth, browserSessionPersistence)
    .catch((error) => {
      console.error("Firebase Auth: Error setting persistence to session-only.", error);
    });

  // if (typeof window !== 'undefined' && firebaseConfig.measurementId && firebaseConfig.measurementId !== "YOUR_MEASUREMENT_ID") {
  //   analytics = getAnalytics(app);
  // }
} else {
  app = getApps()[0]!;
  auth = getAuth(app); // Ensure auth is initialized for subsequent uses if app already exists
  db = getFirestore(app);
  // If app is re-initialized, persistence might default back if not set again.
  // However, in typical client-side Next.js, the first block runs once.
  // To be safe, you could call setPersistence here as well, though it might be redundant
  // if the auth instance is truly a singleton reused.
  // setPersistence(auth, browserSessionPersistence)
  //   .catch((error) => {
  //     console.error("Firebase Auth: Error re-setting persistence to session-only.", error);
  //   });
}

export { app, auth, db };
// export { app, auth, db, analytics }; // If using analytics

export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};
