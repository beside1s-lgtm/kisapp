import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Student } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Removes Vietnamese tone marks/accents and converts to base Latin alphabet.
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFC");
}

/**
 * Sanitizes strings for system storage and CSV compatibility.
 * Removes Vietnamese accents and replaces commas with hyphens.
 * This ensures consistency in the database and prevents CSV structure breaking.
 */
export function sanitizeDataForSystem(str: any): string {
  if (str === null || str === undefined) return '';
  let val = str.toString();
  // 1. Remove Vietnamese accents
  val = removeVietnameseTones(val);
  // 2. Replace commas with hyphens to prevent CSV column breaking
  val = val.replace(/,/g, '-');
  // 3. Replace multiple spaces with single space and trim
  return val.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a string for robust comparison/matching.
 * Removes accents, treats commas and hyphens as the same, 
 * removes all whitespace, and converts to lowercase.
 */
export function normalizeString(s: any): string {
  if (s === null || s === undefined) return '';
  let val = s.toString();
  // 1. Remove Vietnamese accents
  val = removeVietnameseTones(val);
  // 2. Treat commas and hyphens as identical for matching purposes
  val = val.replace(/,/g, '-');
  // 3. Remove all whitespace and convert to lowercase
  return val.replace(/\s+/g, '').toLowerCase();
}

/**
 * Returns the student's name based on the language.
 * Localizes name display: prioritizing current language.
 * If current language name is missing, falls back to the other one.
 */
export function getStudentName(student: Student | null, lang: string): string {
  if (!student) return "";
  
  if (lang === 'ko') {
    return student.nameKo || student.nameEn || student.name || "";
  } else {
    return student.nameEn || student.nameKo || student.name || "";
  }
}

export interface CourseInstructorsSummary {
  mainInstructor: string;
  assistantInstructors: string[];
  allInstructors: string[];
  displayString: string;
  fullListString: string;
}

/**
 * 방과후 강좌(Course)와 스쿨버스 강좌(AfterSchoolClass)의 강사 정보를 상호 보완하여
 * 주강사 및 추가강사(1~4), 보조강사 전체 목록을 통합 도출합니다.
 */
export function getComplementaryInstructors(
  cls?: {
    name?: string;
    teacherName?: string | null;
    teacherName2?: string | null;
    teacherName3?: string | null;
    teacherName4?: string | null;
    assistantTeacherNames?: string[];
    [key: string]: any;
  } | null,
  matchedCourse?: {
    title?: string;
    instructorName?: string | null;
    instructor2?: string | null;
    instructor3?: string | null;
    instructor4?: string | null;
    instructor5?: string | null;
    instructor6?: string | null;
    assistantTeachers?: string[] | string | null;
    assistantInstructor?: string | null;
    [key: string]: any;
  } | null
): CourseInstructorsSummary {
  // 1. 주강사 후보 도출
  let mainInstructor = (matchedCourse?.instructorName || cls?.teacherName || '').trim();
  if (mainInstructor.includes(',')) {
    mainInstructor = mainInstructor.split(',')[0].trim();
  }
  if (!mainInstructor || mainInstructor === '-' || mainInstructor === '교사 미정' || mainInstructor === '강사') {
    mainInstructor = '교사 미정';
  }

  const additionalList: string[] = [];

  const addName = (raw?: any) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach(addName);
      return;
    }
    const str = String(raw);
    const parts = str.split(/[,/&]/);
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
      if (['교사 미정', '-', '강사', 'null', 'undefined'].includes(clean)) continue;
      if (mainInstructor !== '교사 미정' && clean === mainInstructor) continue;
      if (!additionalList.includes(clean)) {
        additionalList.push(clean);
      }
    }
  };

  // 2. 방과후 Course의 추가강사(2~6) 및 보조강사 수집
  addName(matchedCourse?.instructor2);
  addName(matchedCourse?.instructor3);
  addName(matchedCourse?.instructor4);
  addName(matchedCourse?.instructor5);
  addName(matchedCourse?.instructor6);
  addName(matchedCourse?.assistantInstructor);
  addName(matchedCourse?.assistantTeachers);

  // 3. 스쿨버스 AfterSchoolClass의 추가교사(2~6) 및 보조교사 수집
  addName(cls?.teacherName2);
  addName(cls?.teacherName3);
  addName(cls?.teacherName4);
  addName((cls as any)?.teacherName5);
  addName((cls as any)?.teacherName6);
  addName(cls?.assistantTeacherNames);

  // cls.teacherName에 쉼표로 여러 명이 들어있었던 경우
  if (cls?.teacherName && cls.teacherName.includes(',')) {
    const parts = cls.teacherName.split(',');
    for (let i = 1; i < parts.length; i++) {
      addName(parts[i]);
    }
  }

  // matchedCourse.instructorName에 쉼표로 여러 명이 들어있었던 경우
  if (matchedCourse?.instructorName && matchedCourse.instructorName.includes(',')) {
    const parts = matchedCourse.instructorName.split(',');
    for (let i = 1; i < parts.length; i++) {
      addName(parts[i]);
    }
  }

  const allInstructors: string[] = [];
  if (mainInstructor !== '교사 미정') {
    allInstructors.push(mainInstructor);
  }
  allInstructors.push(...additionalList);

  if (allInstructors.length === 0) {
    allInstructors.push('교사 미정');
  }

  const displayString = mainInstructor !== '교사 미정'
    ? (additionalList.length > 0 ? `${mainInstructor} (보조/추가: ${additionalList.join(', ')})` : mainInstructor)
    : (additionalList.length > 0 ? additionalList.join(', ') : '교사 미정');

  const fullListString = allInstructors.join(', ');

  return {
    mainInstructor,
    assistantInstructors: additionalList,
    allInstructors,
    displayString,
    fullListString
  };
}
