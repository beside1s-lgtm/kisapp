import * as XLSX from 'xlsx';
import type { Course, SyllabusSession, AttendanceRecord, Classroom } from './types';
import { computeSettlement, courseScheduleForTerm, termFromSettings, termLabel, termPeriodLabel, type SettlementTerm } from './settlement';

// Export Enrollment List to Excel
export function exportEnrollmentsToExcel(
  enrollments: any[],
  courseTitle = '수강생목록',
  courses: Course[] = [],
  ..._rest: any[]
) {
  const courseMap = new Map<string, string>();
  courses.forEach((c) => {
    if (c.id) courseMap.set(c.id, c.title);
  });

  // 1. 강좌명 가나다-ABC 순 및 학년/반/번호 순 정렬
  const sortedEnrollments = [...enrollments].sort((a, b) => {
    const courseA = a.courseTitle || courseMap.get(a.courseId) || a.courseId || '';
    const courseB = b.courseTitle || courseMap.get(b.courseId) || b.courseId || '';
    const courseComp = courseA.localeCompare(courseB, 'ko');
    if (courseComp !== 0) return courseComp;

    const gA = Number(a.grade) || 0;
    const gB = Number(b.grade) || 0;
    if (gA !== gB) return gA - gB;

    const cA = Number(a.classNum) || 0;
    const cB = Number(b.classNum) || 0;
    if (cA !== cB) return cA - cB;

    const nA = Number(a.studentNum) || 0;
    const nB = Number(b.studentNum) || 0;
    if (nA !== nB) return nA - nB;

    const nameA = a.name || a.studentName || '';
    const nameB = b.name || b.studentName || '';
    return nameA.localeCompare(nameB, 'ko');
  });

  const data = sortedEnrollments.map((item, index) => {
    const rawName = item.name || item.studentName || '';
    const courseName = item.courseTitle || courseMap.get(item.courseId) || item.courseId || '-';
    const busFee = item.busFee || 0;
    const tuition = item.tuition || 0;
    const textbook = item.textbookFee || 0;
    const material = item.materialFee || 0;
    const total = tuition + textbook + material + busFee;

    return {
      순번: index + 1,
      강좌명: courseName,
      학년: item.grade || '',
      반: item.classNum || '',
      번호: item.studentNum || '',
      학생이름: rawName,
      학부모연락처: item.parentPhone || item.phone || '',
      스쿨버스: item.kisbusNo || '-',
      방과후버스: item.afterschoolBusNo || (item.afterSchoolBusAssignment ? `${item.afterSchoolBusAssignment}호차` : '-'),
      목적지: item.destinationName || '-',
      수강요일: item.selectedDays && item.selectedDays.length > 0 ? `주1회 (${item.selectedDays.join(', ')})` : '전체 (기본)',
      '수강료(VND)': tuition,
      '교재비(VND)': textbook,
      '재료비(VND)': material,
      '스쿨버스비(VND)': busFee,
      '총금액(VND)': total,
      신청상태: item.status === 'ENROLLED' ? '수강확정' : '대기자',
      등록일자: item.registrationDate ? String(item.registrationDate).slice(0, 10) : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '수강생목록');
  const cleanTitle = courseTitle.replace(/[\\/:*?"<>|]/g, '_');
  XLSX.writeFile(workbook, `${cleanTitle}_수강생명단.xlsx`);
}

// Legacy alias function exports for StudentManagement & RefundManagement
export const downloadSchoolBankingExcel = (enrollments: any, ...rest: any[]) =>
  exportEnrollmentsToExcel(enrollments, typeof rest[0] === 'string' ? rest[0] : '스쿨뱅킹');

export const downloadAddCancelExcel = (enrollments: any, ...rest: any[]) =>
  exportEnrollmentsToExcel(enrollments, typeof rest[0] === 'string' ? rest[0] : '추가취소');

export const downloadSampleExcel = () => {
  const data = [
    {
      '학년': 1,
      '반': 1,
      '번호': 1,
      '이름': '홍길동',
      '강좌명': '사고력 쑥쑥! 놀면서 배우는 창의수학(A)',
      '스쿨버스(토요일은 O/X)': 'O',
      '학부모연락처(선택)': '010-1234-5678',
    },
    {
      '학년': 1,
      '반': 1,
      '번호': 2,
      '이름': '김영희',
      '강좌명': 'AI 로봇코딩',
      '스쿨버스(토요일은 O/X)': '',
      '학부모연락처(선택)': '010-2345-6789',
    },
    {
      '학년': 2,
      '반': 3,
      '번호': 12,
      '이름': '김철수',
      '강좌명': 'K-Pop 댄스교실',
      '스쿨버스(토요일은 O/X)': '18호차',
      '학부모연락처(선택)': '010-9876-5432',
    },
    {
      '학년': 3,
      '반': 2,
      '번호': 5,
      '이름': '이순신',
      '강좌명': '오케스트라',
      '스쿨버스(토요일은 O/X)': 'O',
      '학부모연락처(선택)': '010-3456-7890',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '수강생일괄등록_양식');
  XLSX.writeFile(workbook, '강좌별_수강생_일괄등록_양식.xlsx');
};

// Export Refund List to Excel
export function exportRefundsToExcel(refunds: any[], title?: string) {
  const data = refunds.map((item, index) => ({
    순번: index + 1,
    학생이름: item.studentName,
    강좌명: item.courseTitle,
    신청일자: item.requestDate,
    환불요청액: item.refundAmount,
    환불은행: item.bankName,
    계좌번호: item.accountNumber,
    예금주: item.accountHolder,
    환불사유: item.reason,
    처리상태: item.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '환불신청목록');
  XLSX.writeFile(workbook, `${title || '방과후학교_환불신청목록'}.xlsx`);
}

export const downloadRefundExcel = exportRefundsToExcel;

// Export Official Attendance Sheet to XLSX (요구사항 1: 공식 출석부 xslx 생성)
export function exportAttendanceToExcel(
  course: Course,
  enrollments: any[],
  sessions: SyllabusSession[],
  attendanceRecords: AttendanceRecord[]
) {
  const courseStudents = enrollments.filter(
    (e) => e.courseId === course.id && e.status === 'ENROLLED'
  );

  // Header rows
  const excelData: any[] = [];
  excelData.push(['2026-1 KIS방과후학교(After school)']);
  excelData.push([`${course.title} 출석부`]);
  excelData.push([`기간: ${course.period || '2026/03/30-06/20'}`, `강사: ${course.instructorName || '김경훈'}`]);
  excelData.push([]); // blank

  // Grid Header Row 1 (Session numbers 1~10)
  const header1 = ['순', '학년', '반', '번', '이름'];
  sessions.forEach((s) => header1.push(`${s.sessionNo}차시`));
  header1.push('버스번호', '학부모 연락처');
  excelData.push(header1);

  // Grid Header Row 2 (Session dates)
  const header2 = ['', '', '', '', '월일'];
  sessions.forEach((s) => header2.push(s.dateStr));
  header2.push('', '');
  excelData.push(header2);

  // Student rows
  courseStudents.forEach((st, idx) => {
    const row: any[] = [idx + 1, st.grade, st.classNum, st.studentNum, st.name];

    sessions.forEach((s) => {
      const record = attendanceRecords.find(
        (r) =>
          r.courseId === course.id &&
          r.studentId === st.studentId &&
          (r.sessionNo === s.sessionNo || r.date === s.dateStr)
      );
      let mark = '';
      if (record) {
        if (record.markSymbol) mark = record.markSymbol;
        else if (record.status === 'ATTEND') mark = record.isIndividualDismissal ? '△' : '○';
        else if (record.status === 'ABSENT') mark = '×';
      }
      row.push(mark);
    });

    row.push(st.kisbusNo || '-', st.parentPhone || '');
    excelData.push(row);
  });

  excelData.push([]);
  excelData.push(['✔ 출결 표기 방법 : 출석 ○, 지각 · 조퇴 △, 결석 ×']);
  excelData.push(['※ 방과후학교 운영 유의 사항']);
  excelData.push(['1) 출결 체크 후, 버스 미탑승 학생 어플 입력 (9교시 시작 전 입력 완료)']);
  excelData.push(['2) 학생 안전 하교지도 (버스 탑승 및 개별 하교)']);

  const worksheet = XLSX.utils.aoa_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '출석부');

  const fileName = `${course.title.replace(/[\/\?%*:|"<>]/g, '_')}_출석부_2026.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

// Download Classroom Bulk Registration Template Excel
export function downloadClassroomTemplateExcel() {
  const data = [
    {
      '교실이름(필수)': '체육관',
      '수용정원(명)': 100,
      '동시수업가능강좌수': 2,
    },
    {
      '교실이름(필수)': '1-1반 교실',
      '수용정원(명)': 30,
      '동시수업가능강좌수': 1,
    },
    {
      '교실이름(필수)': '컴퓨터실',
      '수용정원(명)': 25,
      '동시수업가능강좌수': 1,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '교실일괄등록_양식');
  XLSX.writeFile(workbook, '교실일괄등록_샘플양식.xlsx');
}

// Parse imported Classroom Excel file
export function parseClassroomExcel(file: File): Promise<Partial<Classroom>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return resolve([]);
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        
        const mapped = json.map((row) => ({
          name: row['교실이름(필수)'] ? String(row['교실이름(필수)']).trim() : '',
          capacity: row['수용정원(명)'] ? parseInt(row['수용정원(명)']) : 30,
          maxSimultaneousCourses: row['동시수업가능강좌수'] ? parseInt(row['동시수업가능강좌수']) : 1,
        })).filter(item => item.name !== '');

        resolve(mapped);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

// Elementary Period Time Table (초등 차시별 시간)
export const ELEMENTARY_PERIOD_TIMES: Record<number, { start: string; end: string; display: string }> = {
  1: { start: '08:30', end: '09:10', display: '08:30~09:10' },
  2: { start: '09:20', end: '10:00', display: '09:20~10:00' },
  3: { start: '10:10', end: '10:50', display: '10:10~10:50' },
  4: { start: '11:00', end: '11:40', display: '11:00~11:40' },
  5: { start: '12:30', end: '13:10', display: '12:30~13:10' },
  6: { start: '13:20', end: '14:00', display: '13:20~14:00' },
  7: { start: '14:10', end: '14:50', display: '14:10~14:50' },
  8: { start: '15:00', end: '15:40', display: '15:00~15:40' },
  9: { start: '15:50', end: '16:30', display: '15:50~16:30' },
};

// Helper to check if cell is marked (O, o, 1, V, Y, etc.)
const isCheckMark = (val: any): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim().toUpperCase();
  return str === 'O' || str === '0' || str === 'V' || str === 'Y' || str === '1' || str === 'TRUE' || str === 'CHECK';
};

// Download Course Bulk Registration Template Excel
export function downloadCourseTemplateExcel() {
  const data = [
    {
      '강좌명(필수)': '사고력 쑥쑥! 놀면서 배우는 창의수학(A)',
      '담당강사1': '박지아',
      '담당강사2': '',
      '담당강사3': '',
      '담당강사4': '',
      '수업교실': '2-3',
      '수강정원(명)': 13,
      '월': 'O', '화': 'O', '수': 'O', '목': 'O', '금': 'O', '토': '',
      '1차시': 'O', '2차시': 'O', '3차시': '', '4차시': '', '5차시': '', '6차시': '', '7차시': '', '8차시': '', '9차시': '',
      '설명': '창의수학 A 수업입니다.',
    },
    {
      '강좌명(필수)': 'AI 로봇코딩',
      '담당강사1': '박강사',
      '담당강사2': '김강사',
      '담당강사3': '',
      '담당강사4': '',
      '수업교실': '컴퓨터2실',
      '수강정원(명)': 16,
      '월': 'O', '화': 'O', '수': 'O', '목': 'O', '금': 'O', '토': '',
      '1차시': '', '2차시': '', '3차시': 'O', '4차시': 'O', '5차시': '', '6차시': '', '7차시': '', '8차시': '', '9차시': '',
      '설명': '3~4차시 AI 로봇코딩 수업입니다.',
    },
    {
      '강좌명(필수)': 'Cooking Class A',
      '담당강사1': '박강사',
      '담당강사2': '',
      '담당강사3': '',
      '담당강사4': '',
      '수업교실': '과학실',
      '수강정원(명)': 16,
      '월': 'O', '화': 'O', '수': 'O', '목': 'O', '금': 'O', '토': '',
      '1차시': 'O', '2차시': 'O', '3차시': '', '4차시': '', '5차시': '', '6차시': '', '7차시': '', '8차시': '', '9차시': '',
      '설명': '쿠킹 클래스 수업입니다.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '강좌일괄등록_양식');
  XLSX.writeFile(workbook, '강좌일괄등록_샘플양식.xlsx');
}

// Parse imported Course Excel file
export function parseCourseExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return resolve([]);
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        
        const mapped = json.map((row, idx) => {
          const base = row['강좌명(필수)'] ? String(row['강좌명(필수)']).trim() : '';

          // 1. 강사 추출 (담당강사1 ~ 담당강사4 컬럼 지원) — 각 칸에 1명씩 개별 저장
          const instructorList: string[] = [];
          for (let i = 1; i <= 4; i++) {
            const key = `담당강사${i}`;
            if (row[key] && String(row[key]).trim()) {
              // 혹시 한 칸에 쉼표로 여러 명이 들어온 경우도 분리
              String(row[key]).split(',').forEach((name: string) => {
                const trimmed = name.trim();
                if (trimmed && !instructorList.includes(trimmed)) {
                  instructorList.push(trimmed);
                }
              });
            }
          }
          // Fallback: 기존 단일 '담당강사' 컬럼 지원
          if (instructorList.length === 0 && row['담당강사'] && String(row['담당강사']).trim()) {
            String(row['담당강사']).split(',').forEach((name: string) => {
              const trimmed = name.trim();
              if (trimmed && !instructorList.includes(trimmed)) {
                instructorList.push(trimmed);
              }
            });
          }

          // 2. 요일 추출 (월, 화, 수, 목, 금, 토 컬럼)
          const daysList = ['월', '화', '수', '목', '금', '토'];
          let classDays = daysList.filter((d) => isCheckMark(row[d]));

          // Fallback: 기존 '요일' 텍스트 컬럼 지원
          if (classDays.length === 0 && row['요일']) {
            const daysStr = String(row['요일']).trim();
            classDays = daysStr.split(',').map((d: string) => d.trim()).filter(Boolean);
          }
          if (classDays.length === 0) {
            classDays = ['토']; // Default fallback
          }

          // 3. 차시 추출 (1차시 ~ 9차시 컬럼)
          const selectedPeriods: number[] = [];
          for (let p = 1; p <= 9; p++) {
            if (isCheckMark(row[`${p}차시`])) {
              selectedPeriods.push(p);
            }
          }

          let classTime = '09:00 ~ 12:00';
          let periodText = '';
          if (selectedPeriods.length > 0) {
            const minPeriod = Math.min(...selectedPeriods);
            const maxPeriod = Math.max(...selectedPeriods);
            const startTime = ELEMENTARY_PERIOD_TIMES[minPeriod]?.start || '08:30';
            const endTime = ELEMENTARY_PERIOD_TIMES[maxPeriod]?.end || '10:00';
            periodText = minPeriod === maxPeriod ? `${minPeriod}차시` : `${minPeriod}~${maxPeriod}차시`;
            classTime = `${startTime} ~ ${endTime} (${periodText})`;
          } else if (row['수업시간']) {
            // Fallback: 기존 '수업시간' 텍스트 지원
            classTime = String(row['수업시간']).trim();
          }

          // 4. 수업교실 추출
          const rawClassroom = row['수업교실'] ? String(row['수업교실']).trim() : '';

          return {
            id: `excel_${idx}_${Date.now()}`,
            title: base,
            category: '',
            // 강사 최대 6명 개별 필드로 저장 (쉼표 합산 금지)
            instructorName: instructorList[0] || '',
            instructor2: instructorList[1] || '',
            instructor3: instructorList[2] || '',
            instructor4: instructorList[3] || '',
            instructor5: instructorList[4] || '',
            instructor6: instructorList[5] || '',
            instructorPhone: '',
            classTime,
            selectedPeriods,
            classroom: rawClassroom,
            classroomId: '', // AdminPanel에서 매칭/생성
            maxStudents: row['수강정원(명)'] ? parseInt(row['수강정원(명)'], 10) : 20,
            currentStudents: 0,
            maxWaiting: 5,
            waitingStudents: 0,
            tuition: row['수강료(원)'] ? parseInt(row['수강료(원)'], 10) : 150000,
            textbookFee: 0,
            materialFee: 0,
            description: row['설명'] ? String(row['설명']).trim() : '',
            status: 'OPEN',
            classDays,
            checked: true,
          };
        }).filter(item => item.title !== '');

        resolve(mapped);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

// Export Enrollment Edit Template
export function exportEnrollmentEditTemplateExcel(enrollments: any[], courseTitle = '수강생목록') {
  const data = enrollments.map((item) => ({
    '수강생ID(수정금지)': item.id,
    '학년': item.grade,
    '반': item.classNum,
    '번호': item.studentNum,
    '학생이름': item.name,
    '부모연락처': item.parentPhone,
    '스쿨버스(예: 1~5호차 또는 미신청)': item.kisbusNo || '-',
    '강의료(VND)': item.tuition,
    '교재비(VND)': item.textbookFee,
    '재료비(VND)': item.materialFee,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '수강생정보수정양식');
  XLSX.writeFile(workbook, `${courseTitle}_수강생_수정양식.xlsx`);
}

// Parse imported Enrollment Edit Excel file
export function parseEnrollmentEditExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return resolve([]);
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        
        const mapped = json.map((row) => {
          const id = row['수강생ID(수정금지)'] ? String(row['수강생ID(수정금지)']).trim() : '';
          return {
            id,
            grade: row['학년'] ? parseInt(row['학년'], 10) : 1,
            classNum: row['반'] ? parseInt(row['반'], 10) : 1,
            studentNum: row['번호'] ? parseInt(row['번호'], 10) : 1,
            name: row['학생이름'] ? String(row['학생이름']).trim() : '',
            parentPhone: row['부모연락처'] ? String(row['부모연락처']).trim() : '',
            kisbusNo: formatBusNo(row['스쿨버스(예: 1~5호차 또는 미신청)'] || row['스쿨버스'] || row['버스'] || ''),
            tuition: row['강의료(VND)'] || row['강의료'] ? parseInt(row['강의료(VND)'] || row['강의료'], 10) : 0,
            textbookFee: row['교재비(VND)'] || row['교재비'] ? parseInt(row['교재비(VND)'] || row['교재비'], 10) : 0,
            materialFee: row['재료비(VND)'] || row['재료비'] ? parseInt(row['재료비(VND)'] || row['재료비'], 10) : 0,
          };
        }).filter(item => item.id !== '');

        resolve(mapped);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * 스쿨버스 호차 텍스트 정규화 유틸리티 (예: '11호' -> '11호차', '18호' -> '18호차', '11' -> '11호차')
 */
export function formatBusNo(input: any): string {
  if (input === null || input === undefined) return '미신청';
  const str = String(input).trim();
  if (!str || str === '-' || str === '미신청' || str === 'X' || str === 'x' || str === '아니오' || str === 'N' || str === 'n' || str === 'false') {
    return '미신청';
  }
  if (str === 'O' || str === 'o' || str === '신청' || str === 'Y' || str === 'y' || str === '예' || str === 'v' || str === 'V' || str === 'true' || str === '1') {
    return '1호차';
  }

  // 숫자 추출 (예: '11호', '18호차', '11' -> 11, 18)
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return `${num}호차`;
  }

  return str.endsWith('호차') ? str : (str.endsWith('호') ? `${str}차` : `${str}호차`);
}

// Parse Bulk Student Enrollment Excel file
export function parseEnrollmentExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return resolve([]);
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        
        const mapped = json.map((row, idx) => {
          // 키 목록 정규화 헬퍼 (공백 및 특수문자 제거 후 비교)
          const findVal = (...keys: string[]): string => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
              const cleanKey = key.replace(/[\s\(\)\{\}\[\]\_\-\.]/g, '').toLowerCase();
              const matchedRowKey = rowKeys.find(rk => rk.replace(/[\s\(\)\{\}\[\]\_\-\.]/g, '').toLowerCase() === cleanKey);
              if (matchedRowKey && row[matchedRowKey] !== undefined && row[matchedRowKey] !== null) {
                return String(row[matchedRowKey]).trim();
              }
            }
            return '';
          };

          // 1. 강좌명
          const courseTitle = findVal(
            '강좌명', '강좌명(필수)', '강좌', '과목명', '과목', '강의명', '강의',
            '신청강좌', '수강강좌', '방과후강좌', '방과후과목', '방과후프로그램',
            '프로그램명', '프로그램', '희망강좌', '희망과목', '강좌제목', '개설강좌',
            '수업명', '수강과목', 'courseTitle', 'course', 'subject', 'program'
          );

          // 2. 학생 이름
          const name = findVal(
            '이름', '학생이름', '성명', '학생명', '이름(필수)', '학생',
            'name', 'studentName', 'student'
          );

          // 3. 스쿨버스
          const rawBusVal = findVal(
            '스쿨버스', '스쿨버스(선택)', '버스', '버스번호', '스쿨버스신청',
            '호차', '탑승버스', '노선', 'kisbusNo', 'busNo', 'bus', '스쿨버스(예: 1~5호차 또는 미신청)'
          );
          const kisbusNo = rawBusVal ? formatBusNo(rawBusVal) : '';

          // 4. 학년 / 반 / 번호
          const rawGrade = findVal('학년', 'grade', 'year');
          const rawClass = findVal('반', '학반', 'class', 'classNum', 'classroom');
          const rawNum = findVal('번호', '출석번호', '학번', '번', 'number', 'studentNum', 'no');

          const gradeVal = parseInt(rawGrade.replace(/\D/g, '') || '1', 10);
          const classVal = parseInt(rawClass.replace(/\D/g, '') || '1', 10);
          const numVal = parseInt(rawNum.replace(/\D/g, '') || '1', 10);

          // 5. 연락처
          const phone = findVal('학생연락처', '학생전화번호', '학생핸드폰', 'phone', 'studentPhone');
          const parentPhone = findVal(
            '학부모연락처', '학부모연락처(선택)', '보호자연락처', '비상연락처', '부모연락처',
            '학부모전화번호', '보호자전화번호', '연락처', '전화번호', '핸드폰', '휴대폰',
            'parentPhone', 'contact'
          );

          return {
            id: `excel_student_${idx}_${Date.now()}`,
            courseTitle,
            grade: isNaN(gradeVal) ? 1 : gradeVal,
            classNum: isNaN(classVal) ? 1 : classVal,
            studentNum: isNaN(numVal) ? 1 : numVal,
            name,
            phone,
            parentPhone,
            kisbusNo,
          };
        }).filter(item => item.name !== '');

        resolve(mapped);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * 방학 중 및 학기 중 방과후 버스별 탑승명단 다운로드 (kisbus after-school-management-tab 기준)
 */
export function exportAfterSchoolBusRostersToExcel(
  enrollments: any[],
  courses: Course[] = [],
  semesterMode: 'regular' | 'vacation' = 'regular'
) {
  if (!enrollments || enrollments.length === 0) {
    alert('다운로드할 수강생 데이터가 없습니다.');
    return;
  }

  const isVacation = semesterMode === 'vacation';

  // 버스 목록 정의 (1호차 ~ 40호차 기본 생성 + 등록된 버스)
  const defaultBuses = Array.from({ length: 40 }, (_, i) => `${i + 1}호차`);
  const busListSet = new Set<string>(defaultBuses);
  
  enrollments.forEach(e => {
    if (e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청') {
      busListSet.add(e.kisbusNo);
    }
  });

  const busList = Array.from(busListSet);
  const days = ['월요일', '화요일', '수요일', '목요일', '금요일'];
  const dayMap: Record<string, string[]> = {
    '월요일': ['월', 'Mon', 'Monday'],
    '화요일': ['화', 'Tue', 'Tuesday'],
    '수요일': ['수', 'Wed', 'Wednesday'],
    '목요일': ['목', 'Thu', 'Thursday'],
    '금요일': ['금', 'Fri', 'Friday'],
  };

  const workbook = XLSX.utils.book_new();
  let hasData = false;

  for (const busName of busList) {
    // 해당 버스 탑승 수강생들
    const busEnrollments = enrollments.filter(e => {
      const busNo = (e.kisbusNo || '').trim();
      if (!busNo || busNo === '-' || busNo === '미신청') return false;
      return busNo === busName || busNo.includes(busName.replace('호차', '')) || busName.includes(busNo);
    });

    if (busEnrollments.length === 0) continue;

    const sheetData: any[][] = [];

    for (const dayLabel of days) {
      const validDayKeys = dayMap[dayLabel];
      
      // 해당 요일에 강좌를 수강하는 수강생들 추출
      const dayStudents = busEnrollments.filter(e => {
        const course = courses.find(c => c.id === e.courseId);
        if (!course) return true; // 강좌 정보 없으면 기본 포함
        if (!course.classDays || course.classDays.length === 0) return true;
        return course.classDays.some((d: string) => validDayKeys.some(k => d.includes(k)));
      });

      if (dayStudents.length > 0) {
        sheetData.push([`[ ${dayLabel} ]`]);
        sheetData.push(['순번', '학년', '반', '번호', '학생이름', '수강 강좌명', '목적지', '학부모 연락처']);

        // 학년, 반, 번호, 이름 순 정렬
        dayStudents.sort((a, b) => {
          const gA = Number(a.grade) || 0;
          const gB = Number(b.grade) || 0;
          if (gA !== gB) return gA - gB;
          const cA = Number(a.classNum) || 0;
          const cB = Number(b.classNum) || 0;
          if (cA !== cB) return cA - cB;
          const nA = Number(a.studentNum) || 0;
          const nB = Number(b.studentNum) || 0;
          if (nA !== nB) return nA - nB;
          return (a.name || '').localeCompare(b.name || '', 'ko');
        });

        dayStudents.forEach((st, idx) => {
          const course = courses.find(c => c.id === st.courseId);
          const courseName = course?.title || st.courseTitle || '-';
          const destination = st.destinationName || st.zone || '기본 하교지';
          const phone = st.parentPhone || st.phone || '-';

          sheetData.push([
            idx + 1,
            st.grade,
            st.classNum,
            st.studentNum,
            st.name,
            courseName,
            destination,
            phone
          ]);
        });

        sheetData.push([]); // blank line between days
      }
    }

    if (sheetData.length > 0) {
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, busName.substring(0, 31));
      hasData = true;
    }
  }

  if (!hasData) {
    alert('다운로드할 버스 탑승 명단 데이터가 없습니다. (수강생의 스쿨버스 호차가 지정되어 있는지 확인하세요)');
    return;
  }

  const prefix = isVacation ? '방학중_방과후_버스별_탑승명단' : '학기중_방과후_버스별_탑승명단';
  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${prefix}_${todayStr}.xlsx`);
}

/**
 * 띄어쓰기 및 특수문자 차이를 감안한 유연한 강좌 매칭 유틸리티
 */
export function normalizeCourseTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\s+/g, '') // 모든 공백 제거
    .replace(/[\(\)\{\}\[\]\!\?\.\,\-\_\~\:\;\/\\]/g, ''); // 특수문자 및 괄호 제거
}

/**
 * 강좌명 뒤에 붙은 분반 식별 기호(A, B, C, 1, 2 등) 추출
 */
function getCourseSectionSuffix(title: string): string | null {
  const norm = normalizeCourseTitle(title);
  // 예: '배구부a' -> 'a', '배구부b' -> 'b', '창의수학1' -> '1'
  const match = norm.match(/([a-z]|\d+)$/i);
  return match ? match[1] : null;
}

export function findMatchingCourse(excelTitle: string, coursesList: Course[]): Course | undefined {
  if (!excelTitle || !excelTitle.trim() || coursesList.length === 0) return undefined;
  
  const normExcel = normalizeCourseTitle(excelTitle);
  if (!normExcel) return undefined;

  // 1단계: 정규화 문자열 완전 일치
  // 예: '배구부 A', '배구부(A)', '배구부 (A)', '배구부A' -> 모두 '배구부a'로 100% 동일 일치!
  let matched = coursesList.find(c => normalizeCourseTitle(c.title) === normExcel);
  if (matched) return matched;

  const excelSuffix = getCourseSectionSuffix(excelTitle);

  // 2단계: 정규화 문자열 포함 관계 (단, A/B 분반 식별 기호가 다르면 오매칭 차단)
  matched = coursesList.find(c => {
    const normCourse = normalizeCourseTitle(c.title);
    const courseSuffix = getCourseSectionSuffix(c.title);
    
    // 만약 둘 다 분반 기호(A vs B 등)를 가지고 있고 그 기호가 서로 다르면 2단계 포함 매칭 제외
    if (excelSuffix && courseSuffix && excelSuffix !== courseSuffix) {
      return false;
    }

    return normCourse.includes(normExcel) || normExcel.includes(normCourse);
  });
  if (matched) return matched;

  // 3단계: 핵심 단어 겹침 검사
  const excelTokens = excelTitle.toLowerCase().replace(/[\(\)\{\}\[\]]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
  if (excelTokens.length > 0) {
    matched = coursesList.find(c => {
      const courseSuffix = getCourseSectionSuffix(c.title);
      if (excelSuffix && courseSuffix && excelSuffix !== courseSuffix) {
        return false;
      }
      const courseTitleLower = c.title.toLowerCase();
      const matchCount = excelTokens.filter(token => courseTitleLower.includes(token)).length;
      return matchCount >= Math.min(2, excelTokens.length);
    });
    if (matched) return matched;
  }

  return undefined;
}

/**
 * 차시별 수업계획서 엑셀 양식 다운로드 (.xlsx)
 */
export function exportSyllabusTemplateExcel(
  courseTitle = '신규강좌',
  existingSessions?: SyllabusSession[],
  defaultCount = 10
) {
  let rows: any[] = [];
  if (existingSessions && existingSessions.length > 0) {
    rows = existingSessions.map((s) => ({
      '차시(회차)': s.sessionNo,
      '수업일자(MM/DD 또는 YYYY-MM-DD)': s.dateStr || '',
      '수업주제 및 학습활동 내용': s.topic || '',
    }));
  } else {
    for (let i = 1; i <= defaultCount; i++) {
      rows.push({
        '차시(회차)': i,
        '수업일자(MM/DD 또는 YYYY-MM-DD)': '',
        '수업주제 및 학습활동 내용': `${i}차시 학습 목표 및 수업 활동 내용`,
      });
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 30 },
    { wch: 60 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '수업계획서');
  const safeTitle = courseTitle.replace(/[\\/:*?"<>|]/g, '_');
  XLSX.writeFile(workbook, `${safeTitle}_차시별수업계획서_양식.xlsx`);
}

/**
 * 업로드된 수업계획서 엑셀 파일(.xlsx/.xls) 파싱
 */
export function parseSyllabusExcelFile(file: File): Promise<SyllabusSession[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const sessions: SyllabusSession[] = [];
        json.forEach((row, index) => {
          // 컬럼명 유연 처리
          const sessionNoVal =
            row['차시(회차)'] ||
            row['차시'] ||
            row['회차'] ||
            row['순번'] ||
            row['Session'] ||
            (index + 1);

          const dateVal =
            row['수업일자(MM/DD 또는 YYYY-MM-DD)'] ||
            row['수업일자'] ||
            row['수업날짜'] ||
            row['날짜'] ||
            row['일자'] ||
            row['Date'] ||
            '';

          const topicVal =
            row['수업주제 및 학습활동 내용'] ||
            row['수업주제'] ||
            row['학습주제'] ||
            row['학습내용'] ||
            row['수업내용'] ||
            row['주제'] ||
            row['Topic'] ||
            '';

          const sessionNo = parseInt(String(sessionNoVal).replace(/[^0-9]/g, ''), 10) || (index + 1);
          let dateStr = String(dateVal).trim();
          // 엑셀 시리얼 넘버 날짜 처리
          if (/^\d{5}$/.test(dateStr)) {
            const excelDate = new Date(Math.round((Number(dateStr) - 25569) * 86400 * 1000));
            const mm = String(excelDate.getMonth() + 1).padStart(2, '0');
            const dd = String(excelDate.getDate()).padStart(2, '0');
            dateStr = `${mm}/${dd}`;
          }

          sessions.push({
            sessionNo,
            dateStr,
            topic: String(topicVal).trim(),
          });
        });

        // 차시 번호 기준 정렬
        sessions.sort((a, b) => a.sessionNo - b.sessionNo);
        resolve(sessions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 방과후학교 운영 결과 보고 및 수당 지급 청구용 종합 엑셀 (기안문 붙임) — 현재 학기 운영 현황 기준
 * - 시트 1: [강사별_강사료정산표] 강사마다 정규·대강·결근 차시와 지급액
 * - 시트 2: [강좌별_운영현황] 운영 기간·계획/실시 차시·증빙서류 결재 상태
 * - 시트 3: [결근·대강_내역] "결근: OOO / 대강: OOO"
 * - 시트 4: [출석부_취합본] 학생별 출결
 * - 시트 5: [강사출근부_취합본] 회차·강사별 출근(결근·대강) 기록
 * 정산 원칙은 settlement.ts 참고 (실제 수업한 회차만, 공동 강사는 각자 출근 차시만큼)
 */
export function generateAfterschoolSettlementWorkbook(
  courses: Course[],
  enrollments: any[],
  attendanceRecords: AttendanceRecord[],
  approvalDocs: any[],
  teacherFee: number = 800000,
  termName: string = '',
  substituteRecords: import('./types').SubstituteRecord[] = [],
  term?: SettlementTerm
): XLSX.WorkBook {
  const t: SettlementTerm = term || { ...termFromSettings({ teacherFee }), semester: termName };
  if (!term) t.fee = teacherFee;
  const result = computeSettlement(courses, attendanceRecords, substituteRecords, approvalDocs, t);
  const cur = t.currency || 'VND';
  const period = termPeriodLabel(t);
  const title = `${termName || termLabel(t)} 방과후학교`;
  const workbook = XLSX.utils.book_new();
  const addSheet = (name: string, header: string, rows: any[]) => {
    const ws = XLSX.utils.aoa_to_sheet([[header], []]);
    if (rows.length) XLSX.utils.sheet_add_json(ws, rows, { origin: 'A3' });
    else XLSX.utils.sheet_add_aoa(ws, [['(해당 없음)']], { origin: 'A3' });
    XLSX.utils.book_append_sheet(workbook, ws, name);
  };

  // 1. 강사별 강사료 정산표
  const instRows: any[] = result.instructors.map((s, i) => ({
    '순번': i + 1,
    '강사명': s.name,
    '담당 강좌': s.courses.filter((c) => c.regular || c.absent).map((c) => c.title).join(', ') || '-',
    '정규 수업 차시': s.regularSessions,
    '대강 차시': s.coveredSessions,
    '결근 차시(미지급)': s.absentSessions,
    '지급 차시': s.paidSessions,
    [`차시당 단가(${cur})`]: t.fee,
    [`지급액(${cur})`]: s.amount,
    '비고': [
      ...s.courses.filter((c) => c.covered).map((c) => `대강: ${c.title} ${c.covered}차시`),
      ...s.courses.filter((c) => c.absent).map((c) => `결근: ${c.title} ${c.absent}차시`),
    ].join(' / ') || '-',
  }));
  instRows.push({
    '순번': '합계',
    '강사명': `${result.totals.instructors}명`,
    '담당 강좌': `${result.totals.courses}개 강좌`,
    '정규 수업 차시': result.instructors.reduce((sum, s) => sum + s.regularSessions, 0),
    '대강 차시': result.instructors.reduce((sum, s) => sum + s.coveredSessions, 0),
    '결근 차시(미지급)': result.instructors.reduce((sum, s) => sum + s.absentSessions, 0),
    '지급 차시': result.totals.paidSessions,
    [`차시당 단가(${cur})`]: '-',
    [`지급액(${cur})`]: result.totals.amount,
    '비고': '총 청구액',
  });
  addSheet('강사별_강사료정산표', `${title} 강사별 강사료 정산표 (운영 기간 ${period}, 실제 수업한 차시 기준)`, instRows);

  // 2. 강좌별 운영 현황
  addSheet(
    '강좌별_운영현황',
    `${title} 강좌별 운영 현황 (운영 기간 ${period})`,
    result.courses.map((r, i) => ({
      '순번': i + 1,
      '강좌명': r.course.title,
      '강사': r.instructors.join(', ') || '-',
      '수강 학생 수': r.course.currentStudents || 0,
      '강좌 운영 기간': r.firstDate ? `${r.firstDate} ~ ${r.lastDate}` : '-',
      '수업 요일': (r.course.classDays || []).join(', ') || '-',
      '수업 시간': r.course.classTime || '-',
      '계획 회차': r.plannedLessons,
      '계획 차시': r.plannedSessions,
      '실시 회차': r.conductedLessons,
      '실시 차시': r.conductedSessions,
      '증빙서류(출석부·출근부)': r.evidence,
    }))
  );

  // 3. 결근·대강 내역
  addSheet(
    '결근·대강_내역',
    `${title} 결근·대강 내역`,
    result.substituteEvents.map((e, i) => ({
      '순번': i + 1,
      '날짜': e.dateStr || e.date,
      '강좌명': e.courseTitle,
      '회차': `${e.dayIndex}회차`,
      '차시': e.sessions,
      '구분': e.substituteInstructor ? '대강' : '결근',
      '내용': `결근: ${e.absentInstructor} / 대강: ${e.substituteInstructor || '없음'}`,
      '강사료 처리': !e.conducted
        ? '수업 기록 없음 (정산 제외)'
        : e.substituteInstructor
          ? `${e.absentInstructor} 미지급, ${e.substituteInstructor} 지급`
          : `${e.absentInstructor} 미지급`,
      '사유': e.reason || '-',
    }))
  );

  // 4. 출석부 취합본
  const attRows: any[] = [];
  result.courses.forEach((r) => {
    const c = r.course;
    // 현재 학기 회차표에 있는 차시만, 같은 차시 기록이 여러 건이면 한 번만 (출석 기록이 하나라도 있으면 출석)
    const termSessions = new Set(courseScheduleForTerm(c, t).flatMap((d) => d.sessionNos));
    (enrollments || [])
      .filter((e: any) => e.courseId === c.id && e.status === 'ENROLLED')
      .forEach((enr: any) => {
        const bySession = new Map<number, string>();
        (attendanceRecords || []).forEach((x: any) => {
          if (x.courseId !== c.id || x.studentId !== enr.studentId || !termSessions.has(x.sessionNo) || !x.status) return;
          if (bySession.get(x.sessionNo) !== 'ATTEND') bySession.set(x.sessionNo, x.status);
        });
        const recs = Array.from(bySession.values());
        const att = recs.filter((v) => v === 'ATTEND').length;
        const abs = recs.filter((v) => v === 'ABSENT').length;
        attRows.push({
          '순번': attRows.length + 1,
          '강좌명': c.title,
          '강사': r.instructors.join(', ') || '-',
          '학년': enr.grade,
          '반': enr.classNum,
          '번호': enr.studentNum,
          '학생 이름': enr.name,
          '출석 차시': att,
          '결석 차시': abs,
          '출석률': recs.length ? `${Math.round((att / recs.length) * 100)}%` : '-',
        });
      });
  });
  addSheet('출석부_취합본', `${title} 수강생 출석부 취합본 (운영 기간 ${period})`, attRows);

  // 5. 강사출근부 취합본 (회차 × 강사)
  const workRows: any[] = [];
  result.courses.forEach((r) => {
    const c = r.course;
    const days = courseScheduleForTerm(c, t);
    const checked = new Set((attendanceRecords || []).filter((x: any) => x.courseId === c.id && (x.status || x.markSymbol)).map((x: any) => x.sessionNo));
    days.forEach((d) => {
      const conducted = d.sessionNos.some((no) => checked.has(no));
      const dayEvents = result.substituteEvents.filter((e) => e.courseId === c.id && e.dayIndex === d.dayIndex);
      const names = Array.from(new Set([...r.instructors, ...dayEvents.map((e) => e.absentInstructor)]));
      names.forEach((inst) => {
        const ev = dayEvents.find((e) => e.absentInstructor === inst);
        workRows.push({
          '순번': workRows.length + 1,
          '강좌명': c.title,
          '회차': `${d.dayIndex}회차`,
          '날짜': d.dateStr,
          '차시': `${d.startSessionNo}~${d.endSessionNo}차시`,
          '강사': inst,
          '출근 기록': !conducted ? '수업 기록 없음' : ev ? (ev.substituteInstructor ? `결근 → 대강: ${ev.substituteInstructor}` : '결근') : '출근',
          '지급 대상': !conducted ? '-' : ev ? ev.substituteInstructor || '없음' : inst,
          '사유': ev?.reason || '-',
        });
      });
    });
  });
  addSheet('강사출근부_취합본', `${title} 강사출근부 취합본 (운영 기간 ${period})`, workRows);

  return workbook;
}

export function exportAfterschoolSettlementWorkbook(
  courses: Course[],
  enrollments: any[],
  attendanceRecords: AttendanceRecord[],
  approvalDocs: any[],
  teacherFee: number = 800000,
  filename: string = '방과후학교_출석부_및_강사출근부_취합본.xlsx',
  substituteRecords: import('./types').SubstituteRecord[] = []
) {
  const wb = generateAfterschoolSettlementWorkbook(courses, enrollments, attendanceRecords, approvalDocs, teacherFee, '', substituteRecords);
  XLSX.writeFile(wb, filename);
}

