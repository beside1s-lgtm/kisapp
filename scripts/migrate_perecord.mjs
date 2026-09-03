import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const sourceConfig = {
  apiKey: "AIzaSyD5V6d1MpFbIW5ozmG3szfWmlUlFobX6TA",
  authDomain: "studio-64590200-ecf64.firebaseapp.com",
  projectId: "studio-64590200-ecf64",
  storageBucket: "studio-64590200-ecf64.appspot.com",
  messagingSenderId: "553627204820",
  appId: "1:553627204820:web:d23ec083b4b57ba82c9e54"
};

const targetConfig = {
  apiKey: "AIzaSyDIG0l-il8rggQEBWK6rUFwFs0oFcNGkrg",
  authDomain: "studio-9153973571-7837c.firebaseapp.com",
  projectId: "studio-9153973571-7837c",
  storageBucket: "studio-9153973571-7837c.appspot.com",
  messagingSenderId: "450357468060",
  appId: "1:450357468060:web:9987ff7b76682415ed8659"
};

const sourceApp = initializeApp(sourceConfig, 'source');
const targetApp = initializeApp(targetConfig, 'target');

const sourceAuth = getAuth(sourceApp);
const sourceDb = getFirestore(sourceApp);
const targetDb = getFirestore(targetApp);

async function migrate() {
  console.log('=== [0] Anonymous Sign-in to Source DB (perecord) ===');
  try {
    const cred = await signInAnonymously(sourceAuth);
    console.log('Successfully signed in anonymously to perecord! UID:', cred.user.uid);
  } catch (err) {
    console.warn('Anonymous sign-in warning (proceeding):', err.message);
  }

  console.log('\n=== [1] Testing Reading from Source DB (perecord) ===');
  let sourceDocs = [];
  try {
    const snap = await getDocs(collection(sourceDb, 'schools'));
    console.log(`Successfully read ${snap.docs.length} schools from source DB!`);
    sourceDocs = snap.docs;
  } catch (err) {
    console.error('FAILED reading from sourceDb (perecord):', err);
    return;
  }

  console.log('\n=== [2] Testing Writing to Target DB (kisapp) ===');
  try {
    for (const sDoc of sourceDocs) {
      if (sDoc.id === '호치민') {
        const sData = sDoc.data();
        await setDoc(doc(targetDb, 'pe_schools', 'KISH'), { ...sData, id: 'KISH', name: '호치민' }, { merge: true });
        await setDoc(doc(targetDb, 'pe_schools', '호치민'), sData, { merge: true });
        console.log('Successfully written school metadata to target DB!');
      }
    }
  } catch (err) {
    console.error('FAILED writing to targetDb (kisapp):', err);
    return;
  }

  const collectionsToMigrate = [
    'items',
    'records',
    'teamGroups',
    'sportsClubs',
    'quizzes',
    'quizAssignments',
    'quizResults',
    'statistics'
  ];

  for (const colName of collectionsToMigrate) {
    console.log(`\n=== Migrating collection: ${colName} ===`);
    try {
      const colSnap = await getDocs(collection(sourceDb, 'schools', '호치민', colName));
      console.log(`Found ${colSnap.docs.length} documents in ${colName}`);
      
      let batch = writeBatch(targetDb);
      let count = 0;
      let batchCount = 0;

      for (const d of colSnap.docs) {
        const data = d.data();
        const targetRef = doc(targetDb, 'pe_schools', 'KISH', colName, d.id);
        batch.set(targetRef, { ...data, school: 'KISH' }, { merge: true });
        count++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(targetDb);
          batchCount = 0;
          console.log(`Committed batch of 400 (${count}/${colSnap.docs.length})`);
        }
      }
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed remaining batch (${count}/${colSnap.docs.length})`);
      }
    } catch (err) {
      console.error(`Error migrating collection ${colName}:`, err);
    }
  }

  console.log('\n=== [3] Migrating Student Photos & Health Info to master_students ===');
  try {
    const studentSnap = await getDocs(collection(sourceDb, 'schools', '호치민', 'students'));
    console.log(`Found ${studentSnap.docs.length} students in perecord`);

    let studentBatch = writeBatch(targetDb);
    let sCount = 0;
    let sBatchCount = 0;

    for (const sDoc of studentSnap.docs) {
      const sData = sDoc.data();
      const targetRef = doc(targetDb, 'pe_schools', 'KISH', 'students', sDoc.id);
      studentBatch.set(targetRef, { ...sData, school: 'KISH' }, { merge: true });

      if (sData.photoUrl || sData.name) {
        const masterRef = doc(targetDb, 'master_students', sDoc.id);
        const updatePayload = {};
        if (sData.photoUrl) updatePayload.photoUrl = sData.photoUrl;
        if (sData.gender) updatePayload.gender = (sData.gender === 'female' || sData.gender === '여') ? 'Female' : 'Male';
        if (sData.accessCode) updatePayload.studentCode = sData.accessCode;

        if (Object.keys(updatePayload).length > 0) {
          studentBatch.set(masterRef, updatePayload, { merge: true });
        }
      }

      sCount++;
      sBatchCount++;
      if (sBatchCount >= 200) {
        await studentBatch.commit();
        studentBatch = writeBatch(targetDb);
        sBatchCount = 0;
        console.log(`Committed student batch (${sCount}/${studentSnap.docs.length})`);
      }
    }

    if (sBatchCount > 0) {
      await studentBatch.commit();
      console.log(`Committed final student batch (${sCount}/${studentSnap.docs.length})`);
    }
  } catch (err) {
    console.error('Error migrating students:', err);
  }

  console.log('\nAll PE data migration process completed successfully!');
  process.exit(0);
}

migrate().catch(console.error);
