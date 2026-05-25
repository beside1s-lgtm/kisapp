import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore,
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Next.js의 Hot Reloading 시 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firestore 연결 문제 해결을 위해 experimentalForceLongPolling 활성화
// Client-side에서만 특수 설정을 적용하고, 중복 초기화를 방지합니다.
let db: Firestore;
if (typeof window !== "undefined") {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalForceLongPolling: true,
    });
  } catch (e) {
    // 이미 초기화된 경우 기존 인스턴스를 가져옵니다.
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Client-side 인증 유지 설정
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence);
}

export { app, db, auth, storage, googleProvider };
