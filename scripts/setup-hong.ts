import { getDb } from '../src/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function main() {
  const db = getDb();
  const email = '2026hong@kshcm.net';
  const dummySig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAALklEQVR42u3BAQEAMAyAMLL/6e1aEwAAAAAAAAAAAAAA4M9qEgAAAAAAAAAAAACAPxf80gH1E+YQ/gAAAABJRU5ErkJggg==';

  // SHA-256 for 1234
  const hashedPin = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

  await setDoc(doc(db, 'users', email), {
    email,
    role: '학부모',
    name: '홍부모',
    parentName: '홍부모',
    parentRelation: '모',
    studentName: '홍길동',
    studentGrade: '4',
    studentClass: '4',
    studentNumber: '2',
    parentPhone: '010-1234-5678',
    parentPinHash: hashedPin,
    hashedPin: hashedPin,
    signature: dummySig,
    parentSignature: dummySig,
    isAdmin: false,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log('Successfully set up 2026hong@kshcm.net profile in Firestore');
  process.exit(0);
}

main().catch(console.error);
