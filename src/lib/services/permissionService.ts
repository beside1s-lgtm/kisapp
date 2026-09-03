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
