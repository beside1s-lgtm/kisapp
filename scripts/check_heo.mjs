import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const kisbusConfig = {
  apiKey: "AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w",
  authDomain: "studio-8176556433-7698a.firebaseapp.com",
  projectId: "studio-8176556433-7698a",
  storageBucket: "studio-8176556433-7698a.firebasestorage.app",
  messagingSenderId: "89517826209",
  appId: "1:89517826209:web:37c6d9f5cb30a03e1850e0"
};

const busDb = getFirestore(initializeApp(kisbusConfig, 'b_heo'));

async function checkHeo() {
  const snap = await getDocs(collection(busDb, 'students'));
  snap.forEach(d => {
    const s = d.data();
    const str = `${s.name || ''} ${s.nameKo || ''} ${s.nameEn || ''}`;
    if (str.includes('민희') || str.includes('Min Hee') || str.includes('Minhee')) {
      console.log(`[허민희] ID: ${d.id}, 이름: ${s.name} / ${s.nameKo} / ${s.nameEn}, ${s.grade}-${s.class || s.classNum}`);
      console.log(`  afternoonDestinationId: ${s.afternoonDestinationId}`);
      console.log(`  afterSchoolDestinations:`, JSON.stringify(s.afterSchoolDestinations));
      console.log(`  afterSchoolClassIds:`, JSON.stringify(s.afterSchoolClassIds));
    }
  });

  process.exit(0);
}

checkHeo().catch(e => {
  console.error(e);
  process.exit(1);
});
