import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  onSnapshot,
  deleteDoc as firestoreDeleteDoc,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { UserProfile, Approver, DelegationRule, Department, OrgStructure } from '@/lib/types';
import * as xlsx from 'xlsx';
import { getOrgStructure, saveOrgStructure, getDelegationRules } from '@/lib/services/settingsService';

const getUsersCol = () => collection(getDb(), 'users');

// ─── 사용자 목록 메모리 캐시 (TTL: 5분) ────────────────────────────────────────
let _usersCache: UserProfile[] | null = null;
let _usersCacheTime: number = 0;
const USERS_CACHE_TTL = 5 * 60 * 1000; // 5분

export function invalidateUsersCache() {
  _usersCache = null;
  _usersCacheTime = 0;
}
// ────────────────────────────────────────────────────────────────────────────────

export async function getUserProfileByEmail(email: string, throwOnError: boolean = false): Promise<UserProfile | null> {
  if (!email) return null;
  const userDocRef = doc(getUsersCol(), email.toLowerCase());
  try {
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ...(data as UserProfile),
      name: data?.name || '',
      role: data?.role || '',
      signature: data?.signature || '',
      uid: data?.uid || '',
      email: snap.id,
      isAdmin: data?.isAdmin || false,
      parentPhone: data?.parentPhone ?? null,
      parentSignature: data?.parentSignature ?? null,
      hashedPin: data?.hashedPin ?? null,
      parentName: data?.parentName ?? null,
      studentName: data?.studentName ?? null,
      studentNameEn: data?.studentNameEn ?? null,
      studentGrade: data?.studentGrade ?? null,
      studentClass: data?.studentClass ?? null,
      studentNumber: data?.studentNumber ?? null,
      linkedStudents: data?.linkedStudents || [],
      lastAckAcademicCalVersion: data?.lastAckAcademicCalVersion ?? null,
    };
  } catch (error) {
    console.error(`[UserService] getUserProfileByEmail error:`, error);
    if (throwOnError) {
      throw error;
    }
    return null;
  }
}

export async function updateUserCalendarAck(email: string, version: number) {
  if (!email || !version) return;
  try {
    const userProfileRef = doc(getUsersCol(), email.toLowerCase());
    await setDoc(userProfileRef, { lastAckAcademicCalVersion: version }, { merge: true });
  } catch (error) {
    console.warn('[UserService] updateUserCalendarAck error:', error);
  }
}

export async function saveUserProfile(userId: string, email: string, profileData: Partial<UserProfile>) {
  if (!email || !profileData) return { success: false, error: 'Invalid data' };
  const userProfileRef = doc(getUsersCol(), email.toLowerCase());
  try {
    const docSnap = await getDoc(userProfileRef);
    
    // undefined 필드 제거 방어 코드
    const dataToSave: any = {};
    Object.entries(profileData).forEach(([key, val]) => {
      if (val !== undefined) {
        dataToSave[key] = val;
      }
    });
    
    if (!docSnap.exists() && userId) {
      dataToSave.uid = userId;
    }
    
    await setDoc(userProfileRef, dataToSave, { merge: true });
    invalidateUsersCache();
    const finalProfileSnap = await getDoc(userProfileRef);
    const finalData = finalProfileSnap.data() as UserProfile;

    return { 
      success: true, 
      profile: { ...finalData, email: finalProfileSnap.id, uid: finalData.uid || userId }
    };
  } catch (error: any) {
    console.warn('[UserService] saveUserProfile DB error, fallback to session:', error.message);
    const fallbackProfile: UserProfile = {
      email: email.toLowerCase(),
      uid: userId || 'test_user_uid',
      name: profileData.name || '강지욱',
      role: profileData.role || '부장',
      signature: profileData.signature || '',
      isAdmin: profileData.isAdmin ?? true,
    };
    return { success: true, profile: fallbackProfile, isFallback: true };
  }
}

export async function getUsersDirectory(forceRefresh = false): Promise<UserProfile[]> {
  // 캐시 유효 시 즉시 반환 (네트워크 통신 없음)
  const now = Date.now();
  if (!forceRefresh && _usersCache && (now - _usersCacheTime) < USERS_CACHE_TTL) {
    return _usersCache;
  }
  try {
    const snapshot = await getDocs(getUsersCol());
    if (snapshot.empty) return [];
    const result = snapshot.docs.map((d: any) => {
      const data = d.data();
      return {
        email: d.id,
        uid: data.uid,
        name: data.name,
        role: data.role,
        // signature, parentSignature는 목록에서 불필요 → 제외로 데이터 60~80% 경량화
        isAdmin: data.isAdmin,
        parentPhone: data.parentPhone,
        hashedPin: data.hashedPin,
        // 학부모/학생 정보
        parentName: data.parentName ?? null,
        studentName: data.studentName ?? null,
        studentGrade: data.studentGrade ?? null,
        studentClass: data.studentClass ?? null,
        studentNumber: data.studentNumber ?? null,
        // 추가 교직원 정보
        annualLeaveLimit: data.annualLeaveLimit ?? null,
        dept: data.dept ?? null,
        isFaculty: data.isFaculty ?? null,
        isStaff: data.isStaff ?? null,
        isManualFaculty: data.isManualFaculty ?? null,
        registrationSource: data.registrationSource ?? null,
      } as UserProfile;
    });
    // 캐시 갱신
    _usersCache = result;
    _usersCacheTime = now;
    return result;
  } catch (error) {
    console.error("[UserService] getUsersDirectory failed:", error);
    return [];
  }
}

export function onUsersDirectoryUpdate(callback: (users: UserProfile[]) => void) {
  return onSnapshot(getUsersCol(), (snapshot) => {
    const list = snapshot.docs.map((d: any) => {
      const data = d.data();
      return {
        email: d.id,
        uid: data.uid,
        name: data.name,
        role: data.role,
        signature: data.signature,
        isAdmin: data.isAdmin,
        parentPhone: data.parentPhone,
        parentSignature: data.parentSignature,
        hashedPin: data.hashedPin,
        parentName: data.parentName ?? null,
        studentName: data.studentName ?? null,
        studentGrade: data.studentGrade ?? null,
        studentClass: data.studentClass ?? null,
        studentNumber: data.studentNumber ?? null,
        annualLeaveLimit: data.annualLeaveLimit ?? null,
        dept: data.dept ?? null,
        isFaculty: data.isFaculty ?? null,
        isStaff: data.isStaff ?? null,
      } as UserProfile;
    });
    callback(list);
  }, (err) => console.error("onUsersDirectoryUpdate error:", err));
}

/**
 * 학년 문자열/숫자를 스마트 정규화 (반 정보 포함)
 * 예: 3, '3', '3학년', '3학년부', '초등3', '3-1', '3학년 2반' -> { gradeNumber: '3', gradeName: '3학년', classNumber: '1' }
 */
export function normalizeGrade(raw: any): { gradeNumber: string; gradeName: string; classNumber?: string } | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // 유치원 체크
  if (str.includes('유치원')) {
    const classMatch = str.match(/유치원\s*[-_ ]?\s*(\d+)/) || str.match(/(\d+)\s*반/);
    return {
      gradeNumber: '유치원',
      gradeName: '유치원',
      classNumber: classMatch ? classMatch[1] : undefined,
    };
  }

  // '3-1', '3 - 2', '3학년 1반', '3학년1반' 등 학년-반 패턴 감지
  const gradeClassMatch = str.match(/([1-6])\s*[-_ ]\s*(\d+)/) || str.match(/([1-6])\s*학년\s*(\d+)\s*반?/);
  if (gradeClassMatch) {
    const gNum = gradeClassMatch[1];
    const cNum = gradeClassMatch[2];
    return {
      gradeNumber: gNum,
      gradeName: `${gNum}학년`,
      classNumber: cNum,
    };
  }

  // 단순 1~6 숫자 추출
  const match = str.match(/[1-6]/);
  if (match) {
    const num = match[0];
    return {
      gradeNumber: num,
      gradeName: `${num}학년`,
    };
  }
  return null;
}

/**
 * 부서 문자열을 스마트 정규화 및 조직도 기존 부서와 Fuzzy 매칭
 * 예: '교무', '교무기획', '교무부' -> '교무기획부'
 *     '예체능', '방과후', '예체능방과후부' -> '예체능방과후부'
 */
export function resolveDepartment(raw: any, existingDepts: Department[] = []): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // 1. 기존 부서 목록 중 정확히 일치하는 경우
  const exactMatch = existingDepts.find(d => d.name === str);
  if (exactMatch) return exactMatch.name;

  // 2. 대표 학교 부서 별칭 매핑 (자주 쓰는 약칭)
  const aliasMap: { [alias: string]: string } = {
    '교무': '교무기획부',
    '교무기획': '교무기획부',
    '교무부': '교무기획부',
    '기획': '교무기획부',
    '기획부': '교무기획부',
    
    '예체능': '예체능방과후부',
    '방과후': '예체능방과후부',
    '방과후부': '예체능방과후부',
    '예체능부': '예체능방과후부',
    '예체능방과후': '예체능방과후부',
    '방과후예체능': '예체능방과후부',
    
    '수업': '수업연구부',
    '연구': '수업연구부',
    '수업연구': '수업연구부',
    '수업연구부': '수업연구부',
    '연구부': '수업연구부',
    
    '교육과정': '교육과정기획부',
    '교육과정기획': '교육과정기획부',
    '교육과정부': '교육과정기획부',
    
    '영어': '영어교육부',
    '영어교육': '영어교육부',
    '영어부': '영어교육부',
    '어학': '영어교육부',
    
    '생활': '자치생활부',
    '자치': '자치생활부',
    '자치생활': '자치생활부',
    '생활지도': '자치생활부',
    '생활지도부': '자치생활부',
    '자치생활부': '자치생활부',
    '생활부': '자치생활부',
    '학생생활': '자치생활부',
    '학생부': '자치생활부',
    
    '다문화': '다문화교육부',
    '다문화교육': '다문화교육부',
    '다문화부': '다문화교육부',
    
    'AI': 'AI융합교육부',
    'AI융합': 'AI융합교육부',
    'AI융합교육': 'AI융합교육부',
    'AI융합교육부': 'AI융합교육부',
    '인공지능': 'AI융합교육부',
    '정보': 'AI융합교육부',
    '정보부': 'AI융합교육부',
    '전산': 'AI융합교육부',
    'SW': 'AI융합교육부',
    '융합': 'AI융합교육부',
    '에듀테크': 'AI융합교육부',
  };

  const cleanInput = str.replace(/\s+/g, '');
  if (aliasMap[cleanInput]) {
    const targetName = aliasMap[cleanInput];
    const found = existingDepts.find(d => d.name === targetName);
    if (found) return found.name;
    return targetName;
  }

  // 3. 기존 부서들과 Fuzzy 매칭 (공백, '부', '팀' 제외하고 상호 포함 여부)
  const normalizedRaw = cleanInput.replace(/부$|팀$/, '');
  for (const dept of existingDepts) {
    const normalizedDept = dept.name.replace(/\s+/g, '').replace(/부$|팀$/, '');
    if (normalizedDept === normalizedRaw || normalizedDept.includes(normalizedRaw) || normalizedRaw.includes(normalizedDept)) {
      return dept.name;
    }
  }

  // 4. 기존 부서에 매칭되지 않는 새로운 부서명인 경우
  if (!str.endsWith('부') && !str.endsWith('팀')) {
    return `${str}부`;
  }
  return str;
}

export async function bulkRegisterUsers(fileData: string) {
  try {
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];
    
    if (!rows.length) return { success: false, error: '엑셀 파일에 데이터가 없습니다.' };

    // 현재 조직도 로드 (부서 및 학년 자동 배정용)
    let orgData: OrgStructure | null = null;
    try {
      const currentOrg = await getOrgStructure();
      orgData = {
        principal: currentOrg.principal || '',
        vicePrincipal: currentOrg.vicePrincipal || '',
        academicHead: currentOrg.academicHead || '',
        gradeHeads: { ...(currentOrg.gradeHeads || {}) },
        homerooms: { ...(currentOrg.homerooms || {}) },
        gradeSubjects: { ...(currentOrg.gradeSubjects || {}) },
        departments: (currentOrg.departments || []).map(d => ({
          ...d,
          memberEmails: [...(d.memberEmails || [])]
        })),
        afterschoolManagers: currentOrg.afterschoolManagers || [],
        busManagers: currentOrg.busManagers || [],
        systemManagers: currentOrg.systemManagers || [],
        peTeachers: currentOrg.peTeachers || [],
        healthTeachers: currentOrg.healthTeachers || [],
        specialTeachers: currentOrg.specialTeachers || [],
        librarianTeachers: currentOrg.librarianTeachers || [],
        subjectTeacherGroups: currentOrg.subjectTeacherGroups || [],
        customDutyRoles: currentOrg.customDutyRoles || [],
        dutyRoleDepts: currentOrg.dutyRoleDepts || {},
        dutyRolePermissions: currentOrg.dutyRolePermissions || {},
      };
    } catch (e) {
      console.warn("Failed to load orgStructure for bulk registration:", e);
    }

    const batch = writeBatch(getDb());
    let count = 0;
    let facultyCount = 0;

    for (const row of rows) {
      // 학생 계정 양식 명시 필드 감지
      const hasExplicitStudentField = Boolean(
        row['학생이름'] || row['학생 이름'] || row['studentName'] || 
        row['보호자 이름'] || row['보호자이름'] || row['학부모 이름'] || 
        row['학생 계정 이메일'] || row['학생계정이메일']
      );
      const hasFacultyRole = Boolean(row['직책'] || row['role'] || row['부서'] || row['소속부서']);
      // 교직원 직책/부서가 명시되어 있지 않고, 학생 고유 필드 또는 (학년+반+번호)가 있는 경우에만 학생으로 판정
      const isStudentRow = hasExplicitStudentField || (!hasFacultyRole && row['학년'] && row['반'] && (row['번호'] || row['studentNumber']));
      if (isStudentRow) {
        const studentName = String(row['학생이름'] || row['학생 이름'] || row['이름'] || row['studentName'] || row['name'] || '').trim();
        const email = String(row['학생 계정 이메일'] || row['학생계정이메일'] || row['학생이메일'] || row['이메일'] || row['email'] || '').trim().toLowerCase();
        const grade = String(row['학년'] || row['studentGrade'] || row['grade'] || '').replace(/\D/g, '').trim();
        const classNum = String(row['반'] || row['studentClass'] || row['class'] || '').replace(/\D/g, '').trim();
        const studentNum = String(row['번호'] || row['studentNumber'] || row['number'] || '').replace(/\D/g, '').trim();
        const parentName = String(row['보호자 이름'] || row['보호자이름'] || row['학부모이름'] || row['학부모 이름'] || row['parentName'] || '').trim();
        const parentPhone = String(row['보호자 연락처'] || row['보호자연락처'] || row['학부모연락처'] || row['학부모 연락처'] || row['연락처'] || row['parentPhone'] || row['phone'] || '').trim();

        if (email && studentName && grade && classNum && studentNum) {
          const userRef = doc(getDb(), "users", email);
          batch.set(userRef, {
            name: studentName,
            studentName: studentName,
            studentGrade: grade,
            studentClass: classNum,
            studentNumber: studentNum,
            parentName: parentName || '',
            parentPhone: parentPhone || '',
            role: 'student',
            email: email,
            isAdmin: false,
            signature: '',
          }, { merge: true });
          count++;
        }
      } else {
        // 교직원 계정
        const email = String(row['email'] || row['이메일'] || '').trim().toLowerCase();
        const name = String(row['name'] || row['이름'] || '').trim();
        const role = String(row['role'] || row['직책'] || '교사').trim();

        // 학년, 부서, 반 분리 파싱
        const rawGrade = row['학년'] || row['소속학년'] || row['grade'] || '';
        const rawDept = row['부서'] || row['소속부서'] || row['department'] || row['dept'] || '';
        const rawClass = String(row['반'] || row['학급'] || row['class'] || '').replace(/\D/g, '').trim();
        const legacyAffiliation = row['소속'] || row['affiliation'] || '';

        let parsedGradeStr = '';
        let parsedGradeNum = '';
        let parsedClassNum = rawClass;
        let parsedDeptStr = '';

        // 1. 학년 파싱
        if (rawGrade) {
          const gInfo = normalizeGrade(rawGrade);
          if (gInfo) {
            parsedGradeNum = gInfo.gradeNumber;
            parsedGradeStr = gInfo.gradeName;
            if (gInfo.classNumber && !parsedClassNum) {
              parsedClassNum = gInfo.classNumber;
            }
          }
        }

        // 2. 부서 파싱
        if (rawDept) {
          parsedDeptStr = resolveDepartment(rawDept, orgData?.departments || []);
        }

        // 3. 레거시 '소속' 컬럼 폴백 지원
        if (legacyAffiliation && (!parsedGradeStr || !parsedDeptStr)) {
          const parts = String(legacyAffiliation).split(/[\/,\s+]/).map(p => p.trim()).filter(Boolean);
          for (const part of parts) {
            if (!parsedGradeStr) {
              const gInfo = normalizeGrade(part);
              if (gInfo) {
                parsedGradeNum = gInfo.gradeNumber;
                parsedGradeStr = gInfo.gradeName;
                if (gInfo.classNumber && !parsedClassNum) {
                  parsedClassNum = gInfo.classNumber;
                }
                continue;
              }
            }
            if (!parsedDeptStr) {
              const deptResolved = resolveDepartment(part, orgData?.departments || []);
              if (deptResolved) {
                parsedDeptStr = deptResolved;
              }
            }
          }
        }

        if (email && name) {
          const userRef = doc(getDb(), "users", email);
          batch.set(userRef, {
            name: name,
            role: role,
            dept: parsedDeptStr,
            grade: parsedGradeStr,
            email: email,
            isAdmin: false,
            signature: '',
            isFaculty: true,
            isStaff: true,
          }, { merge: true });
          count++;
          facultyCount++;

          // 조직도 실시간 동기화
          if (orgData) {
            // 부서 조직도 편성
            if (parsedDeptStr) {
              let targetDept = orgData.departments?.find(d => d.name === parsedDeptStr);
              if (!targetDept) {
                targetDept = {
                  id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                  name: parsedDeptStr,
                  headEmail: null,
                  memberEmails: [],
                };
                orgData.departments = [...(orgData.departments || []), targetDept];
              }

              if (!targetDept.memberEmails) targetDept.memberEmails = [];
              if (!targetDept.memberEmails.includes(email)) {
                targetDept.memberEmails.push(email);
              }

              // 직책이 '부장'이면서 학년부장이 아닌 경우 해당 부서의 부장(headEmail)으로 매핑
              if (role.includes('부장') && !role.includes('학년')) {
                targetDept.headEmail = email;
              }
            }

            // 학년 조직도 편성
            if (parsedGradeNum) {
              // 1) 반 담임 매핑
              if (parsedClassNum) {
                orgData.homerooms = orgData.homerooms || {};
                orgData.homerooms[`${parsedGradeNum}-${parsedClassNum}`] = email;
              }

              // 2) 학년부장 매핑
              const isGradeHead = role.includes('부장') || role.includes('학년부장');
              if (isGradeHead) {
                orgData.gradeHeads = orgData.gradeHeads || {};
                orgData.gradeHeads[parsedGradeNum] = email;
                orgData.gradeHeads[`${parsedGradeNum}학년`] = email;
              }

              // 3) 학년 교과 및 소속 매핑 (담임/부장/교과 모두 학년 교과 목록에 포함하여 조직도 카드에서 표시)
              orgData.gradeSubjects = orgData.gradeSubjects || {};
              const currentSubs = orgData.gradeSubjects[parsedGradeNum] || [];
              if (!currentSubs.includes(email)) {
                orgData.gradeSubjects[parsedGradeNum] = [...currentSubs, email];
              }
            }
          }
        }
      }
    }

    await batch.commit();

    // 조직도 저장
    if (orgData && facultyCount > 0) {
      await saveOrgStructure(orgData);
    }

    invalidateUsersCache();

    return { 
      success: true, 
      count,
      facultyCount,
      summary: facultyCount > 0
        ? `${count}명의 사용자 계정이 등록/업데이트되었으며, 학년 및 부서 조직도에 자동 반영되었습니다.`
        : `${count}명의 학생 계정이 등록/업데이트되었습니다.`,
      updatedOrg: orgData || undefined,
    };
  } catch (error: any) {
    return { success: false, error: `일괄 등록 실패: ${error.message}` };
  }
}

/**
 * 전체 교원 프로필(users)의 학년/부서 정보를 현재 조직도(orgStructure)에 완벽 동기화
 */
export async function syncAllUsersToOrgStructure(): Promise<{ success: boolean; updatedOrg?: OrgStructure; message?: string }> {
  try {
    const currentOrg = await getOrgStructure();
    const users = await getUsersDirectory(true);

    const orgData: OrgStructure = {
      principal: currentOrg.principal || '',
      vicePrincipal: currentOrg.vicePrincipal || '',
      academicHead: currentOrg.academicHead || '',
      gradeHeads: { ...(currentOrg.gradeHeads || {}) },
      homerooms: { ...(currentOrg.homerooms || {}) },
      gradeSubjects: { ...(currentOrg.gradeSubjects || {}) },
      departments: (currentOrg.departments || []).map(d => ({
        ...d,
        memberEmails: [...(d.memberEmails || [])]
      })),
      afterschoolManager: currentOrg.afterschoolManager || '',
      busManager: currentOrg.busManager || '',
      afterschoolManagers: [...(currentOrg.afterschoolManagers || [])],
      busManagers: [...(currentOrg.busManagers || [])],
      systemManagers: [...(currentOrg.systemManagers || [])],
      peTeachers: [...(currentOrg.peTeachers || [])],
      healthTeachers: [...(currentOrg.healthTeachers || [])],
      specialTeachers: [...(currentOrg.specialTeachers || [])],
      librarianTeachers: [...(currentOrg.librarianTeachers || [])],
      subjectTeacherGroups: [...(currentOrg.subjectTeacherGroups || [])],
      customDutyRoles: [...(currentOrg.customDutyRoles || [])],
      dutyRoleDepts: { ...(currentOrg.dutyRoleDepts || {}) },
      dutyRolePermissions: { ...(currentOrg.dutyRolePermissions || {}) }
    };

    if (!orgData.departments) orgData.departments = [];
    let syncCount = 0;

    for (const u of users) {
      if (!u.email) continue;
      // 학생/학부모 제외
      if (u.studentName || u.role === '학부모' || u.role === 'student' || u.role === 'parent') continue;
      if (/^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email)) continue;

      const email = u.email.toLowerCase().trim();
      const role = u.role || '교사';
      const rawGrade = u.grade || '';
      const rawDept = u.dept || '';

      // 1. 부서 동기화
      if (rawDept) {
        const deptResolved = resolveDepartment(rawDept, orgData.departments);
        if (deptResolved) {
          let targetDept = orgData.departments.find(d => d.name === deptResolved);
          if (!targetDept) {
            targetDept = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
              name: deptResolved,
              headEmail: null,
              memberEmails: [],
            };
            orgData.departments.push(targetDept);
          }
          if (!targetDept.memberEmails) targetDept.memberEmails = [];
          if (!targetDept.memberEmails.includes(email)) {
            targetDept.memberEmails.push(email);
            syncCount++;
          }
          if (role.includes('부장') && !role.includes('학년') && !targetDept.headEmail) {
            targetDept.headEmail = email;
          }
        }
      }

      // 2. 학년 동기화
      if (rawGrade) {
        const gInfo = normalizeGrade(rawGrade);
        if (gInfo) {
          const gNum = gInfo.gradeNumber;
          const isGradeHead = role.includes('부장') || role.includes('학년부장');

          // 반 담임
          if (gInfo.classNumber) {
            orgData.homerooms = orgData.homerooms || {};
            if (!orgData.homerooms[`${gNum}-${gInfo.classNumber}`]) {
              orgData.homerooms[`${gNum}-${gInfo.classNumber}`] = email;
              syncCount++;
            }
          }

          // 학년부장
          if (isGradeHead) {
            orgData.gradeHeads = orgData.gradeHeads || {};
            if (!orgData.gradeHeads[gNum]) {
              orgData.gradeHeads[gNum] = email;
              orgData.gradeHeads[`${gNum}학년`] = email;
              syncCount++;
            }
          }

          // 학년 교과 및 소속
          orgData.gradeSubjects = orgData.gradeSubjects || {};
          const currentSubs = orgData.gradeSubjects[gNum] || [];
          if (!currentSubs.includes(email)) {
            orgData.gradeSubjects[gNum] = [...currentSubs, email];
            syncCount++;
          }
        }
      }
    }

    if (syncCount > 0) {
      await saveOrgStructure(orgData);
    }

    return { success: true, updatedOrg: orgData, message: `${syncCount}건의 교원 소속이 조직도에 동기화되었습니다.` };
  } catch (error: any) {
    console.error("syncAllUsersToOrgStructure error:", error);
    return { success: false, message: error.message };
  }
}

export async function bulkRegisterStudents(fileData: string) {
  try {
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet) as any[];
    
    if (!rows.length) return { success: false, error: '엑셀 파일에 데이터가 없습니다.' };

    const batch = writeBatch(getDb());
    let count = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const studentName = String(row['학생이름'] || row['학생 이름'] || row['이름'] || row['studentName'] || row['name'] || '').trim();
      const email = String(row['학생 계정 이메일'] || row['학생계정이메일'] || row['학생이메일'] || row['이메일'] || row['email'] || '').trim().toLowerCase();
      const grade = String(row['학년'] || row['studentGrade'] || row['grade'] || '').replace(/\D/g, '').trim();
      const classNum = String(row['반'] || row['studentClass'] || row['class'] || '').replace(/\D/g, '').trim();
      const studentNum = String(row['번호'] || row['studentNumber'] || row['number'] || '').replace(/\D/g, '').trim();
      const parentName = String(row['보호자 이름'] || row['보호자이름'] || row['학부모이름'] || row['학부모 이름'] || row['parentName'] || '').trim();
      const parentPhone = String(row['보호자 연락처'] || row['보호자연락처'] || row['학부모연락처'] || row['학부모 연락처'] || row['연락처'] || row['parentPhone'] || row['phone'] || '').trim();

      // 필수 입력 검증: 학년, 반, 번호, 학생이름, 학생 계정 이메일
      if (!email || !studentName || !grade || !classNum || !studentNum) {
        skippedCount++;
        continue;
      }

      const userRef = doc(getDb(), "users", email);
      batch.set(userRef, {
        name: studentName,
        studentName: studentName,
        studentGrade: grade,
        studentClass: classNum,
        studentNumber: studentNum,
        parentName: parentName || '',
        parentPhone: parentPhone || '',
        role: 'student',
        email: email,
        isAdmin: false,
        signature: '',
      }, { merge: true });
      count++;
    }

    if (count === 0 && skippedCount > 0) {
      return { 
        success: false, 
        error: `필수 입력 항목(학년, 반, 번호, 학생이름, 학생 계정 이메일)이 누락되어 등록되지 못했습니다. (누락: ${skippedCount}건)` 
      };
    }

    await batch.commit();
    const skippedMsg = skippedCount > 0 ? ` (필수항목 누락 ${skippedCount}건 제외)` : '';
    return { success: true, summary: `총 ${count}명의 학생 계정이 성공적으로 일괄 등록되었습니다.${skippedMsg}` };
  } catch (error: any) {
    return { success: false, error: `학생 계정 일괄 등록 실패: ${error.message}` };
  }
}

export async function deleteUser(email: string) {
  if (!email) return { success: false, error: '이메일이 제공되지 않았습니다.' };
  try {
    const userRef = doc(getUsersCol(), email.toLowerCase());
    await firestoreDeleteDoc(userRef);
    invalidateUsersCache();
    return { success: true };
  } catch (error: any) {
    console.error('[UserService] deleteUser failed:', error);
    return { success: false, error: `사용자 삭제 중 오류: ${error.message}` };
  }
}

export async function resetParentPin(email: string) {
  if (!email) return { success: false, error: '이메일이 제공되지 않았습니다.' };
  try {
    const userRef = doc(getUsersCol(), email.toLowerCase());
    await setDoc(userRef, {
      hashedPin: null,
    }, { merge: true });
    invalidateUsersCache();
    return { success: true };
  } catch (error: any) {
    console.error('[UserService] resetParentPin failed:', error);
    return { success: false, error: `PIN 번호 초기화 중 오류: ${error.message}` };
  }
}

export async function resetParentAuth(email: string) {
  if (!email) return { success: false, error: '이메일이 제공되지 않았습니다.' };
  try {
    const userRef = doc(getUsersCol(), email.toLowerCase());
    await setDoc(userRef, {
      parentPhone: null,
      parentSignature: null,
      hashedPin: null,
    }, { merge: true });
    invalidateUsersCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: `인증 정보 초기화 중 오류: ${error.message}` };
  }
}

export async function getApproversByGradeClass(
  grade: string, 
  studentClass: string, 
  docTypeOrIsFieldTrip: boolean | string = false
): Promise<Approver[]> {
  const [org, delegationRules] = await Promise.all([
    getOrgStructure(),
    getDelegationRules()
  ]);
  const approvers: Approver[] = [];
  
  const g = String(parseInt(grade, 10) || grade).trim();
  const c = String(parseInt(studentClass, 10) || studentClass).trim();
  const gradeClassKey = `${g}-${c}`;
  
  // 1차 결재: 담임 선생님 (정규화된 키 및 원본 키 모두 매칭)
  const homeroomEmail = org.homerooms?.[gradeClassKey] || 
                        org.homerooms?.[`${grade}-${studentClass}`] ||
                        Object.entries(org.homerooms || {}).find(([k]) => {
                          const [kg, kc] = k.split('-').map(s => String(parseInt(s, 10) || s).trim());
                          return kg === g && kc === c;
                        })?.[1];

  if (!homeroomEmail) {
    throw new Error(`선택하신 학년/반(${grade}학년 ${studentClass}반)의 담당 교사가 아직 배정되지 않았습니다. 학교 관리자에게 문의해 주세요.`);
  }
  const homeroomUser = await getUserProfileByEmail(homeroomEmail.trim().toLowerCase());
  if (!homeroomUser) {
    throw new Error(`배정된 담임 교사(${homeroomEmail})의 계정을 찾을 수 없습니다. 학교 관리자에게 문의해 주세요.`);
  }

  approvers.push({
    name: homeroomUser.name,
    email: homeroomUser.email,
    role: '담임',
    type: 'normal',
    status: 'pending',
  });

  // 전결규정 대상 문서명 판별 (결석계 vs 체험학습신청서)
  let targetDocName = '결석계';
  if (typeof docTypeOrIsFieldTrip === 'boolean') {
    targetDocName = docTypeOrIsFieldTrip ? '체험학습신청서' : '결석계';
  } else if (typeof docTypeOrIsFieldTrip === 'string') {
    if (docTypeOrIsFieldTrip.includes('field-trip') || docTypeOrIsFieldTrip.includes('체험')) {
      targetDocName = '체험학습신청서';
    } else {
      targetDocName = '결석계';
    }
  }

  // 매칭되는 전결규정 탐색 (ID 일치, 완전 일치, 부분 일치, 키워드 포함 모두 지원)
  const isFieldTrip = targetDocName === '체험학습신청서';
  const matchedRule = (delegationRules || []).find((r: DelegationRule) => {
    if (isFieldTrip && (r.id === 'rule-fieldtrip' || r.subType?.includes('체험') || r.mainType?.includes('체험') || r.detailType?.includes('체험'))) {
      return true;
    }
    if (!isFieldTrip && (r.id === 'rule-absence' || r.subType?.includes('결석') || r.mainType?.includes('결석') || r.detailType?.includes('결석'))) {
      return true;
    }
    return (
      r.subType?.trim() === targetDocName || 
      r.mainType?.trim() === targetDocName ||
      r.detailType?.trim() === targetDocName
    );
  });

  const intermediate = matchedRule?.intermediateApprover || (isFieldTrip ? 'ACADEMIC_HEAD' : 'NONE');
  const finalApproverType = matchedRule?.finalApprover || (isFieldTrip ? 'VP' : 'GRADE_HEAD');

  // 교무부장 탐색 헬퍼 (1순위: org.academicHead, 2순위: departments 중 교무/기획 부서 부장)
  const getAcademicHeadEmail = () => {
    if (org.academicHead?.trim()) return org.academicHead.trim();
    const academicDept = org.departments?.find((d: any) => 
      d.name?.includes('교무') || d.name?.includes('기획') || d.name?.includes('학적')
    );
    return academicDept?.headEmail?.trim() || null;
  };

  const gradeHeadEmail = org.gradeHeads?.[g] || org.gradeHeads?.[grade];
  const academicHeadEmail = getAcademicHeadEmail();

  // 중간 결재자 추가 (최종 결재자와 다를 경우)
  if (intermediate === 'ACADEMIC_HEAD' && finalApproverType !== 'ACADEMIC_HEAD') {
    const targetEmail = academicHeadEmail || gradeHeadEmail;
    if (targetEmail) {
      const acadUser = await getUserProfileByEmail(targetEmail.trim().toLowerCase());
      if (acadUser) {
        approvers.push({
          name: acadUser.name,
          email: acadUser.email,
          role: '교무부장',
          type: 'normal',
          status: 'pending',
        });
      }
    }
  } else if (intermediate === 'GRADE_HEAD' && finalApproverType !== 'GRADE_HEAD') {
    const targetEmail = gradeHeadEmail || academicHeadEmail;
    if (targetEmail) {
      const headUser = await getUserProfileByEmail(targetEmail.trim().toLowerCase());
      if (headUser) {
        approvers.push({
          name: headUser.name,
          email: headUser.email,
          role: academicHeadEmail && targetEmail === academicHeadEmail ? '교무부장' : '학년부장',
          type: 'normal',
          status: 'pending',
        });
      }
    }
  }

  // 최종 결재자 추가
  if (finalApproverType === 'GRADE_HEAD') {
    const targetEmail = gradeHeadEmail || academicHeadEmail;
    if (!targetEmail) {
      throw new Error(`${grade}학년 부장 또는 교무부장 교사가 아직 배정되지 않았습니다. 학교 관리자에게 문의해 주세요.`);
    }
    const headUser = await getUserProfileByEmail(targetEmail.trim().toLowerCase());
    if (!headUser) {
      throw new Error(`배정된 부장 교사(${targetEmail})의 계정을 찾을 수 없습니다. 학교 관리자에게 문의해 주세요.`);
    }
    approvers.push({
      name: headUser.name,
      email: headUser.email,
      role: '부장',
      type: 'final',
      status: 'pending',
    });
  } else if (finalApproverType === 'ACADEMIC_HEAD') {
    const targetEmail = academicHeadEmail || gradeHeadEmail;
    if (!targetEmail) {
      throw new Error(`교무부장 교사가 아직 배정되지 않았습니다. 시스템 설정의 조직도에서 교무부장을 지정해 주세요.`);
    }
    const acadUser = await getUserProfileByEmail(targetEmail.trim().toLowerCase());
    if (!acadUser) {
      throw new Error(`교무부장 교사(${targetEmail})의 계정을 찾을 수 없습니다. 학교 관리자에게 문의해 주세요.`);
    }
    approvers.push({
      name: acadUser.name,
      email: acadUser.email,
      role: '교무부장',
      type: 'final',
      status: 'pending',
    });
  } else if (finalApproverType === 'VP') {
    if (!org.vicePrincipal) {
      throw new Error(`교감 선생님이 배정되지 않았습니다. 시스템 설정의 조직도에서 교감을 지정해 주세요.`);
    }
    const vpUser = await getUserProfileByEmail(org.vicePrincipal.trim().toLowerCase());
    approvers.push({
      name: vpUser?.name || '교감',
      email: vpUser?.email || org.vicePrincipal,
      role: '교감',
      type: 'final',
      status: 'pending',
    });
  } else if (finalApproverType === 'PRINCIPAL') {
    const hasVp = approvers.some(a => a.role === '교감');
    if (!hasVp && org.vicePrincipal) {
      const vpUser = await getUserProfileByEmail(org.vicePrincipal.trim().toLowerCase());
      approvers.push({
        name: vpUser?.name || '교감',
        email: vpUser?.email || org.vicePrincipal,
        role: '교감',
        type: 'normal',
        status: 'pending',
      });
    }
    if (!org.principal) {
      throw new Error(`교장 선생님이 배정되지 않았습니다. 시스템 설정의 조직도에서 교장을 지정해 주세요.`);
    }
    const pUser = await getUserProfileByEmail(org.principal.trim().toLowerCase());
    approvers.push({
      name: pUser?.name || '교장',
      email: pUser?.email || org.principal,
      role: '교장',
      type: 'final',
      status: 'pending',
    });
  }

  return approvers;
}

/**
 * 주어진 사용자가 교직원인지 여부를 일관성 있게 판별
 * - 슈퍼 관리자 / 스쿨버스 관리자: 무조건 교직원
 * - isFaculty === true 또는 isStaff === true 또는 isManualFaculty === true: 무조건 교직원
 * - 부서 소속(dept 설정 또는 조직도 부서원): 무조건 교직원
 * - 교직원 전용 직책(교사, 부장, 교감, 교장, 행정실 등): 교직원
 * - 학생/학부모 특화 정보(studentName, parentName, role: '학부모'/'학생'): 학생 계정
 * - 학번 형태(숫자 시작)이면서 위의 교직원 조건이 없는 경우: 학생 계정
 */
export function isFacultyMember(u: UserProfile | null | undefined, deptMemberSet?: Set<string>): boolean {
  if (!u) return false;
  const emailLower = (u.email || '').toLowerCase().trim();
  if (emailLower === 'beside1s@kshcm.net' || emailLower === 'bus@kshcm.net') return true;

  // 1. 명시적 교직원 플래그가 있는 경우 최우선 인정
  if (u.isFaculty === true || u.isStaff === true || u.isManualFaculty === true) return true;

  // 2. 부서가 지정되어 있거나 조직도 부서원에 포함된 경우 최우선 인정
  if (u.dept && u.dept.trim() !== '') return true;
  if (deptMemberSet && deptMemberSet.has(emailLower)) return true;

  // 3. 교직원 전용 직책을 가진 경우
  if (u.role && u.role !== '학부모' && u.role !== '학생' && u.role !== 'parent' && u.role !== 'student') {
    return true;
  }

  // 4. 학생/학부모 특화 정보가 있는 경우 학생 계정
  if (u.studentName || u.studentGrade || u.role === '학부모' || u.role === 'student' || u.role === 'parent') {
    return false;
  }

  // 5. 숫자로 시작하는 학번 이메일 패턴(예: 20211234, 2026hong)이면서 교직원 조건이 없으면 학생 계정
  if (/^\d{2,8}[a-zA-Z0-9._-]*@kshcm\.net$/i.test(emailLower)) {
    return false;
  }

  return true;
}

