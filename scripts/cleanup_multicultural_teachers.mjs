import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || 'studio-9153973571-7837c',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function run() {
  console.log("=== 다문화교육부 교직원 계정 정리 시작 ===");

  // 1. users/2021kimhoa (도메인 누락 계정) 삭제
  const badKimhoaRef = db.collection('users').doc('2021kimhoa');
  const badKimhoaSnap = await badKimhoaRef.get();
  if (badKimhoaSnap.exists) {
    console.log("발견: users/2021kimhoa -> 삭제 진행");
    await badKimhoaRef.delete();
    console.log("완료: users/2021kimhoa 삭제됨");
  } else {
    console.log("확인: users/2021kimhoa 존재하지 않음");
  }

  // 2. users/2021kimhoa@kshcm.net 보정
  const kimhoaRef = db.collection('users').doc('2021kimhoa@kshcm.net');
  await kimhoaRef.set({
    email: '2021kimhoa@kshcm.net',
    name: 'hoa',
    role: '교사',
    dept: '다문화교육부',
    isFaculty: true,
    isStaff: true,
    isManualFaculty: true,
    registrationSource: 'manual_faculty',
    grade: '',
  }, { merge: true });
  console.log("완료: users/2021kimhoa@kshcm.net 교직원 정보 업데이트");

  // 3. users/2021tram@kshcm.net 보정
  const tramRef = db.collection('users').doc('2021tram@kshcm.net');
  await tramRef.set({
    email: '2021tram@kshcm.net',
    name: 'Tram',
    role: '교사',
    dept: '다문화교육부',
    isFaculty: true,
    isStaff: true,
    isManualFaculty: true,
    registrationSource: 'manual_faculty',
    grade: '',
  }, { merge: true });
  console.log("완료: users/2021tram@kshcm.net 교직원 정보 업데이트");

  // 4. settings/orgStructure 에서 2021kimhoa 제거 및 올바른 이메일 보장
  const orgRef = db.collection('settings').doc('orgStructure');
  const orgSnap = await orgRef.get();
  if (orgSnap.exists) {
    const org = orgSnap.data();
    let changed = false;
    const depts = (org.departments || []).map(d => {
      if (d.name === '다문화교육부') {
        const cleanedMembers = Array.from(
          new Set(
            (d.memberEmails || [])
              .filter(e => e !== '2021kimhoa')
              .concat(['2021kimhoa@kshcm.net', '2021tram@kshcm.net'])
          )
        );
        console.log("다문화교육부 정리된 멤버 목록:", cleanedMembers);
        changed = true;
        return { ...d, memberEmails: cleanedMembers };
      }
      return d;
    });

    if (changed) {
      await orgRef.update({ departments: depts });
      console.log("완료: orgStructure 다문화교육부 부서원 목록 업데이트");
    }
  }

  console.log("=== 정리 완료 ===");
}

run().catch(console.error);
