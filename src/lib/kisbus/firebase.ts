import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

const kisbusConfig = {
  apiKey: "AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w",
  authDomain: "studio-8176556433-7698a.firebaseapp.com",
  projectId: "studio-8176556433-7698a",
  storageBucket: "studio-8176556433-7698a.firebasestorage.app",
  messagingSenderId: "89517826209",
  appId: "1:89517826209:web:37c6d9f5cb30a03e1850e0"
};

// 'kisbus'라는 이름의 Secondary App으로 초기화하여 중복 초기화 방지
const kisbusApp = getApps().find(app => app.name === 'kisbus') 
  ? getApp('kisbus') 
  : initializeApp(kisbusConfig, 'kisbus');

let kisbusDb: any;
try {
  kisbusDb = getFirestore(kisbusApp);
} catch (e) {
  console.error("Failed to initialize kisbusDb, falling back to default db:", e);
  kisbusDb = getDb();
}

export function getKisbusDb() {
  return kisbusDb;
}

export { kisbusApp, kisbusDb };
