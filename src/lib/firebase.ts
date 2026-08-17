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
  apiKey: "AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg",
  authDomain: "studio-9153973571-7837c.firebaseapp.com",
  projectId: "studio-9153973571-7837c",
  storageBucket: "studio-9153973571-7837c.appspot.com",
  messagingSenderId: "450357468060",
  appId: "1:450357468060:web:9987ff7b76682415ed8659"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
let _db: Firestore | null = null;
function getDbInstance(): Firestore {
  if (!_db) {
    _db = getFirestore(app);
  }
  return _db;
}

const db = new Proxy({} as Firestore, {
  get(target, prop, receiver) {
    const realDb = getDbInstance();
    const value = Reflect.get(realDb, prop);
    return typeof value === 'function' ? value.bind(realDb) : value;
  },
  getPrototypeOf(target) {
    return Object.getPrototypeOf(getDbInstance());
  }
});

const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Client-side 인증 유지 설정
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence);
}

export function getDb(): Firestore {
  return getDbInstance();
}

export { app, db, auth, storage, googleProvider };
