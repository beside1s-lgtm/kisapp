import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const portalConfig = {
  apiKey: "AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg",
  authDomain: "studio-9153973571-7837c.firebaseapp.com",
  projectId: "studio-9153973571-7837c",
  storageBucket: "studio-9153973571-7837c.appspot.com",
  messagingSenderId: "450357468060",
  appId: "1:450357468060:web:9987ff7b76682415ed8659"
};

const kisbusConfig = {
  apiKey: "AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w",
  authDomain: "studio-8176556433-7698a.firebaseapp.com",
  projectId: "studio-8176556433-7698a",
  storageBucket: "studio-8176556433-7698a.firebasestorage.app",
  messagingSenderId: "89517826209",
  appId: "1:89517826209:web:37c6d9f5cb30a03e1850e0"
};

const portalDb = getFirestore(initializeApp(portalConfig, 'p_siu'));
const busDb = getFirestore(initializeApp(kisbusConfig, 'b_siu'));

async function checkSiu() {
  console.log("=== 포털 수강신청 정시우 문서 ===");
  const eSnap = await getDoc(doc(portalDb, 'afterschool_enrollments', 'e_bulk_1787644951186_163_wwy6'));
  console.log("수강신청 원본:", JSON.stringify(eSnap.data(), null, 2));

  console.log("\n=== 스쿨버스 정시우 학생 ===");
  const sSnap = await getDocs(collection(busDb, 'students'));
  sSnap.forEach(d => {
    const s = d.data();
    if ((s.name && s.name.includes('Si U')) || (s.nameKo && s.nameKo.includes('시우'))) {
      console.log(`학생 ID: ${d.id}, name: ${s.name}, nameKo: ${s.nameKo}, grade: ${s.grade}, class: ${s.class}`);
    }
  });

  process.exit(0);
}

checkSiu().catch(e => {
  console.error(e);
  process.exit(1);
});
