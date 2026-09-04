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

async function simulate() {
  const configRef = db.collection('settings').doc('documentConfig');
  const configSnap = await configRef.get();
  const config = configSnap.data();
  const events = config?.academicCalendar?.events || [];

  // 휴업일 Set 구성 (endDate가 있는 경우 기간 내 모든 날짜 포함)
  const holidaySet = new Set();
  events.forEach(e => {
    if (!e.isSchoolDay || e.type === 'HOLIDAY' || e.type === 'PUBLIC_HOLIDAY') {
      const start = new Date(e.date + 'T00:00:00');
      const end = new Date((e.endDate || e.date) + 'T00:00:00');
      let cur = new Date(start);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        holidaySet.add(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
  });

  console.log("=== REGISTERED HOLIDAYS IN 2026 ===");
  Array.from(holidaySet).sort().forEach(h => console.log(h));

  // 1. 현재 화면에 설정된 기간: 2026-09-05 ~ 2026-11-21
  runCheck('현재 시스템 설정 기간 (2026-09-05 ~ 2026-11-21)', '2026-09-05', '2026-11-21', holidaySet);

  // 2. 사용자가 언급한 기간: 마지막주 목요일 종료인 경우 (2026-09-05 ~ 2026-11-19)
  runCheck('마지막주 목요일 종료 가설 (2026-09-05 ~ 2026-11-19)', '2026-09-05', '2026-11-19', holidaySet);
}

function runCheck(label, startStr, endStr, holidaySet) {
  console.log("\n=================================");
  console.log(label);
  console.log("=================================");
  const dayNameMap = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };
  const classDays = ['월', '화', '수', '목', '토'];

  let start = new Date(startStr + 'T00:00:00');
  let end = new Date(endStr + 'T23:59:59');

  const daysByWeekday = { '월': [], '화': [], '수': [], '목': [], '토': [] };
  const excludedDays = { '월': [], '화': [], '수': [], '목': [], '토': [] };

  let cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = dayNameMap[cur.getDay()];
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const fullDate = `${y}-${m}-${d}`;

    if (classDays.includes(dayOfWeek)) {
      if (holidaySet.has(fullDate)) {
        excludedDays[dayOfWeek].push(fullDate);
      } else {
        daysByWeekday[dayOfWeek].push(fullDate);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  classDays.forEach(d => {
    console.log(`${d}요일: 총 ${daysByWeekday[d].length}회 (제외된 휴업일: ${excludedDays[d].join(', ') || '없음'})`);
    console.log(`   -> 진행 날짜: ${daysByWeekday[d].join(', ')}`);
  });
}

simulate();
