import { getDb } from '../src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function main() {
  const db = getDb();
  const allUsersSnap = await getDocs(collection(db, 'users'));
  console.log(`Searching across ${allUsersSnap.docs.length} users...`);
  for (const d of allUsersSnap.docs) {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    const id = d.id.toLowerCase();
    if (str.includes('tram') || id.includes('tram') || str.includes('kimhoa') || id.includes('kimhoa')) {
      console.log(`[USER MATCH] id: ${d.id}`, JSON.stringify(data, null, 2));
    }
  }

  const allMasterSnap = await getDocs(collection(db, 'master_students'));
  console.log(`Searching across ${allMasterSnap.docs.length} master students...`);
  for (const d of allMasterSnap.docs) {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    const id = d.id.toLowerCase();
    if (str.includes('tram') || id.includes('tram') || str.includes('kimhoa') || id.includes('kimhoa')) {
      console.log(`[MASTER MATCH] id: ${d.id}`, JSON.stringify(data, null, 2));
    }
  }

  const { getKisbusDb } = await import('../src/lib/kisbus/firebase');
  const busDb = getKisbusDb();
  const busSnap = await getDocs(collection(busDb, 'students'));
  console.log(`Searching across ${busSnap.docs.length} bus students...`);
  for (const d of busSnap.docs) {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    const id = d.id.toLowerCase();
    if (str.includes('tram') || id.includes('tram') || str.includes('kimhoa') || id.includes('kimhoa')) {
      console.log(`[BUS MATCH] id: ${d.id}`, JSON.stringify(data, null, 2));
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
