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

// 부서 매칭 사전
const aliasMap = {
  '교무': '교무기획부',
  '교무기획': '교무기획부',
  '교무부': '교무기획부',
  '기획': '교무기획부',
  '예체능': '예체능방과후부',
  '방과후': '예체능방과후부',
  '예체능방과후부': '예체능방과후부',
  '방과후부': '예체능방과후부',
  '수업': '수업연구부',
  '연구': '수업연구부',
  '수업연구': '수업연구부',
  '수업연구부': '수업연구부',
  '교육과정': '교육과정기획부',
  '교육과정기획': '교육과정기획부',
  '영어': '영어교육부',
  '영어교육': '영어교육부',
  '영어교육부': '영어교육부',
  '생활': '자치생활부',
  '자치': '자치생활부',
  '생활지도': '자치생활부',
  '자치생활부': '자치생활부',
  '다문화': '다문화교육부',
  '다문화교육': '다문화교육부',
  '다문화부': '다문화교육부',
  '다문화교육부': '다문화교육부',
  'AI': 'AI융합교육부',
  '정보': 'AI융합교육부',
  '인공지능': 'AI융합교육부',
  'AI융합교육부': 'AI융합교육부',
};

async function syncNow() {
  const orgRef = db.collection('settings').doc('orgStructure');
  const orgSnap = await orgRef.get();
  const org = orgSnap.data() || {};

  const usersSnap = await db.collection('users').get();
  let syncCount = 0;

  org.departments = org.departments || [];
  org.gradeSubjects = org.gradeSubjects || {};
  org.gradeHeads = org.gradeHeads || {};
  org.homerooms = org.homerooms || {};

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    if (!u.email) return;
    if (u.studentName || u.role === '학부모' || u.role === 'student' || u.role === 'parent') return;
    if (/^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email)) return;

    const email = u.email.toLowerCase().trim();
    const role = u.role || '교사';
    const grade = u.grade ? String(u.grade).trim() : '';
    const dept = u.dept ? String(u.dept).trim() : '';

    // 1. 부서 동기화
    if (dept) {
      const targetDeptName = aliasMap[dept] || dept;
      let targetDept = org.departments.find(d => d.name === targetDeptName);
      if (!targetDept) {
        targetDept = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
          name: targetDeptName,
          headEmail: null,
          memberEmails: [],
        };
        org.departments.push(targetDept);
      }
      targetDept.memberEmails = targetDept.memberEmails || [];
      if (!targetDept.memberEmails.includes(email)) {
        targetDept.memberEmails.push(email);
        console.log(`[Sync] ${u.name}(${email}) -> 부서 [${targetDeptName}] 추가`);
        syncCount++;
      }
      if (role.includes('부장') && !role.includes('학년') && !targetDept.headEmail) {
        targetDept.headEmail = email;
      }
    }

    // 2. 학년 동기화
    if (grade) {
      const gNumMatch = grade.match(/[1-6]/);
      if (gNumMatch) {
        const gNum = gNumMatch[0];
        org.gradeSubjects[gNum] = org.gradeSubjects[gNum] || [];
        if (!org.gradeSubjects[gNum].includes(email)) {
          org.gradeSubjects[gNum].push(email);
          console.log(`[Sync] ${u.name}(${email}) -> 학년 [${gNum}학년] 교과/소속 추가`);
          syncCount++;
        }

        if (role.includes('부장') || role.includes('학년부장')) {
          if (!org.gradeHeads[gNum]) {
            org.gradeHeads[gNum] = email;
            org.gradeHeads[`${gNum}학년`] = email;
            syncCount++;
          }
        }
      }
    }
  });

  if (syncCount > 0) {
    await orgRef.set(org, { merge: true });
    console.log(`\nSuccessfully synced ${syncCount} assignments to Firestore settings/orgStructure!`);
  } else {
    console.log("\nAll users already synced.");
  }
}

syncNow().catch(console.error);
