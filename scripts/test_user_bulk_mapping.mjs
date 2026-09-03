import { normalizeGrade, resolveDepartment } from '../src/lib/services/userService.ts';

const existingDepts = [
  { id: '1', name: '교무기획부', headEmail: null, memberEmails: [] },
  { id: '2', name: '예체능방과후부', headEmail: null, memberEmails: [] },
  { id: '3', name: '수업연구부', headEmail: null, memberEmails: [] },
  { id: '4', name: '교육과정기획부', headEmail: null, memberEmails: [] },
  { id: '5', name: '영어교육부', headEmail: null, memberEmails: [] },
  { id: '6', name: '자치생활부', headEmail: null, memberEmails: [] },
  { id: '7', name: '다문화교육부', headEmail: null, memberEmails: [] },
  { id: '8', name: 'AI융합교육부', headEmail: null, memberEmails: [] },
];

console.log("=== 학년 정규화 테스트 ===");
const gradeTestCases = ['3학년', '3학년부', '3', '초등3', '3-1', '1', '1학년', '6학년부', '', null];
for (const tc of gradeTestCases) {
  const res = normalizeGrade(tc);
  console.log(`입력: "${tc}" -> 결과:`, res ? `${res.gradeNumber} (${res.gradeName})` : 'null');
}

console.log("\n=== 부서 스마트 매칭 테스트 ===");
const deptTestCases = [
  '교무', '교무기획', '교무부', '기획',
  '예체능', '방과후', '예체능방과후부', '방과후부',
  '연구', '수업', '수업연구부',
  '교육과정', '교육과정기획',
  '영어', '영어교육부',
  '생활', '자치', '생활지도', '자치생활부',
  '다문화', '다문화부',
  'AI', '정보', '인공지능', 'AI융합교육부',
  '미래혁신부', '새로운부서'
];

for (const tc of deptTestCases) {
  const res = resolveDepartment(tc, existingDepts);
  console.log(`입력: "${tc}" -> 결과: "${res}"`);
}
