import * as XLSX from 'xlsx';
import type { Course, SyllabusSession, AttendanceRecord, Classroom } from './types';

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
            // 강사 4명 개별 필드로 저장 (쉼표 합산 금지)
            instructorName: instructorList[0] || '',
            instructor2: instructorList[1] || '',
            instructor3: instructorList[2] || '',
            instructor4: instructorList[3] || '',
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
 * 방과후학교 운영 결과 보고 및 수당 지급 청구용 종합 통합 엑셀 워크북 생성
 * - 시트 1: [강사료정산_총괄표] (강좌별 총이수차시 × 차시당단가로 정확한 강사료 계산)
 * - 시트 2: [출석부_취합본] (학생별 출결 현황 및 출석률)
 * - 시트 3: [강사출근부_취합본] (회차별 수업일자 및 강사 출근 서명 기록)
 * - 시트 4~N: 제출 완료 강좌별 개별 출석부/출근부 상세 시트
 */
export function generateAfterschoolSettlementWorkbook(
  courses: Course[],
  enrollments: any[],
  attendanceRecords: AttendanceRecord[],
  approvalDocs: any[],
  teacherFee: number = 800000,
  termName: string = '2026-1학기',
  substituteRecords: import('./types').SubstituteRecord[] = []
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // 1. [강사료정산_총괄표] 생성
  let grandTotalStudents = 0;
  let grandTotalSessions = 0;
  let grandTotalAmount = 0;
  let rowIdx = 1;

  const settlementRows: any[] = [];

  courses.forEach((c) => {
    const isSubmitted = (approvalDocs || []).some((d: any) => d.courseId === c.id);
    const sessionsPerLesson = c.sessionsPerClass || 2;
    const totalSessions = c.totalSessions || (c.operatingWeeks ? c.operatingWeeks * sessionsPerLesson : 20);
    
    // 해당 강좌의 보결 기록 조회
    const courseSubs = (substituteRecords || []).filter((s) => s.courseId === c.id);
    const totalSubSessions = courseSubs.reduce((sum, s) => sum + (s.sessionCount || sessionsPerLesson), 0);
    const originalTeacherSessions = Math.max(0, totalSessions - totalSubSessions);
    const originalTeacherAmount = originalTeacherSessions * teacherFee;

    grandTotalStudents += (c.currentStudents || 0);
    grandTotalSessions += totalSessions;
    grandTotalAmount += (totalSessions * teacherFee);

    // 원 강사 정산 행
    settlementRows.push({
      '순번': rowIdx++,
      '강좌명': c.title,
      '담당강사': [c.instructorName, c.instructor2].filter(Boolean).join(', ') || '-',
      '수강학생수(명)': c.currentStudents || 0,
      '운영기간': `${c.startDate || '2026-03-30'} ~ ${c.endDate || '2026-06-20'}`,
      '수업요일': (c.classDays || []).join(', ') || '-',
      '수업시간': c.classTime || '-',
      '총이수차시': originalTeacherSessions,
      '차시당단가(VND)': teacherFee,
      '청구강사료(VND)': originalTeacherAmount,
      '서류제출상태': isSubmitted ? '제출완료 (정산대상)' : '미제출 (정산보류)',
      '비고': courseSubs.length > 0 ? `원강사 (보결 ${totalSubSessions}차시 제외)` : (isSubmitted ? '출석부/출근부 검토완료' : '서류 미비')
    });

    // 보결 강사 정산 행 추가
    courseSubs.forEach((sub) => {
      const subSessions = sub.sessionCount || sessionsPerLesson;
      const subAmount = subSessions * teacherFee;
      settlementRows.push({
        '순번': `${rowIdx++} (보결)`,
        '강좌명': `[보결] ${c.title} (${sub.dateStr || `${sub.dayIndex}회차`})`,
        '담당강사': `${sub.substituteInstructor} (원강사: ${c.instructorName || sub.originalInstructor} 대강)`,
        '수강학생수(명)': c.currentStudents || 0,
        '운영기간': sub.dateStr || '-',
        '수업요일': '-',
        '수업시간': c.classTime || '-',
        '총이수차시': subSessions,
        '차시당단가(VND)': teacherFee,
        '청구강사료(VND)': subAmount,
        '서류제출상태': isSubmitted ? '제출완료 (보결지급)' : '미제출',
        '비고': `보결 수당 지급 (${sub.reason || '사유 미기재'})`
      });
    });
  });

  // 합계 행 추가
  settlementRows.push({
    '순번': '합계' as any,
    '강좌명': `${courses.length}개 강좌`,
    '담당강사': '-',
    '수강학생수(명)': grandTotalStudents,
    '운영기간': '-',
    '수업요일': '-',
    '수업시간': '-',
    '총이수차시': grandTotalSessions,
    '차시당단가(VND)': '-' as any,
    '청구강사료(VND)': grandTotalAmount,
    '서류제출상태': `제출: ${courses.filter(c => (approvalDocs || []).some((d: any) => d.courseId === c.id)).length}개 / 미제출: ${courses.filter(c => !(approvalDocs || []).some((d: any) => d.courseId === c.id)).length}개`,
    '비고': '총 청구액'
  });

  const wsSettlement = XLSX.utils.json_to_sheet(settlementRows);
  XLSX.utils.book_append_sheet(workbook, wsSettlement, '강사료정산_총괄표');

  // 2. [출석부_취합본] 생성
  const attendanceSummaryRows: any[] = [];
  let attIdx = 1;

  courses.forEach((c) => {
    const cEnrs = (enrollments || []).filter((e: any) => e.courseId === c.id && e.status === 'ENROLLED');
    const isSubmitted = (approvalDocs || []).some((d: any) => d.courseId === c.id);

    cEnrs.forEach((enr: any) => {
      const studentRecords = (attendanceRecords || []).filter((r: any) => r.courseId === c.id && r.studentId === enr.studentId);
      const attendedCount = studentRecords.filter((r: any) => r.status === 'ATTEND').length;
      const absentCount = studentRecords.filter((r: any) => r.status === 'ABSENT').length;
      const totalRecorded = studentRecords.length;
      const attRate = totalRecorded > 0 ? `${Math.round((attendedCount / totalRecorded) * 100)}%` : '-';

      attendanceSummaryRows.push({
        '순번': attIdx++,
        '강좌명': c.title,
        '담당강사': c.instructorName || '-',
        '학년': enr.grade,
        '반': enr.classNum,
        '번호': enr.studentNum,
        '학생이름': enr.name,
        '출석차시': attendedCount,
        '결석차시': absentCount,
        '출석률': attRate,
        '스쿨버스': enr.kisbusNo || '-',
        '학부모연락처': enr.parentPhone || '-',
        '서류제출여부': isSubmitted ? '제출' : '미제출'
      });
    });
  });

  if (attendanceSummaryRows.length > 0) {
    const wsAttendance = XLSX.utils.json_to_sheet(attendanceSummaryRows);
    XLSX.utils.book_append_sheet(workbook, wsAttendance, '출석부_취합본');
  }

  // 3. [강사출근부_취합본] 생성
  const workRegisterRows: any[] = [];
  let workIdx = 1;

  courses.forEach((c) => {
    const isSubmitted = (approvalDocs || []).some((d: any) => d.courseId === c.id);
    const sessionsPerLesson = c.sessionsPerClass || 2;
    const totalSessions = c.totalSessions || (c.operatingWeeks ? c.operatingWeeks * sessionsPerLesson : 20);
    const totalLessons = Math.ceil(totalSessions / sessionsPerLesson);

    for (let i = 1; i <= totalLessons; i++) {
      const startSess = (i - 1) * sessionsPerLesson + 1;
      const endSess = Math.min(i * sessionsPerLesson, totalSessions);
      const sessionNos = Array.from({ length: endSess - startSess + 1 }, (_, k) => startSess + k);
      const hasChecked = (attendanceRecords || []).some((r: any) => r.courseId === c.id && sessionNos.includes(r.sessionNo || 0) && r.status);
      
      // 보결 여부 확인
      const subRecord = (substituteRecords || []).find((s) => s.courseId === c.id && s.dayIndex === i);
      const teacherName = subRecord ? `[보결] ${subRecord.substituteInstructor}` : (c.instructorName || '강사');
      const stampText = hasChecked ? `${teacherName} (인)` : '-';

      workRegisterRows.push({
        '순번': workIdx++,
        '강좌명': c.title,
        '담당강사': teacherName,
        '회차': `${i}회차`,
        '차시범위': `${startSess}~${endSess}차시`,
        '수업시간': c.classTime || '-',
        '수업진행(출결체크)': hasChecked ? '진행완료' : '미체크/미수업',
        '강사서명날인': stampText,
        '서류제출상태': isSubmitted ? '제출완료' : '미제출',
        '보결사유': subRecord ? (subRecord.reason || '보결 수업') : '-'
      });
    }
  });

  if (workRegisterRows.length > 0) {
    const wsWork = XLSX.utils.json_to_sheet(workRegisterRows);
    XLSX.utils.book_append_sheet(workbook, wsWork, '강사출근부_취합본');
  }

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
  const wb = generateAfterschoolSettlementWorkbook(courses, enrollments, attendanceRecords, approvalDocs, teacherFee, '2026-1학기', substituteRecords);
  XLSX.writeFile(wb, filename);
}

