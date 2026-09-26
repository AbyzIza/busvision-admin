import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, Database } from 'firebase/database';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  Auth
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyDnM0oaLCnTsy69idzQaF0ZfcYcEMvRr-k",
  authDomain: "busvision-ai.firebaseapp.com",
  databaseURL: "https://busvision-ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "busvision-ai",
  storageBucket: "busvision-ai.firebasestorage.app",
  messagingSenderId: "472036250826",
  appId: "1:472036250826:web:f917b9a576fe1a74b9d033",
  measurementId: "G-DF32WV8773"
};

// 1. Initialize Firebase & Services
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const database: Database = getDatabase(app);
export const db: Database = database;
export const auth: Auth = getAuth(app);

// 2. Configure Google Auth Provider with forced account selector
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in with Google Popup.
 * Forced `prompt: 'select_account'` ensures the Google account picker is always shown.
 */
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Sign in with Email and Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
}

/**
 * Register new user with Email, Password and optional Display Name
 */
export async function registerWithEmail(
  email: string, 
  pass: string, 
  displayName?: string
): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && displayName.trim()) {
    await updateProfile(result.user, {
      displayName: displayName.trim()
    });
  }
  return result.user;
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Send password reset email
 */
export async function sendResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Format Firebase Auth errors into clear, friendly Russian messages
 */
export function formatAuthError(error: unknown): string {
  if (!error) return 'Произошла непредвиденная ошибка авторизации.';
  const code = (error as { code?: string })?.code || '';
  const msg = (error as Error)?.message || String(error);

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Окно авторизации Google было закрыто до выбора аккаунта.';
    case 'auth/cancelled-popup-request':
      return 'Предыдущий запрос авторизации был отменен.';
    case 'auth/popup-blocked':
      return 'Всплывающее окно входа Google заблокировано браузером. Разрешите всплывающие окна в адресной строке.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Неверный email или пароль. Проверьте введенные данные.';
    case 'auth/user-not-found':
      return 'Пользователь с таким email не найден. Проверьте адрес или зарегистрируйтесь.';
    case 'auth/email-already-in-use':
      return 'Этот адрес электронной почты уже зарегистрирован. Переключитесь на вкладку «Вход».';
    case 'auth/weak-password':
      return 'Пароль слишком короткий. Используйте не менее 6 символов.';
    case 'auth/invalid-email':
      return 'Некорректный формат адреса электронной почты.';
    case 'auth/network-request-failed':
      return 'Ошибка сети. Проверьте интернет-соединение.';
    case 'auth/unauthorized-domain':
      return 'Домен приложения не внесен в список разрешенных в консоли Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Данный способ входа не активирован в консоли Firebase.';
    case 'auth/too-many-requests':
      return 'Слишком много попыток входа. Пожалуйста, подождите пару минут.';
    default:
      if (msg.toLowerCase().includes('popup')) {
        return 'Окно авторизации Google закрыто или заблокировано браузером.';
      }
      return msg;
  }
}

/**
 * Sends the current passenger occupancy count to Firebase Realtime Database
 * at path `bus/42/occupancy`.
 */
export function syncOccupancyToFirebase(occupancy: number): Promise<void> {
  const occupancyRef = ref(database, 'bus/42/occupancy');
  return set(occupancyRef, occupancy);
}

/**
 * Sends real-time GPS coordinates of the bus to Firebase Realtime Database
 * at path `bus/42/location`.
 */
export async function syncLocationToFirebase(
  lat: number, 
  lng: number, 
  extra?: { speed?: number | null; heading?: number | null; timestamp?: number }
): Promise<void> {
  try {
    const locationRef = ref(database, 'bus/42/location');
    await set(locationRef, {
      lat,
      lng,
      timestamp: extra?.timestamp || Date.now(),
      ...(extra?.speed != null ? { speed: extra.speed } : {}),
      ...(extra?.heading != null ? { heading: extra.heading } : {})
    });
  } catch (error) {
    console.error('Firebase sync error for bus/42/location:', error);
  }
}


export async function updateStopWaitingCount(count: number): Promise<void> {
  try {
    const stopRef = ref(database, 'stops/trk_aktau/waitingCount');
    await set(stopRef, Math.max(0, count));
  } catch (error) {
    console.error('Firebase sync error for stops/trk_aktau/waitingCount:', error);
  }
}

/**
 * Subscribes to Firebase Realtime Database connection status via `.info/connected`.
 */
export function subscribeToFirebaseConnection(
  onStatusChange: (isConnected: boolean) => void
): () => void {
  try {
    const connectedRef = ref(database, '.info/connected');
    const unsubscribe = onValue(
      connectedRef,
      (snap) => {
        const isConnected = snap.val() === true;
        onStatusChange(isConnected);
      },
      (error) => {
        console.warn('Firebase connection listener warning:', error);
        onStatusChange(false);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Failed to subscribe to .info/connected:', error);
    return () => {};
  }
}
