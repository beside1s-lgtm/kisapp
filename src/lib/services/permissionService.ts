import type { OrgStructure, UserProfile } from '@/lib/types';

/**
 * 학교 체육 성장 기록 시스템 접근 권한 확인
 * - 관리자라 할지라도 체육 담당 직책이나 권한이 부여된 사용자에게만 바로가기/접근 허용
 */
export function checkPeAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): boolean {
  if (!email || !org) return false;
  const emailLower = email.toLowerCase();

  // 1. 학교 리더십 (교장, 교감, 교무부장)
  if (org.principal?.toLowerCase() === emailLower) return true;
  if (org.vicePrincipal?.toLowerCase() === emailLower) return true;
  if (org.academicHead?.toLowerCase() === emailLower) return true;

  // 2. 체육 담당 교사 명단 (peTeachers)
  if (org.peTeachers?.some(e => e.toLowerCase() === emailLower)) return true;

  // 3. 교과전담 그룹 중 '체육' 과목 담당 교사
  if (org.subjectTeacherGroups?.some(g => 
    (g.categoryName.includes('체육') || g.categoryName.includes('PE') || g.categoryName.includes('스포츠')) &&
    g.teacherEmails?.some(e => e.toLowerCase() === emailLower)
  )) {
    return true;
  }

  // 4. 기본 직책 'pe'에 부여된 권한 또는 커스텀 직책 중 pe_admin 권한 소유자
  const peRolePerms = org.dutyRolePermissions?.['pe'];
  if (peRolePerms?.features?.includes('pe_admin') && org.peTeachers?.some(e => e.toLowerCase() === emailLower)) {
    return true;
  }

  if (org.customDutyRoles?.some(r => 
    (r.permissions?.features?.includes('pe_admin') || r.roleName.includes('체육') || r.roleName.includes('PAPS')) &&
    r.teacherEmails?.some(e => e.toLowerCase() === emailLower)
  )) {
    return true;
  }

  // 5. 부서 내 업무 배정 확인
  if (org.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          if (
            (task.taskName.includes('체육') || task.taskName.includes('PAPS') || task.taskName.includes('스포츠')) &&
            task.assignedEmails?.some(e => e.toLowerCase() === emailLower)
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * 학생 건강 (보건실) 시스템 접근 권한 확인
 * - 보건교사 직책 또는 health_admin 권한이 부여된 사용자에게만 바로가기/접근 허용
 */
export function checkHealthAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): boolean {
  if (!email || !org) return false;
  const emailLower = email.toLowerCase();

  // 1. 학교 리더십 (교장, 교감, 교무부장)
  if (org.principal?.toLowerCase() === emailLower) return true;
  if (org.vicePrincipal?.toLowerCase() === emailLower) return true;
  if (org.academicHead?.toLowerCase() === emailLower) return true;

  // 2. 보건교사 명단 (healthTeachers)
  if (org.healthTeachers?.some(e => e.toLowerCase() === emailLower)) return true;

  // 3. 기본 직책 'health'에 부여된 권한 또는 커스텀 직책 중 health_admin 권한 소유자
  const healthRolePerms = org.dutyRolePermissions?.['health'];
  if (healthRolePerms?.features?.includes('health_admin') && org.healthTeachers?.some(e => e.toLowerCase() === emailLower)) {
    return true;
  }

  if (org.customDutyRoles?.some(r => 
    (r.permissions?.features?.includes('health_admin') || r.roleName.includes('보건') || r.roleName.includes('건강')) &&
    r.teacherEmails?.some(e => e.toLowerCase() === emailLower)
  )) {
    return true;
  }

  // 4. 부서 내 업무 배정 확인
  if (org.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          if (
            (task.taskName.includes('보건') || task.taskName.includes('건강')) &&
            task.assignedEmails?.some(e => e.toLowerCase() === emailLower)
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * 담임 업무 관리소(출결/체험 대리) 접근 권한 판별
 * 
 * 허용 대상:
 * 1. 학급 담임 (org.homerooms에 배정된 교사)
 * 2. 학생출결 담당자 (customDutyRoles 중 student_admin 권한 또는 '출결'/'학적'/'학생' 업무 담당자)
 * 3. 시스템 설정 담당자 (org.systemManagers 또는 profile.isAdmin)
 */
export function checkHomeroomAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): {
  canAccess: boolean;
  isHomeroomTeacher: boolean;
  isAttendanceManager: boolean;
  isSystemManager: boolean;
  canAccessAllClasses: boolean;
} {
  if (!email) {
    return {
      canAccess: false,
      isHomeroomTeacher: false,
      isAttendanceManager: false,
      isSystemManager: false,
      canAccessAllClasses: false,
    };
  }

  const emailLower = email.trim().toLowerCase();

  // 1. 시스템 설정 담당자 (관리자 또는 systemManagers)
  const isSystemManager = Boolean(
    profile?.isAdmin ||
    profile?.role === '관리자' ||
    profile?.role === 'admin' ||
    org?.systemManagers?.some((m) => m && m.trim().toLowerCase() === emailLower)
  );

  // 2. 학생출결 담당자 판별
  // - 커스텀 업무 직책 중 student_admin 권한 소유자이거나 업무명에 '출결'/'학적'/'학생출결'이 포함된 교사
  // - 부서 내 업무 배정(tasks) 중 '출결'/'학적' 업무 배정 교사
  let isAttendanceManager = false;

  if (org?.customDutyRoles) {
    isAttendanceManager = org.customDutyRoles.some((role) => {
      const hasEmail = role.teacherEmails?.some((e) => e && e.trim().toLowerCase() === emailLower);
      if (!hasEmail) return false;
      if (role.permissions?.features?.includes('student_admin')) return true;
      const rName = role.roleName || '';
      return rName.includes('출결') || rName.includes('학적') || rName.includes('학생출결');
    });
  }

  if (!isAttendanceManager && org?.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          const tName = task.taskName || '';
          if (tName.includes('출결') || tName.includes('학적')) {
            if (task.assignedEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)) {
              isAttendanceManager = true;
              break;
            }
          }
        }
      }
      if (isAttendanceManager) break;
    }
  }

  // 3. 학급 담임 교사 판별
  let isHomeroomTeacher = false;
  if (org?.homerooms) {
    isHomeroomTeacher = Object.values(org.homerooms).some(
      (teacherEmail) => teacherEmail && String(teacherEmail).trim().toLowerCase() === emailLower
    );
  }

  // 전교 학급 접근 권한: 시스템 설정 담당자 또는 학생출결 담당자
  const canAccessAllClasses = isSystemManager || isAttendanceManager;

  // 메뉴 노출 및 접근 권한: 담임 교사이거나 전교 접근 권한자
  const canAccess = isHomeroomTeacher || canAccessAllClasses;

  return {
    canAccess,
    isHomeroomTeacher,
    isAttendanceManager,
    isSystemManager,
    canAccessAllClasses,
  };
}

