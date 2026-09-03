import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';

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

async function checkStatus() {
  const [userSnap, masterSnap, recSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('photoUrl', '!=', null))),
    getDocs(query(collection(db, 'master_students'), where('photoUrl', '!=', null))),
    getDocs(collection(db, 'pe_schools', 'KISH', 'records')),
  ]);

  console.log(`Users with photoUrl: ${userSnap.docs.length}`);
  console.log(`Master students with photoUrl: ${masterSnap.docs.length}`);
  
  let unifiedRecCount = 0;
  let uuidRecCount = 0;
  recSnap.docs.forEach(d => {
    const sId = d.data().studentId || '';
    if (sId.includes('@')) unifiedRecCount++;
    else uuidRecCount++;
  });

  console.log(`Total Records: ${recSnap.docs.length}`);
  console.log(`Records with unified studentId (email): ${unifiedRecCount}`);
  console.log(`Records with UUID studentId: ${uuidRecCount}`);
  
  process.exit(0);
}

checkStatus().catch(console.error);
