import { getDb } from '../src/lib/firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

async function main() {
  const db = getDb();
  const emails = ['2023kangdongyun@kshcm.net', '2021tram@kshcm.net', '2021kimhoa@kshcm.net'];

  console.log('--- USERS BY DOC ID ---');
  for (const email of emails) {
    const snap = await getDoc(doc(db, 'users', email));
    if (snap.exists()) {
      console.log(`[users doc] ${email}:`, snap.data());
    } else {
      console.log(`[users doc] ${email} DOES NOT EXIST`);
    }
  }

  const allUsersSnap = await getDocs(collection(db, 'users'));
  console.log(`\nTotal users in 'users' collection: ${allUsersSnap.docs.length}`);
  allUsersSnap.docs.forEach(d => {
    const data = d.data();
    const id = d.id.toLowerCase();
    const email = (data.email || '').toLowerCase();
    if (id.includes('tram') || id.includes('hoa') || email.includes('tram') || email.includes('hoa')) {
      console.log(`[found user match] docId: ${d.id}`, data);
    }
  });

  const allMasterSnap = await getDocs(collection(db, 'master_students'));
  console.log(`\nTotal in 'master_students': ${allMasterSnap.docs.length}`);
  allMasterSnap.docs.forEach(d => {
    const data = d.data();
    const id = d.id.toLowerCase();
    const email = (data.studentEmail || '').toLowerCase();
    if (id.includes('tram') || id.includes('hoa') || email.includes('tram') || email.includes('hoa')) {
      console.log(`[found master match] docId: ${d.id}`, data);
    }
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
