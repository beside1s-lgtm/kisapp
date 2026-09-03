import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

async function checkKangSoobin() {
  const userDoc = await getDoc(doc(db, 'users', '2022kangsoobin@kshcm.net'));
  console.log('User 2022kangsoobin:', userDoc.data());

  const masterDoc = await getDoc(doc(db, 'master_students', '2022kangsoobin@kshcm.net'));
  console.log('MasterStudent 2022kangsoobin@kshcm.net:', masterDoc.data());

  const peDoc = await getDoc(doc(db, 'pe_schools', 'KISH', 'students', 'cf3231ae-3439-43d7-99cc-5d9f20e4919d'));
  console.log('PE Student cf3231ae (강수빈):', peDoc.data()?.name, peDoc.data()?.photoUrl ? 'Has photo' : 'No photo');

  process.exit(0);
}

checkKangSoobin().catch(console.error);
