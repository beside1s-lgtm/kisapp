import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("FirestoreConfig ProjectId:", firebaseConfig.projectId);
  const q = query(collection(db, "users"), where("role", "==", "학부모"), limit(10));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("학부모 유저가 없습니다. 모든 유저 상위 5개를 출력합니다:");
    const allSnap = await getDocs(query(collection(db, "users"), limit(5)));
    allSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } else {
    snap.forEach(doc => {
      console.log("학부모 계정:", doc.id, "=> email:", doc.data().email, "name:", doc.data().name);
    });
  }
}

run().catch(console.error);
