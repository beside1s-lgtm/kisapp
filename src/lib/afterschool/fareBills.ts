import { fetchDocument, setDocument, onDocumentUpdate } from '@/lib/kisbus/core';
import type { 
  Course, 
  Enrollment, 
  Student, 
  AfterschoolFareBill, 
  AfterschoolBillCourseItem, 
  StudentAfterschoolAdjustment 
} from './types';
import { normalizeString } from '@/lib/kisbus/utils';
import { findMatchingCourse } from './excel';

export interface AfterschoolFareBillsStore {
  semesterId: string;
  semesterName: string;
  issuedAt: string;
  bills: AfterschoolFareBill[];
}

/**
 * 방과후학교 전체 수강생의 수강료 및 버스비를 학생 1인 기준으로 집계·산출합니다.
 */
export function calculateAllStudentsAfterschoolFare(params: {
  enrollments: Enrollment[];
  courses: Course[];
  studentsList?: Student[];
  destinations?: any[];
  saturdayBusFareSettings?: Record<string, number>;
  busFareSettings?: Record<string, number>;
  busFareCurrency?: string;
  teacherApplySettings?: any;
  adjustments?: Record<string, StudentAfterschoolAdjustment>;
  semesterId?: string;
  semesterName?: string;
}): {
  bills: AfterschoolFareBill[];
  summary: {
    totalStudents: number;
    totalEnrollments: number;
    busRidingStudents: number;
    totalTuition: number;
    totalTextbook: number;
    totalMaterial: number;
    totalBusFare: number;
    totalAdjustments: number;
    grandTotal: number;
    currency: string;
  };
} {
  const {
    enrollments = [],
    courses = [],
    studentsList = [],
    destinations = [],
    saturdayBusFareSettings = {
      'Zone A (근거리)': 30000,
      'Zone B (중거리)': 50000,
      'Zone C (원거리)': 70000,
    },
    busFareCurrency = 'VND',
    teacherApplySettings,
    adjustments = {},
    semesterId = 'sem_current',
    semesterName = '2026학년도 1학기 방과후학교',
  } = params;

  // 확정(ENROLLED) 수강생만 대상
  const enrolledList = enrollments.filter((e) => e.status === 'ENROLLED');

  // 학생별 고유 키로 그룹화 (이름_학년_반_학번 또는 이름_전화번호)
  const studentMap = new Map<string, {
    key: string;
    name: string;
    grade: string | number;
    classNum: string | number;
    studentNum?: string | number;
    contact?: string;
    parentPhone?: string;
    enrollmentItems: Enrollment[];
    kisbusNo?: string;
  }>();

  enrolledList.forEach((e) => {
    const key = `${normalizeString(e.name)}_${e.grade}_${e.classNum}_${e.studentNum || 0}`;
    if (!studentMap.has(key)) {
      studentMap.set(key, {
        key,
        name: e.name,
        grade: e.grade,
        classNum: e.classNum,
        studentNum: e.studentNum,
        contact: e.phone || '',
        parentPhone: e.parentPhone || '',
        enrollmentItems: [],
        kisbusNo: e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청' ? e.kisbusNo : undefined,
      });
    }
    const group = studentMap.get(key)!;
    group.enrollmentItems.push(e);
    if (!group.kisbusNo && e.kisbusNo && e.kisbusNo !== '-' && e.kisbusNo !== '미신청') {
      group.kisbusNo = e.kisbusNo;
    }
  });

  // 강좌 매칭 헬퍼 함수
  const getMatchedCourse = (enrollment: Enrollment): Course | undefined => {
    const cId = enrollment.courseId;
    const extraTitle = (enrollment as any).courseTitle || (enrollment as any).courseName || '';

    let matched = courses.find((c) => c.id === cId || String(c.id) === String(cId));
    if (matched) return matched;

    if (cId) {
      matched = courses.find((c) => c.title === cId || (c as any).name === cId);
      if (matched) return matched;
      matched = findMatchingCourse(cId, courses);
      if (matched) return matched;
    }

    if (extraTitle) {
      matched = findMatchingCourse(extraTitle, courses);
      if (matched) return matched;
    }
    return undefined;
  };

  // 학생별 버스 요금 계산 헬퍼
  const getStudentBusFare = (
    name: string,
    grade: string | number,
    classNum: string | number,
    kisbusNo?: string,
    hasSaturdayCourse?: boolean
  ): { isRiding: boolean; busNo: string; destinationName: string; zone: string; fare: number } => {
    if (!kisbusNo || kisbusNo === '-' || kisbusNo === '미신청') {
      return { isRiding: false, busNo: '미신청', destinationName: '-', zone: '미신청', fare: 0 };
    }

    // 학생 정보 조회
    const student = studentsList.find(
      (s) =>
        normalizeString(s.name) === normalizeString(name) &&
        Number(s.grade) === Number(grade) &&
        Number(s.class) === Number(classNum)
    );

    let destinationName = '목적지 미지정';
    let zone = 'Zone C (원거리)';

    if (student) {
      const destId =
        student.satAfternoonDestinationId ||
        student.afterSchoolDestinations?.['Saturday' as any] ||
        student.afternoonDestinationId ||
        student.morningDestinationId;

      if (destId) {
        const destObj = destinations.find((d) => d.id === destId || d.name === destId);
        destinationName = destObj ? destObj.name : destId;
        zone = destObj?.saturdayZone || destObj?.zone || 'Zone C (원거리)';
      }
    }

    // 버스비 산정 규칙:
    // - 토요/방학 버스는 saturdayBusFareSettings 기준 거리별 요금 책정 (7군 90만VND, 7군외 160만VND 등)
    // - 평일 하교 버스는 정규 버스 연동이므로 0원
    let calculatedFare = 0;
    if (hasSaturdayCourse || (teacherApplySettings as any)?.semester?.includes('방학')) {
      const keys = Object.keys(saturdayBusFareSettings || {});
      if (zone && saturdayBusFareSettings[zone] !== undefined) {
        calculatedFare = saturdayBusFareSettings[zone];
      } else if (destinationName && saturdayBusFareSettings[destinationName] !== undefined) {
        calculatedFare = saturdayBusFareSettings[destinationName];
      } else if (keys.length > 0) {
        const isDistrict7 = (
          (destinationName && destinationName.includes('7군') && !destinationName.includes('7군 외')) ||
          (zone && zone.includes('7군') && !zone.includes('7군 외')) ||
          (zone && zone.includes('Zone A')) ||
          (destinationName && (destinationName.includes('Midtown') || destinationName.includes('Scenic') || destinationName.includes('Happy') || destinationName.includes('Sky') || destinationName.includes('Parkview') || destinationName.includes('Green') || destinationName.includes('Riverpark') || destinationName.includes('Grand View') || destinationName.includes('Panorama') || destinationName.includes('Star Hill') || destinationName.includes('Hung Vang') || destinationName.includes('My Khanh') || destinationName.includes('My Phuc') || destinationName.includes('Garden Court') || destinationName.includes('Garden Plaza') || destinationName.includes('Oakwood') || destinationName.includes('Sunrise') || destinationName.includes('Eco Green') || destinationName.includes('Richlane')))
        );

        const d7Key = keys.find(k => k.includes('7군') && !k.includes('7군 외') && !k.includes('기타'));
        const nonD7Key = keys.find(k => k.includes('7군 외') || k.includes('기타') || k.includes('원거리') || k.includes('Zone B') || k.includes('Zone C'));

        if (isDistrict7 && d7Key && saturdayBusFareSettings[d7Key]) {
          calculatedFare = saturdayBusFareSettings[d7Key];
          zone = d7Key;
        } else if (!isDistrict7 && nonD7Key && saturdayBusFareSettings[nonD7Key]) {
          calculatedFare = saturdayBusFareSettings[nonD7Key];
          zone = nonD7Key;
        } else if (isDistrict7) {
          calculatedFare = saturdayBusFareSettings[keys[0]] || 900000;
          zone = keys[0] || '7군';
        } else {
          calculatedFare = saturdayBusFareSettings[keys[1]] || saturdayBusFareSettings[keys[0]] || 1600000;
          zone = keys[1] || '7군 외, 기타 지역';
        }
      } else {
        calculatedFare = 900000;
      }
    }

    return {
      isRiding: true,
      busNo: kisbusNo,
      destinationName,
      zone,
      fare: calculatedFare,
    };
  };

  let totalTuitionSum = 0;
  let totalTextbookSum = 0;
  let totalMaterialSum = 0;
  let totalBusFareSum = 0;
  let totalAdjustmentsSum = 0;
  let grandTotalSum = 0;
  let busRiderCount = 0;

  const bills: AfterschoolFareBill[] = [];

  studentMap.forEach((studentGroup) => {
    let hasSaturday = false;
    const courseItems: AfterschoolBillCourseItem[] = studentGroup.enrollmentItems.map((e) => {
      const matchedCourse = getMatchedCourse(e);
      const isSat = Boolean(
        matchedCourse &&
          (matchedCourse.classDays?.includes('토') ||
            matchedCourse.title?.includes('토요') ||
            matchedCourse.title?.includes('토요일'))
      );
      if (isSat) hasSaturday = true;

      // 수강료 산정: enrollment 또는 course의 tuition
      let courseTuition = 0;
      if (!matchedCourse?.isFree && (teacherApplySettings as any)?.tuitionType !== '학교예산') {
        if (e.tuition !== undefined && e.tuition >= 0) {
          courseTuition = e.tuition;
        } else if (matchedCourse?.tuition !== undefined && matchedCourse.tuition >= 0) {
          courseTuition = matchedCourse.tuition;
        } else {
          // 차시당 단가 × 총 차시
          const unitPrice = (teacherApplySettings as any)?.tuitionPerSession || 80000;
          const totalSessions = matchedCourse?.totalSessions || 20;
          courseTuition = unitPrice * totalSessions;
        }

        // 주 2회 이상 강좌에서 주 1회만 선택 수강하는 경우 50% 감액 (절반 적용)
        const classDays = matchedCourse?.classDays || [];
        if (classDays.length >= 2 && e.selectedDays && e.selectedDays.length === 1) {
          courseTuition = Math.round(courseTuition / 2);
        }
      }

      const courseTextbook = e.textbookFee || matchedCourse?.textbookFee || 0;
      const courseMaterial = e.materialFee || matchedCourse?.materialFee || 0;
      const subtotal = courseTuition + courseTextbook + courseMaterial;

      const isFree = Boolean(matchedCourse?.isFree || (teacherApplySettings as any)?.tuitionType === '학교예산');

      return {
        courseId: matchedCourse?.id || e.courseId,
        courseTitle: matchedCourse?.title || (e as any).courseTitle || '방과후 강좌',
        classDays: matchedCourse?.classDays,
        instructorName: matchedCourse?.instructorName || (e as any).instructorName || (matchedCourse as any)?.teacherName || '',
        classroom: matchedCourse?.classroom || (matchedCourse as any)?.room || '',
        classTime: matchedCourse?.classTime || (matchedCourse as any)?.period || '',
        isFree,
        tuition: courseTuition,
        textbookFee: courseTextbook,
        materialFee: courseMaterial,
        courseSubtotal: subtotal,
      };
    });


    const studentTuition = courseItems.reduce((acc, cur) => acc + cur.tuition, 0);
    const studentTextbook = courseItems.reduce((acc, cur) => acc + cur.textbookFee, 0);
    const studentMaterial = courseItems.reduce((acc, cur) => acc + cur.materialFee, 0);
    const coursesTotal = studentTuition + studentTextbook + studentMaterial;

    // 버스 요금 산출
    const busDetail = getStudentBusFare(
      studentGroup.name,
      studentGroup.grade,
      studentGroup.classNum,
      studentGroup.kisbusNo,
      hasSaturday
    );

    let finalBusFare = busDetail.fare;

    // 개별 학생 수정/조정 확인
    const adjKey = studentGroup.key;
    const studentAdj = adjustments[adjKey];
    let isAdjusted = false;
    let adjustmentAmount = 0;
    let adjustmentReason = '';
    let customTotalFare: number | null = null;

    if (studentAdj) {
      if (studentAdj.customBusFee !== undefined && studentAdj.customBusFee !== null) {
        finalBusFare = Math.max(0, studentAdj.customBusFee);
        isAdjusted = true;
      }
      if (studentAdj.adjustmentAmount !== undefined && studentAdj.adjustmentAmount !== 0) {
        adjustmentAmount = studentAdj.adjustmentAmount;
        isAdjusted = true;
      }
      if (studentAdj.customTotalFare !== undefined && studentAdj.customTotalFare !== null) {
        customTotalFare = Math.max(0, studentAdj.customTotalFare);
        isAdjusted = true;
      }
      if (studentAdj.adjustmentReason) {
        adjustmentReason = studentAdj.adjustmentReason;
      }
    }

    let finalTotalFare = Math.max(0, coursesTotal + finalBusFare + adjustmentAmount);
    if (customTotalFare !== null && customTotalFare !== undefined) {
      finalTotalFare = customTotalFare;
    }

    if (busDetail.isRiding) {
      busRiderCount++;
    }

    totalTuitionSum += studentTuition;
    totalTextbookSum += studentTextbook;
    totalMaterialSum += studentMaterial;
    totalBusFareSum += finalBusFare;
    totalAdjustmentsSum += adjustmentAmount;
    grandTotalSum += finalTotalFare;

    bills.push({
      id: `${semesterId}_${studentGroup.key}`,
      semesterId,
      semesterName,
      studentName: studentGroup.name,
      grade: studentGroup.grade,
      classNum: studentGroup.classNum,
      studentNum: studentGroup.studentNum,
      contact: studentGroup.contact,
      parentPhone: studentGroup.parentPhone,
      courses: courseItems,
      tuitionSubtotal: studentTuition,
      textbookSubtotal: studentTextbook,
      materialSubtotal: studentMaterial,
      coursesTotalFee: coursesTotal,
      isBusRiding: busDetail.isRiding,
      busNo: busDetail.isRiding ? busDetail.busNo : undefined,
      destinationName: busDetail.isRiding ? busDetail.destinationName : undefined,
      zone: busDetail.isRiding ? busDetail.zone : undefined,
      busFare: finalBusFare,
      isAdjusted,
      adjustmentAmount,
      adjustmentReason: adjustmentReason || undefined,
      customTotalFare,
      finalTotalFare,
      currency: busFareCurrency,
      issuedAt: new Date().toISOString(),
      isConfirmed: false,
    });
  });

  // 학년/반/이름 정렬
  bills.sort((a, b) => {
    const gradeA = Number(a.grade) || 0;
    const gradeB = Number(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;
    const classA = Number(a.classNum) || 0;
    const classB = Number(b.classNum) || 0;
    if (classA !== classB) return classA - classB;
    return a.studentName.localeCompare(b.studentName, 'ko');
  });

  return {
    bills,
    summary: {
      totalStudents: bills.length,
      totalEnrollments: enrolledList.length,
      busRidingStudents: busRiderCount,
      totalTuition: totalTuitionSum,
      totalTextbook: totalTextbookSum,
      totalMaterial: totalMaterialSum,
      totalBusFare: totalBusFareSum,
      totalAdjustments: totalAdjustmentsSum,
      grandTotal: grandTotalSum,
      currency: busFareCurrency,
    },
  };
}

/**
 * 관리자가 방과후학교 수강료 및 버스비 청구서를 일괄 발행하여 Firestore에 저장합니다.
 */
export async function issueAfterschoolBills(
  semesterId: string,
  semesterName: string,
  bills: AfterschoolFareBill[]
): Promise<void> {
  const issuedAt = new Date().toISOString();
  const stampedBills = bills.map((b) => ({
    ...b,
    issuedAt,
    isConfirmed: false,
  }));

  await setDocument<AfterschoolFareBillsStore>('afterschool_fare_bills', `semester_${semesterId}`, {
    semesterId,
    semesterName,
    issuedAt,
    bills: stampedBills,
  });

  await setDocument<{ activeSemesterId: string; lastIssuedAt: string }>(
    'afterschool_fare_bills',
    'latest_active',
    {
      activeSemesterId: semesterId,
      lastIssuedAt: issuedAt,
    }
  );
}

/**
 * 특정 기수/학기의 방과후 청구서 목록을 조회합니다.
 */
export async function getAfterschoolBills(semesterId: string): Promise<AfterschoolFareBillsStore | null> {
  return fetchDocument<AfterschoolFareBillsStore>('afterschool_fare_bills', `semester_${semesterId}`);
}

/**
 * 실시간으로 최신 활성 방과후 청구서 포인터를 구독합니다.
 */
export function onLatestActiveAfterschoolBillsUpdate(
  callback: (data: { activeSemesterId: string; lastIssuedAt: string } | null) => void
): () => void {
  return onDocumentUpdate<{ activeSemesterId: string; lastIssuedAt: string }>(
    'afterschool_fare_bills',
    'latest_active',
    callback
  );
}

/**
 * 학부모 로그인 시 자녀 정보와 매칭되는 방과후 청구서를 찾습니다.
 */
export function findStudentAfterschoolBill(
  bills: AfterschoolFareBill[],
  options: {
    studentName?: string;
    grade?: string | number;
    classNum?: string | number;
    contact?: string;
  }
): AfterschoolFareBill | null {
  const { studentName, grade, classNum, contact } = options;
  if (!studentName) return null;
  const normName = normalizeString(studentName);

  // 1차: 이름 + 학년 + 반 일치
  if (grade !== undefined && classNum !== undefined) {
    const match = bills.find((b) => {
      const nameMatch = normalizeString(b.studentName) === normName;
      const gradeMatch = Number(b.grade) === Number(grade);
      const classMatch = Number(b.classNum) === Number(classNum);
      return nameMatch && gradeMatch && classMatch;
    });
    if (match) return match;
  }

  // 2차: 이름 + 연락처 뒷자리
  if (contact && contact.replace(/\D/g, '').length >= 4) {
    const cleanPhone = contact.replace(/\D/g, '');
    const match = bills.find((b) => {
      const nameMatch = normalizeString(b.studentName) === normName;
      const bPhone = (b.contact || b.parentPhone || '').replace(/\D/g, '');
      const phoneMatch = bPhone.endsWith(cleanPhone.slice(-4)) || cleanPhone.endsWith(bPhone.slice(-4));
      return nameMatch && phoneMatch;
    });
    if (match) return match;
  }

  // 3차: 이름 일치
  const byName = bills.find((b) => normalizeString(b.studentName) === normName);
  return byName || null;
}

/**
 * 학부모의 방과후 청구서 확인 상태를 저장합니다.
 */
export async function confirmStudentAfterschoolBill(
  semesterId: string,
  billId: string
): Promise<void> {
  const store = await getAfterschoolBills(semesterId);
  if (!store || !store.bills) return;

  const now = new Date().toISOString();
  const updatedBills = store.bills.map((b) => {
    if (b.id === billId) {
      return { ...b, isConfirmed: true, confirmedAt: now };
    }
    return b;
  });

  await setDocument<AfterschoolFareBillsStore>('afterschool_fare_bills', `semester_${semesterId}`, {
    ...store,
    bills: updatedBills,
  });
}

/**
 * 방과후학교 수강료 및 버스비 청구 내역서를 엑셀로 다운로드합니다.
 */
export async function downloadAfterschoolFareExcel(
  bills: AfterschoolFareBill[],
  semesterName: string,
  currency: string
) {
  const XLSX = await import('xlsx');

  const headers = [
    '순번',
    '학생명',
    '학년',
    '반',
    '학번',
    '학부모 연락처',
    '수강 강좌 목록',
    '강좌 수',
    '순수 수강료',
    '교재비',
    '재료비',
    '강좌 합계액',
    '스쿨버스 탑승여부',
    '버스 호차',
    '목적지 / Zone',
    '방과후 버스요금',
    '관리자 조정액(사유)',
    '최종 납부 청구액',
  ];

  const rows = bills.map((b, idx) => [
    idx + 1,
    b.studentName,
    `${b.grade}학년`,
    `${b.classNum}반`,
    b.studentNum ? `${b.studentNum}번` : '',
    b.parentPhone || b.contact || '',
    b.courses.map((c) => c.courseTitle).join(', '),
    b.courses.length,
    b.tuitionSubtotal,
    b.textbookSubtotal,
    b.materialSubtotal,
    b.coursesTotalFee,
    b.isBusRiding ? '탑승' : '미탑승',
    b.isBusRiding ? (b.busNo || '-') : '-',
    b.isBusRiding ? `${b.destinationName || '-'} (${b.zone || '-'})` : '-',
    b.busFare,
    b.isAdjusted
      ? `${b.adjustmentAmount && b.adjustmentAmount > 0 ? `+${b.adjustmentAmount}` : b.adjustmentAmount || 0} (${b.adjustmentReason || '수동조정'})`
      : '-',
    b.finalTotalFare,
  ]);

  const totalFinalSum = bills.reduce((acc, cur) => acc + cur.finalTotalFare, 0);
  const totalTuitionSum = bills.reduce((acc, cur) => acc + cur.tuitionSubtotal, 0);
  const totalBusSum = bills.reduce((acc, cur) => acc + cur.busFare, 0);

  rows.push([
    '합계',
    `총 ${bills.length}명`,
    '',
    '',
    '',
    '',
    '',
    '',
    totalTuitionSum,
    '',
    '',
    '',
    '',
    '',
    '',
    totalBusSum,
    '',
    totalFinalSum,
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '방과후_수강료_청구내역');

  const fileName = `방과후수강료청구서_${semesterName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
