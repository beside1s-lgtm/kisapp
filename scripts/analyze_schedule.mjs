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

async function analyze() {
  const applySnap = await db.collection('settings').doc('afterschoolTeacherApplySettings').get();
  const applySettings = applySnap.data();

  const docSnap = await db.collection('settings').doc('docConfig').get();
  const docConfig = docSnap.data();

  const events = docConfig?.academicCalendar?.events || [];
  console.log("=== APPLIED SETTINGS ===");
  console.log({
    operatingStartDate: applySettings.operatingStartDate,
    operatingEndDate: applySettings.operatingEndDate,
    allowedDays: applySettings.allowedDays,
    operatingWeeks: applySettings.operatingWeeks
  });

  // 휴업일 Set
  const holidaySet = new Set();
  const holidayDetails = [];
  events.forEach(e => {
    if (!e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY') {
      const start = new Date(e.date + 'T00:00:00');
      const end = new Date((e.endDate || e.date) + 'T00:00:00');
      let cur = new Date(start);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        holidaySet.add(dateStr);
        holidayDetails.push({ date: dateStr, title: e.title, type: e.type });
        cur.setDate(cur.getDate() + 1);
      }
    }
  });

  console.log("\n=== ALL HOLIDAYS (총 " + holidaySet.size + "일) ===");
  holidayDetails.sort((a, b) => a.date.localeCompare(b.date)).forEach(h => {
    console.log(`- ${h.date}: ${h.title} (${h.type})`);
  });

  const startStr = applySettings.operatingStartDate; // 2026-09-05
  const endStr = applySettings.operatingEndDate; // 2026-11-21
  const allowedDays = applySettings.allowedDays || ['월', '화', '수', '목', '토'];

  console.log(`\n=== 운영 기간: ${startStr} ~ ${endStr} 분석 ===`);
  const dayNameMap = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };

  const datesByDay = {};
  allowedDays.forEach(d => { datesByDay[d] = { total: [], valid: [], excluded: [] }; });

  let cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T23:59:59');

  while (cur <= end) {
    const dayOfWeek = dayNameMap[cur.getDay()];
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const fullDate = `${y}-${m}-${d}`;

    if (allowedDays.includes(dayOfWeek)) {
      datesByDay[dayOfWeek].total.push(fullDate);
      if (holidaySet.has(fullDate)) {
        datesByDay[dayOfWeek].excluded.push(fullDate);
      } else {
        datesByDay[dayOfWeek].valid.push(fullDate);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  console.log("\n--- 요일별 상세 집계 ---");
  for (const day of allowedDays) {
    const info = datesByDay[day];
    console.log(`\n[${day}요일] => 최종 ${info.valid.length}회 (캘린더 상 총 ${info.total.length}회 중 ${info.excluded.length}회 휴업일 제외)`);
    console.log(`  - 캘린더 전체 날짜: ${info.total.join(', ')}`);
    if (info.excluded.length > 0) {
      console.log(`  - 제외된 휴업일: ${info.excluded.map(d => `${d} (${holidayDetails.find(h => h.date === d)?.title})`).join(', ')}`);
    } else {
      console.log(`  - 제외된 휴업일 없음!`);
    }
    console.log(`  - 실제 수업 진행 날짜 (${info.valid.length}회): ${info.valid.join(', ')}`);
  }
}

analyze();
