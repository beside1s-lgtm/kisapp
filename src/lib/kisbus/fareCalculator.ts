import type { Student, Destination, BusFareConfig, BusQuarterSetting } from './types';
import type { AcademicCalendarConfig } from '@/lib/types';
import { calculateSchoolDays } from '@/lib/services/academicCalendarService';
import { normalizeString } from './utils';

export function getGradeRank(gradeStr: string | null | undefined): number {
  if (!gradeStr) return 0;
  const upper = gradeStr.trim().toUpperCase();
  if (upper.startsWith('K')) {
    const num = parseInt(upper.replace('K', ''), 10);
    return isNaN(num) ? -10 : -10 + num;
  }
  if (upper.startsWith('S')) {
    const num = parseInt(upper.replace('S', ''), 10);
    return isNaN(num) ? -5 : -5 + num;
  }
  const num = parseInt(upper.replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

export interface StudentBusFareDetail {
  studentId: string;
  studentName: string;
  grade: string;
  studentClass: string;
  contact: string;
  isRiding: boolean;
  destinationId: string | null;
  destinationName: string;
  zone: string;
  baseDailyFare: number;
  destinationRiderCount: number;
  isSmallGroup: boolean;
  smallGroupSurcharge: number;
  totalDailyFare: number;
  baseQuarterDays: number; // 분기 기본 평일 등교일수
  excludedDays: number; // 학년별 제외(차감) 일수 (수학여행 등)
  gradeExceptionReason?: string; // 제외 사유 (예: "수학여행 (3일 제외)")
  quarterDays: number; // 학생에게 실제 적용된 최종 등교일수
  rawQuarterFare: number;
  siblingGroupId: string | null;
  siblingCount: number;
  siblingRiderCount: number;
  isSiblingDiscounted: boolean;
  discountRate: number;
  discountAmount: number;
  // ── 개별 학생 수동 수정/조정(오버라이드) 필드 ──
  isAdjusted?: boolean;
  adjustmentAmount: number; // 가감액 (+ / -)
  adjustmentReason?: string; // 사유 (예: 5월 전학 일할계산, 감면 등)
  customFare?: number | null; // 직접 입력한 최종 금액
  finalQuarterFare: number;
}

export function getDefaultQuarters(): BusQuarterSetting[] {
  return [
    {
      id: 'q1',
      name: '1분기 (3월 ~ 5월)',
      startDate: '2026-03-02',
      endDate: '2026-05-29',
      manualDays: null,
    },
    {
      id: 'q2',
      name: '2분기 (6월 ~ 7월 여름방학 전)',
      startDate: '2026-06-01',
      endDate: '2026-07-17',
      manualDays: null,
    },
    {
      id: 'q3',
      name: '3분기 (8월 개학 ~ 10월)',
      startDate: '2026-08-17',
      endDate: '2026-10-30',
      manualDays: null,
    },
    {
      id: 'q4',
      name: '4분기 (11월 ~ 1월 종업식 전)',
      startDate: '2026-11-02',
      endDate: '2027-01-08',
      manualDays: null,
    },
  ];
}

export function calculateAllStudentsBusFare(params: {
  students: Student[];
  destinations: Destination[];
  fareConfig?: BusFareConfig;
  selectedQuarter?: BusQuarterSetting;
  academicCalendar?: AcademicCalendarConfig;
}): {
  studentDetails: StudentBusFareDetail[];
  summary: {
    totalStudents: number;
    ridingStudents: number;
    smallGroupStudents: number;
    discountedStudents: number;
    quarterDays: number;
    totalAmount: number;
    currency: string;
  };
} {
  const { students = [], destinations = [], fareConfig = {}, selectedQuarter, academicCalendar } = params;

  const busFareSettings = fareConfig.busFareSettings || {
    'Zone A (근거리)': 50000,
    'Zone B (중거리)': 80000,
    'Zone C (원거리)': 100000,
  };
  const under3Surcharge = fareConfig.under3Surcharge || 0;
  const siblingDiscountRate = fareConfig.siblingDiscountRate !== undefined ? fareConfig.siblingDiscountRate : 10;
  const currency = fareConfig.busFareCurrency || 'VND';

  const activeQ = selectedQuarter || getDefaultQuarters()[0];
  let baseQuarterDays = 0;
  if (activeQ.manualDays && activeQ.manualDays > 0) {
    baseQuarterDays = activeQ.manualDays;
  } else {
    const calc = calculateSchoolDays(activeQ.startDate, activeQ.endDate, academicCalendar);
    baseQuarterDays = calc.schoolDays;
  }

  const destMap = new Map<string, Destination>();
  destinations.forEach((d) => {
    destMap.set(d.id, d);
    destMap.set(normalizeString(d.name), d);
  });

  const studentDestMap = new Map<string, { destId: string | null; destObj: Destination | null }>();
  const destRiderCountMap = new Map<string, number>();

  students.forEach((s) => {
    const targetDestId = s.morningDestinationId || s.afternoonDestinationId || null;
    let targetDest: Destination | null = null;

    if (targetDestId) {
      targetDest = destMap.get(targetDestId) || destMap.get(normalizeString(targetDestId)) || null;
    }

    const isRiding = !!targetDest;
    studentDestMap.set(s.id, { destId: targetDestId, destObj: targetDest });

    if (isRiding && targetDest) {
      const destKey = targetDest.id;
      destRiderCountMap.set(destKey, (destRiderCountMap.get(destKey) || 0) + 1);
    }
  });

  const siblingGroups = new Map<string, Student[]>();

  students.forEach((s) => {
    let groupKey: string | null = null;
    if (s.siblingGroupId) {
      groupKey = `group_${s.siblingGroupId}`;
    } else if (s.contact && s.contact.trim().length >= 8) {
      groupKey = `phone_${s.contact.replace(/\D/g, '')}`;
    }

    if (groupKey) {
      if (!siblingGroups.has(groupKey)) {
        siblingGroups.set(groupKey, []);
      }
      siblingGroups.get(groupKey)!.push(s);
    }
  });

  const studentDiscountMap = new Map<
    string,
    {
      siblingCount: number;
      siblingRiderCount: number;
      isSiblingDiscounted: boolean;
      discountRate: number;
    }
  >();

  siblingGroups.forEach((groupStudents) => {
    const ridingSiblings = groupStudents.filter((s) => {
      const { destObj } = studentDestMap.get(s.id) || {};
      return !!destObj;
    });

    const totalCount = groupStudents.length;
    const riderCount = ridingSiblings.length;

    if (riderCount >= 2) {
      const sortedRiders = [...ridingSiblings].sort((a, b) => {
        const rankA = getGradeRank(a.grade);
        const rankB = getGradeRank(b.grade);
        if (rankA !== rankB) return rankB - rankA;
        return (a.name || '').localeCompare(b.name || '', 'ko');
      });

      sortedRiders.forEach((s, idx) => {
        if (idx === 0) {
          studentDiscountMap.set(s.id, {
            siblingCount: totalCount,
            siblingRiderCount: riderCount,
            isSiblingDiscounted: false,
            discountRate: 0,
          });
        } else {
          studentDiscountMap.set(s.id, {
            siblingCount: totalCount,
            siblingRiderCount: riderCount,
            isSiblingDiscounted: true,
            discountRate: siblingDiscountRate,
          });
        }
      });
    } else {
      groupStudents.forEach((s) => {
        studentDiscountMap.set(s.id, {
          siblingCount: totalCount,
          siblingRiderCount: riderCount,
          isSiblingDiscounted: false,
          discountRate: 0,
        });
      });
    }
  });

  let totalAmount = 0;
  let ridingCount = 0;
  let smallGroupCount = 0;
  let discountedCount = 0;

  const studentDetails: StudentBusFareDetail[] = students.map((s) => {
    const { destObj } = studentDestMap.get(s.id) || {};
    const isRiding = !!destObj;
    const destName = destObj?.name || '미지정';
    const zone = destObj?.zone && busFareSettings[destObj.zone] !== undefined ? destObj.zone : '미지정';
    const baseDailyFare = isRiding && zone !== '미지정' ? busFareSettings[zone] || 0 : 0;

    const riderCountForDest = destObj ? destRiderCountMap.get(destObj.id) || 0 : 0;
    const isSmallGroup = isRiding && riderCountForDest >= 1 && riderCountForDest <= 3;
    const currentSmallGroupSurcharge = isSmallGroup ? under3Surcharge : 0;

    // 학년별 등교일수 제외(차감) 계산
    const gradeKey = (s.grade || '').trim();
    let excludedDays = 0;
    let gradeExceptionReason = '';

    if (activeQ.gradeExceptions) {
      if (activeQ.gradeExceptions[gradeKey] !== undefined) {
        excludedDays = activeQ.gradeExceptions[gradeKey] || 0;
      } else {
        const numGrade = gradeKey.replace(/\D/g, '');
        if (numGrade && activeQ.gradeExceptions[numGrade] !== undefined) {
          excludedDays = activeQ.gradeExceptions[numGrade] || 0;
        }
      }
    }

    if (activeQ.gradeExceptionReasons) {
      gradeExceptionReason = activeQ.gradeExceptionReasons[gradeKey] || 
        activeQ.gradeExceptionReasons[gradeKey.replace(/\D/g, '')] || '';
    }

    // ── 개별 학생 수동 수정/조정(오버라이드) 확인 ──
    const studentAdj = activeQ.studentAdjustments?.[s.id];
    let isAdjusted = false;

    // 등교일수 (학생 개별 등교일수 오버라이드가 있으면 우선 적용)
    let studentQuarterDays = Math.max(0, baseQuarterDays - excludedDays);
    if (studentAdj?.customDays !== undefined && studentAdj.customDays !== null) {
      studentQuarterDays = Math.max(0, studentAdj.customDays);
      isAdjusted = true;
    }

    const totalDailyFare = isRiding ? baseDailyFare + currentSmallGroupSurcharge : 0;
    const rawQuarterFare = totalDailyFare * studentQuarterDays;

    const discInfo = studentDiscountMap.get(s.id) || {
      siblingCount: 1,
      siblingRiderCount: isRiding ? 1 : 0,
      isSiblingDiscounted: false,
      discountRate: 0,
    };

    let isSiblingDiscounted = isRiding && discInfo.isSiblingDiscounted;
    let appliedDiscountRate = isSiblingDiscounted ? discInfo.discountRate : 0;

    // 개별 형제할인 오버라이드
    if (studentAdj?.forceSiblingDiscount !== undefined && studentAdj.forceSiblingDiscount !== null) {
      isSiblingDiscounted = isRiding && studentAdj.forceSiblingDiscount;
      isAdjusted = true;
    }
    if (studentAdj?.customDiscountRate !== undefined && studentAdj.customDiscountRate !== null) {
      appliedDiscountRate = studentAdj.customDiscountRate;
      isSiblingDiscounted = isRiding && appliedDiscountRate > 0;
      isAdjusted = true;
    }

    const discountAmount = isRiding ? Math.round((rawQuarterFare * appliedDiscountRate) / 100) : 0;
    let calculatedFare = isRiding ? Math.max(0, rawQuarterFare - discountAmount) : 0;

    let adjustmentAmount = 0;
    let adjustmentReason = '';
    let customFare: number | null = null;

    if (studentAdj) {
      if (studentAdj.adjustmentAmount !== undefined && studentAdj.adjustmentAmount !== 0) {
        adjustmentAmount = studentAdj.adjustmentAmount;
        calculatedFare = Math.max(0, calculatedFare + adjustmentAmount);
        isAdjusted = true;
      }
      if (studentAdj.customFare !== undefined && studentAdj.customFare !== null) {
        customFare = studentAdj.customFare;
        calculatedFare = Math.max(0, customFare);
        isAdjusted = true;
      }
      if (studentAdj.adjustmentReason) {
        adjustmentReason = studentAdj.adjustmentReason;
      }
    }

    const finalQuarterFare = isRiding ? calculatedFare : 0;

    if (isRiding) {
      ridingCount++;
      totalAmount += finalQuarterFare;
      if (isSmallGroup) smallGroupCount++;
      if (isSiblingDiscounted) discountedCount++;
    }

    return {
      studentId: s.id,
      studentName: s.nameKo || s.name || '',
      grade: s.grade || '',
      studentClass: s.class || '',
      contact: s.contact || '',
      isRiding,
      destinationId: destObj?.id || null,
      destinationName: destName,
      zone,
      baseDailyFare,
      destinationRiderCount: riderCountForDest,
      isSmallGroup,
      smallGroupSurcharge: currentSmallGroupSurcharge,
      totalDailyFare,
      baseQuarterDays,
      excludedDays,
      gradeExceptionReason: gradeExceptionReason || undefined,
      quarterDays: studentQuarterDays,
      rawQuarterFare,
      siblingGroupId: s.siblingGroupId || null,
      siblingCount: discInfo.siblingCount,
      siblingRiderCount: discInfo.siblingRiderCount,
      isSiblingDiscounted,
      discountRate: appliedDiscountRate,
      discountAmount,
      isAdjusted,
      adjustmentAmount,
      adjustmentReason: adjustmentReason || undefined,
      customFare,
      finalQuarterFare,
    };
  });

  studentDetails.sort((a, b) => {
    if (a.isRiding !== b.isRiding) return a.isRiding ? -1 : 1;
    const rankA = getGradeRank(a.grade);
    const rankB = getGradeRank(b.grade);
    if (rankA !== rankB) return rankA - rankB;
    const classA = parseInt(a.studentClass, 10) || 0;
    const classB = parseInt(b.studentClass, 10) || 0;
    if (classA !== classB) return classA - classB;
    return a.studentName.localeCompare(b.studentName, 'ko');
  });

  return {
    studentDetails,
    summary: {
      totalStudents: students.length,
      ridingStudents: ridingCount,
      smallGroupStudents: smallGroupCount,
      discountedStudents: discountedCount,
      quarterDays: baseQuarterDays,
      totalAmount,
      currency,
    },
  };
}

export async function downloadBusFareExcel(
  details: StudentBusFareDetail[],
  quarter: BusQuarterSetting,
  currency: string
) {
  const XLSX = await import('xlsx');

  const headers = [
    '순번',
    '학생명',
    '학년',
    '반',
    '학부모 연락처',
    '탑승여부',
    '목적지',
    'Zone(구역)',
    '목적지 탑승인원',
    '일일 기본요금',
    '3명이하 추가금',
    '일일 합계요금',
    '기본 등교일수',
    '제외 일수(사유)',
    '적용 등교일수',
    '분기 원금',
    '형제복수탑승',
    '형제할인율(%)',
    '할인금액',
    '관리자 조정액(사유)',
    '최종 청구금액',
  ];

  const ridingOnly = details.filter((d) => d.isRiding);

  const rows = ridingOnly.map((d, idx) => [
    idx + 1,
    d.studentName,
    d.grade ? `${d.grade}학년` : '',
    d.studentClass ? `${d.studentClass}반` : '',
    d.contact,
    d.isRiding ? '탑승' : '미탑승',
    d.destinationName,
    d.zone,
    `${d.destinationRiderCount}명`,
    d.baseDailyFare,
    d.smallGroupSurcharge,
    d.totalDailyFare,
    d.baseQuarterDays,
    d.excludedDays > 0 ? `-${d.excludedDays}일 (${d.gradeExceptionReason || '수학여행 등'})` : '0일',
    d.quarterDays,
    d.rawQuarterFare,
    d.siblingRiderCount >= 2 ? `${d.siblingRiderCount}명 탑승` : '해당없음',
    d.discountRate > 0 ? `${d.discountRate}%` : '0%',
    d.discountAmount,
    d.isAdjusted ? `${d.adjustmentAmount > 0 ? `+${d.adjustmentAmount}` : d.adjustmentAmount} (${d.adjustmentReason || '수동조정'})` : '-',
    d.finalQuarterFare,
  ]);

  const totalSum = ridingOnly.reduce((acc, cur) => acc + cur.finalQuarterFare, 0);
  rows.push([
    '합계',
    `총 ${ridingOnly.length}명`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `${quarter.manualDays || details[0]?.baseQuarterDays || 0}일`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalSum,
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '스쿨버스_분기요금_청구내역');

  const fileName = `스쿨버스_요금청구서_${quarter.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

