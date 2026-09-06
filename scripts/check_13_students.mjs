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

const portalDb = getFirestore(initializeApp(portalConfig, 'portal3'));
const busDb = getFirestore(initializeApp(kisbusConfig, 'bus3'));

async function check13() {
  const ids = [
    'c3El5xMtryRMe7PFA8V0', 'CUhtYG10rALV873mTcCF', '82dw45PaaQfh28N2BSN0',
    'E89TKbckHVYmpLmiDEmq', 'pyHAlqy619dA825cmbFD', 'UQJZgCtNTR9bg4DqaxP3',
    'daWq6fFMEp4kmaeKGM2b', 'T37JKtxBToK9rH0G4d4A', 'vIbrvmWWIDtj3IpjIKLn',
    'SjWM1d7HHUaCYpQse1sF', 'QEmb64vJh1J6hyd7m8tF', 'M1wMUhqYproYRHAZeCFT',
    'IF7roRGgrRH2UKUW5xMO'
  ];

  for (const id of ids) {
    const sSnap = await getDoc(doc(busDb, 'students', id));
    const s = sSnap.data();
    console.log(`\n-----------------------------------------`);
    console.log(`[${s.grade}-${s.class}] ${s.name || s.nameKo} (ID: ${id})`);
    console.log(`  afternoonDestinationId: ${s.afternoonDestinationId}`);
    console.log(`  afterSchoolDestinations:`, JSON.stringify(s.afterSchoolDestinations));
    console.log(`  afterSchoolClassIds:`, JSON.stringify(s.afterSchoolClassIds));
  }

  process.exit(0);
}

check13().catch(e => {
  console.error(e);
  process.exit(1);
});
