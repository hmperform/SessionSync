
'use server';

import { collection, serverTimestamp, doc, getDoc, updateDoc, Timestamp, setDoc, type FieldValue, query, where, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured, auth } from './firebase';
import type { Session } from '@/components/shared/session-card';
import type { UserRole } from '@/context/role-context';
import type { User as FirebaseUser } from 'firebase/auth';

function ensureFirebaseIsOperational() {
  if (!isFirebaseConfigured()) {
    const errorMessage = "[firestoreService] Firebase is not configured. Please add your Firebase config to src/lib/firebase.ts or environment variables.";
    console.error(errorMessage + " Aborting Firestore operation.");
    throw new Error(errorMessage);
  }
  if (!db) {
    const dbErrorMessage = "[firestoreService] Firestore DB is not initialized. This can happen if Firebase configuration is missing or incorrect.";
    console.error(dbErrorMessage + " Aborting Firestore operation.");
    throw new Error(dbErrorMessage);
  }
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string | null;
  createdAt: Timestamp | FieldValue; // Allow for FieldValue on create
  updatedAt?: Timestamp | FieldValue;
  coachId?: string;
  stripeCustomerId_test?: string;
  stripeCustomerId_live?: string;
  companyId?: string;
}

export interface CompanyProfile {
    id: string;
    name: string;
    createdAt: Timestamp;
    stripeAccountId_test?: string;
    stripeAccountOnboarded_test?: boolean;
    stripeAccountId_live?: string;
    stripeAccountOnboarded_live?: boolean;
}

export interface NewSessionData {
  coachId: string;
  coachName:string;
  companyId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  sessionDate: Date;
  sessionType: 'Full' | 'Half';
  videoLink?: string | '';
  sessionNotes: string;
  summary?: string | '';
  status: 'Under Review' | 'Approved' | 'Denied' | 'Billed';
}

export async function createUserProfileInFirestore(
  uid: string,
  profileData: Omit<UserProfile, 'uid' | 'createdAt'> & { createdAt?: FieldValue | Timestamp }
): Promise<void> {
  ensureFirebaseIsOperational();
  const userDocRef = doc(db, 'users', uid);
  try {
    await setDoc(userDocRef, { 
      ...profileData, 
      uid, 
      createdAt: profileData.createdAt || serverTimestamp() 
    });
  } catch (error) {
    console.error(`Error writing user profile to Firestore for UID ${uid}:`, error);
    throw error;
  }
}


export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  ensureFirebaseIsOperational();
  try {
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const role = ['admin', 'super-admin', 'coach', 'client'].includes(data.role) ? data.role as UserRole : null;

      let createdAtTimestamp: Timestamp;
      if (data.createdAt instanceof Timestamp) {
        createdAtTimestamp = data.createdAt;
      } else if (data.createdAt && typeof data.createdAt.seconds === 'number') {
        createdAtTimestamp = new Timestamp(data.createdAt.seconds, data.createdAt.nanoseconds);
      } else {
        createdAtTimestamp = Timestamp.now();
      }

      const profile: UserProfile = {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role,
        photoURL: data.photoURL || null,
        createdAt: createdAtTimestamp,
        coachId: data.coachId || undefined,
        stripeCustomerId_test: data.stripeCustomerId_test || undefined,
        stripeCustomerId_live: data.stripeCustomerId_live || undefined,
        companyId: data.companyId || undefined,
      };
      return profile;
    }
    return null;
  } catch (error: any) {
    console.error(`[firestoreService] Detailed Firebase Error in getUserProfile for UID ${uid}:`, error);
    let detailedMessage = `Failed to fetch user profile for UID ${uid}.`;
    if (error.code) detailedMessage += ` Firebase Code: ${error.code}.`;
    if (error.message) detailedMessage += ` Original error: ${error.message}.`;
    throw new Error(detailedMessage);
  }
}


export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    ensureFirebaseIsOperational();
    try {
        const userDocRef = doc(db, 'users', uid);
        const updateData = { ...updates, updatedAt: serverTimestamp() };
        await updateDoc(userDocRef, updateData);
    } catch (error: any) {
        console.error(`Detailed Firebase Error in updateUserProfile for UID ${uid}:`, error);
        throw new Error(`Failed to update user profile for UID ${uid}.`);
    }
}


export async function getClientSessions(clientId: string, companyId: string): Promise<Session[]> {
  ensureFirebaseIsOperational();
  try {
    const sessionsCol = collection(db, 'sessions');
    const q = query(
      sessionsCol,
      where('clientId', '==', clientId),
      where('companyId', '==', companyId),
      orderBy('sessionDate', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sessionDate: (data.sessionDate as Timestamp).toDate().toISOString(),
      } as Session;
    });
  } catch (error: any) {
    console.error(`Detailed Firebase Error in getClientSessions for clientID ${clientId}:`, error);
    if (error.code === 'failed-precondition') {
        throw new Error(`Failed to fetch client sessions. A Firestore index is required. Please check the browser's developer console for a link to create it.`);
    }
    throw new Error(`Failed to fetch client sessions for client ID ${clientId}. See server logs for details.`);
  }
}

export async function getClientSessionsForCoach(clientId: string, coachId: string, companyId: string): Promise<Session[]> {
  ensureFirebaseIsOperational();
  try {
    const sessionsCol = collection(db, 'sessions');
    const q = query(
      sessionsCol,
      where('companyId', '==', companyId),
      where('clientId', '==', clientId),
      where('coachId', '==', coachId),
      orderBy('sessionDate', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        sessionDate: (data.sessionDate as Timestamp).toDate().toISOString(),
      } as Session;
    });
  } catch (error: any) {
    console.error(`Detailed Firebase Error in getClientSessionsForCoach for clientID ${clientId} and coachID ${coachId}:`, error);
    let errorMessage = `Failed to fetch client sessions for coach.`;
    if (error.code === 'failed-precondition') {
      errorMessage = `A Firestore index is required. Please check the browser's developer console for a link to create it.`
    } else if (error.code === 'permission-denied') {
        errorMessage = `You do not have permission to view these sessions. Please check Firestore rules.`
    } else if (error.message) {
        errorMessage += ` Reason: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
}

export async function getCoachSessions(coachId: string, companyId: string): Promise<Session[]> {
  ensureFirebaseIsOperational();
  try {
    const sessionsCol = collection(db, 'sessions');
    const q = query(
      sessionsCol,
      where('coachId', '==', coachId),
      where('companyId', '==', companyId),
      orderBy('sessionDate', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(docData => {
      const data = docData.data();
      return {
        id: docData.id,
        ...data,
        sessionDate: (data.sessionDate as Timestamp).toDate().toISOString(),
      } as Session;
    });
  } catch (error: any) {
    console.error(`Detailed Firebase Error in getCoachSessions for coachID ${coachId}:`, error);
    let errorMessage = `Failed to fetch coach sessions for coach ID ${coachId}.`;
    if (error.code === 'failed-precondition' || error.code === 'invalid-argument') {
      errorMessage = `A Firestore index is likely required or a query value was invalid. Please check the browser's developer console for an index creation link or query details.`
    } else if (error.message) {
      errorMessage += ` Reason: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
}

export async function logSession(sessionData: NewSessionData): Promise<string> {
  ensureFirebaseIsOperational();
  try {
    const sessionsCol = collection(db, 'sessions');
    const docRef = await addDoc(sessionsCol, {
      ...sessionData,
      sessionDate: Timestamp.fromDate(new Date(sessionData.sessionDate)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isArchived: false, // Default to not archived
    });
    return docRef.id;
  } catch (error: any) {
    console.error(`Detailed Firebase Error in logSession:`, error);
    throw new Error(`Failed to log session. See server logs for details.`);
  }
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  ensureFirebaseIsOperational();
  try {
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionDocRef);
    if (sessionSnap.exists()) {
      const data = sessionSnap.data();
      return {
        id: sessionSnap.id,
        ...data,
        sessionDate: (data.sessionDate as Timestamp).toDate().toISOString(),
      } as Session;
    }
    return null;
  } catch (error: any) {
    console.error(`Detailed Firebase Error in getSessionById for sessionID ${sessionId}:`, error);
    throw new Error(`Failed to fetch session by ID ${sessionId}. See server logs for details.`);
  }
}

export async function updateSession(sessionId: string, updates: Partial<Omit<Session, 'id' | 'sessionDate'> & { sessionDate?: string | Date }>): Promise<void> {
  ensureFirebaseIsOperational();
  try {
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const updateData: any = { ...updates, updatedAt: serverTimestamp() };

    if (updates.sessionDate) {
      updateData.sessionDate = Timestamp.fromDate(new Date(updates.sessionDate));
    }

    await updateDoc(sessionDocRef, updateData);
  } catch (error: any) {
    console.error(`Detailed Firebase Error in updateSession for sessionID ${sessionId}:`, error);
    throw new Error(`Failed to update session ${sessionId}. See server logs for details.`);
  }
}

export async function getAllSessionsForAdmin(role: UserRole, companyId: string): Promise<Session[]> {
  ensureFirebaseIsOperational();
  try {
    const sessionsCol = collection(db, 'sessions');
    let q;

    const baseQueryConditions = [
        where('companyId', '==', companyId),
        where('isArchived', '==', false),
    ];

    if (role === 'admin') {
      // Admin sees sessions that are 'Under Review' or 'Denied' to approve/deny/dismiss them.
      q = query(sessionsCol, 
        ...baseQueryConditions,
        where('status', 'in', ['Under Review', 'Denied']),
        orderBy('sessionDate', 'desc')
      );
    } else if (role === 'super-admin') {
      // Super Admin sees 'Approved' or 'Billed' sessions to bill them or dismiss them.
      q = query(sessionsCol, 
        ...baseQueryConditions,
        where('status', 'in', ['Approved', 'Billed']),
        orderBy('sessionDate', 'desc')
      );
    } else {
      console.warn(`getAllSessionsForAdmin called with an invalid role: ${role}`);
      return [];
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(docData => {
      const data = docData.data();
      return {
        id: docData.id,
        ...data,
        sessionDate: (data.sessionDate as Timestamp).toDate().toISOString(),
      } as Session;
    });
  } catch (error: any) {
    console.error(`Detailed Firebase Error in getAllSessionsForAdmin:`, error);
     if (error.code === 'failed-precondition') {
      throw new Error(`Failed to fetch sessions for review. A Firestore index is required. Please check the browser's developer console for a link to create it.`);
    }
    throw new Error(`Failed to fetch all sessions for admin. See server logs for details.`);
  }
}

export async function getAllCoaches(companyId: string): Promise<UserProfile[]> {
  ensureFirebaseIsOperational();
  try {
    const usersCol = collection(db, 'users');
    // Query for all users in the company to avoid composite index.
    const q = query(usersCol, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }

    const coaches: UserProfile[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.role === 'coach') {
        let createdAtTimestamp: Timestamp;
        if (data.createdAt instanceof Timestamp) {
          createdAtTimestamp = data.createdAt;
        } else if (data.createdAt && typeof data.createdAt.seconds === 'number') {
          createdAtTimestamp = new Timestamp(data.createdAt.seconds, data.createdAt.nanoseconds);
        } else {
          createdAtTimestamp = Timestamp.now();
        }
        coaches.push({
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          role: 'coach',
          photoURL: data.photoURL || null,
          createdAt: createdAtTimestamp,
          companyId: data.companyId,
        } as UserProfile);
      }
    });

    // Perform sorting in code
    coaches.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return coaches;

  } catch (error: any) {
    console.error(`Detailed Firebase Error in getAllCoaches for company ${companyId}:`, error);
     if (error.code === 'failed-precondition') {
      throw new Error(`Failed to fetch coaches. A Firestore index is required. Please check the browser's developer console for a link to create it.`);
    }
    throw new Error(`Failed to fetch coaches. See server logs for details.`);
  }
}

export async function getCoachClients(coachId: string, companyId: string): Promise<UserProfile[]> {
  ensureFirebaseIsOperational();
  try {
    const usersCol = collection(db, 'users');
    // Query only by coachId to avoid needing a composite index on multiple fields.
    const q = query(usersCol, where('coachId', '==', coachId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }

    const clients: UserProfile[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Filter in-code for companyId and role.
      if (data.companyId === companyId && data.role === 'client') {
          let createdAtTimestamp: Timestamp;
          if (data.createdAt instanceof Timestamp) {
            createdAtTimestamp = data.createdAt;
          } else if (data.createdAt && typeof data.createdAt.seconds === 'number') {
            createdAtTimestamp = new Timestamp(data.createdAt.seconds, data.createdAt.nanoseconds);
          } else {
            createdAtTimestamp = Timestamp.now();
          }
          clients.push({
            uid: data.uid,
            email: data.email,
            displayName: data.displayName,
            role: 'client',
            photoURL: data.photoURL || null,
            createdAt: createdAtTimestamp,
            coachId: data.coachId,
            companyId: data.companyId,
          } as UserProfile);
      }
    });

    // Perform sorting in code
    clients.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return clients;

  } catch (error: any) {
    console.error(`Detailed Firebase Error in getCoachClients for coachID ${coachId}:`, error);
    if (error.code === 'failed-precondition') {
      console.error("This error likely means you need to create a composite index in Firestore. Check the browser console for a link to create it.");
      throw new Error(`Failed to fetch clients for coach ID ${coachId}. A Firestore index is required. Please check the browser's developer console for a link to create it.`);
    }
    throw new Error(`Failed to fetch clients for coach ID ${coachId}. See server logs for details.`);
  }
}


export async function getAllSessions(companyId: string): Promise<Session[]> {
  ensureFirebaseIsOperational();
  try {
    const sessionsCol = collection(db, 'sessions');
    const q = query(sessionsCol, where('companyId', '==', companyId), orderBy('sessionDate', 'desc'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(docData => {
      const data = docData.data();
      return {
        id: docData.id,
        ...data,
        sessionDate: (data.sessionDate as Timestamp).toDate().toISOString(),
      } as Session;
    });
  } catch (error: any)
{
    console.error(`Detailed Firebase Error in getAllSessions:`, error);
    if (error.code === 'failed-precondition') {
      throw new Error(`Failed to fetch all sessions. A Firestore index is required. Please check the browser's developer console for a link to create it.`);
    }
    throw new Error(`Failed to fetch all sessions. See server logs for details.`);
  }
}


export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  ensureFirebaseIsOperational();
  try {
    const companyDocRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyDocRef);
    if (companySnap.exists()) {
      return { id: companySnap.id, ...companySnap.data() } as CompanyProfile;
    }
    return null;
  } catch (error: any) {
    console.error(`[firestoreService] Error fetching company profile for companyId ${companyId}:`, error);
    throw new Error(`Failed to fetch company profile.`);
  }
}

export async function updateCompanyProfile(companyId: string, updates: Partial<CompanyProfile>): Promise<void> {
  ensureFirebaseIsOperational();
  try {
    const companyDocRef = doc(db, 'companies', companyId);
    await updateDoc(companyDocRef, updates);
  } catch (error: any) {
    console.error(`[firestoreService] Error updating company profile for companyId ${companyId}:`, error);
    throw new Error(`Failed to update company profile.`);
  }
}
