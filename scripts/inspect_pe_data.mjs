import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

const targetConfig = {
  apiKey: "AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg",
  authDomain: "studio-9153973571-7837c.firebaseapp.com",
  projectId: "studio-9153973571-7837c",
  storageBucket: "studio-9153973571-7837c.appspot.com",
  messagingSenderId: "450357468060",
  appId: "1:450357468060:web:9987ff7b76682415ed8659"
};

const app = initializeApp(targetConfig);
const db = getFirestore(app);

async function inspect() {
  const peDoc = await getDoc(doc(db, 'pe_schools', 'KISH', 'students', 'cf3231ae-3439-43d7-99cc-5d9f20e4919d'));
  console.log('PE Student cf3231ae (강수빈):', peDoc.data());

  const recSnap = await getDocs(query(collection(db, 'pe_schools', 'KISH', 'records'), where('studentId', '==', 'cf3231ae-3439-43d7-99cc-5d9f20e4919d')));
  console.log(`PE Records for 강수빈: ${recSnap.docs.length} records`);
  recSnap.docs.forEach(d => console.log(d.id, d.data()));

  const masterSnap = await getDocs(query(collection(db, 'master_students'), where('name', '==', '강수빈')));
  console.log(`Master students named 강수빈: ${masterSnap.docs.length}`);
  masterSnap.docs.forEach(d => console.log(d.id, d.data()));

  const userSnap = await getDocs(query(collection(db, 'users'), where('studentName', '==', '강수빈')));
  console.log(`Users named 강수빈: ${userSnap.docs.length}`);
  userSnap.docs.forEach(d => console.log(d.id, d.data()));

  process.exit(0);
}

inspect().catch(console.error);
