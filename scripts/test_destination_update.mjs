import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

const kisbusConfig = {
  apiKey: "AIzaSyD98EXwu0qawhpLkL8fMe1erS5aBpXzv8w",
  authDomain: "studio-8176556433-7698a.firebaseapp.com",
  projectId: "studio-8176556433-7698a",
  storageBucket: "studio-8176556433-7698a.firebasestorage.app",
  messagingSenderId: "89517826209",
  appId: "1:89517826209:web:37c6d9f5cb30a03e1850e0"
};

const app = initializeApp(kisbusConfig, 'test_kisbus');
const busDb = getFirestore(app);

async function testDestinationUpdate() {
  console.log("=== Kisbus 방과후 요일별 목적지 보존 검증 시작 ===");

  const snap = await getDocs(collection(busDb, 'students'));
  if (snap.empty) {
    console.log("students 컬렉션이 비어있습니다.");
    return;
  }

  const studentDoc = snap.docs[0];
  const studentId = studentDoc.id;
  const originalData = studentDoc.data();
  console.log(`테스트 학생: ${originalData.name || studentId} (ID: ${studentId})`);

  const originalAfterSchoolDests = originalData.afterSchoolDestinations || {};
  console.log("기존 목적지:", originalAfterSchoolDests);

  const studentRef = doc(busDb, 'students', studentId);

  try {
    // 1. 월요일 목적지 설정
    const testDestMon = "DEST_MON_TEST";
    const update1 = {
      afterSchoolDestinations: {
        ...originalAfterSchoolDests,
        Monday: testDestMon
      }
    };
    await updateDoc(studentRef, update1);
    console.log("1단계: 월요일 목적지 저장 완료 -> Monday:", testDestMon);

    // 2. 수요일 목적지 설정 (최신 데이터 읽어서 머지)
    const snap2 = await getDoc(studentRef);
    const data2 = snap2.data();
    const currentDests = data2.afterSchoolDestinations || {};

    const testDestWed = "DEST_WED_TEST";
    const update2 = {
      afterSchoolDestinations: {
        ...currentDests,
        Wednesday: testDestWed
      }
    };
    await updateDoc(studentRef, update2);
    console.log("2단계: 수요일 목적지 저장 완료 -> Wednesday:", testDestWed);

    // 3. 최종 검증
    const finalSnap = await getDoc(studentRef);
    const finalDests = finalSnap.data().afterSchoolDestinations || {};
    console.log("최종 저장된 목적지 맵:", finalDests);

    const monOk = finalDests.Monday === testDestMon;
    const wedOk = finalDests.Wednesday === testDestWed;

    if (monOk && wedOk) {
      console.log("SUCCESS: 월요일과 수요일 목적지가 둘 다 보존되었습니다! (상호 덮어쓰기 없음)");
    } else {
      console.error("FAILURE: 목적지 보존 실패!", finalDests);
    }

    // 4. 롤백
    await updateDoc(studentRef, {
      afterSchoolDestinations: originalAfterSchoolDests
    });
    console.log("원래 데이터로 롤백 완료.");

  } catch (err) {
    console.error("테스트 실패:", err);
    await updateDoc(studentRef, {
      afterSchoolDestinations: originalAfterSchoolDests
    }).catch(() => {});
  }

  console.log("=== Kisbus 방과후 요일별 목적지 보존 검증 완료 ===");
  process.exit(0);
}

testDestinationUpdate().catch(console.error);
