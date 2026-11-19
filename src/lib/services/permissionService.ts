import type { OrgStructure, UserProfile } from '@/lib/types';

/**
 * 교사의 담당 학급(담임) 정보 조회 헬퍼
 */
export function getTeacherHomeroom(
  email?: string | null,
  org?: Partial<OrgStructure> | null,
  profile?: UserProfile | null
): { grade: string; classNum: string; gradeClassKey: string } | null {
  if (!email) return null;
  const emailLower = email.trim().toLowerCase();

  // 1. org.homerooms에서 검색 (예: { "3-2": "teacher@kshcm.net" })
  if (org?.homerooms) {
    for (const [key, tEmail] of Object.entries(org.homerooms)) {
      if (tEmail && tEmail.trim().toLowerCase() === emailLower) {
        const parts = key.split('-');
        if (parts.length === 2) {
          return { grade: parts[0], classNum: parts[1], gradeClassKey: key };
        }
      }
    }
  }

  // 2. profile.grade, profile.class / profile.studentGrade, profile.studentClass 확인
  const pGrade = (profile?.grade || profile?.studentGrade || '').replace(/[^0-9]/g, '');
  const pClass = (profile?.class || profile?.studentClass || '').replace(/[^0-9]/g, '');
  if (pGrade && pClass) {
    return { grade: pGrade, classNum: pClass, gradeClassKey: `${pGrade}-${pClass}` };
  }

  return null;
}

/**
 * 학교 체육 성장 기록 시스템 세부 권한 정보 판별
 */
export function getPePermissionDetails(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): {
  canAccess: boolean;
  isPeAdmin: boolean; // 전교 체육 관리자 권한 (리더십, 체육교사, 체육과목전담, 체육업무)
  isHomeroomOnly: boolean; // 학급 담임 교사 권한 (자신의 반 데이터 전용)
  homeroom: { grade: string; classNum: string; gradeClassKey: string } | null;
} {
  if (!email || !org) {
    return {
      canAccess: false,
      isPeAdmin: false,
      isHomeroomOnly: false,
      homeroom: null,
    };
  }

  const emailLower = email.trim().toLowerCase();

  // 1. 학교 리더십 (교장, 교감, 교무부장, 시스템 관리자)
  let isPeAdmin = Boolean(
    profile?.isAdmin ||
    profile?.role === '관리자' ||
    profile?.role === 'admin' ||
    org.principal?.toLowerCase() === emailLower ||
    org.vicePrincipal?.toLowerCase() === emailLower ||
    org.academicHead?.toLowerCase() === emailLower ||
    org.systemManagers?.some(e => e && e.trim().toLowerCase() === emailLower)
  );

  // 2. 체육 담당 교사 명단 (peTeachers)
  if (!isPeAdmin && org.peTeachers?.some(e => e && e.trim().toLowerCase() === emailLower)) {
    isPeAdmin = true;
  }

  // 3. 교과전담 그룹 중 '체육' 과목 담당 교사
  if (!isPeAdmin && org.subjectTeacherGroups?.some(g => 
    (g.categoryName.includes('체육') || g.categoryName.includes('PE') || g.categoryName.includes('스포츠')) &&
    g.teacherEmails?.some(e => e && e.trim().toLowerCase() === emailLower)
  )) {
    isPeAdmin = true;
  }

  // 4. 기본 직책 'pe' 권한 또는 커스텀 직책 중 pe_admin 권한 소유자
  if (!isPeAdmin) {
    const peRolePerms = org.dutyRolePermissions?.['pe'];
    if (peRolePerms?.features?.includes('pe_admin') && org.peTeachers?.some(e => e && e.trim().toLowerCase() === emailLower)) {
      isPeAdmin = true;
    }
  }

  if (!isPeAdmin && org.customDutyRoles?.some(r => 
    (r.permissions?.features?.includes('pe_admin') || r.roleName.includes('체육') || r.roleName.includes('PAPS')) &&
    r.teacherEmails?.some(e => e && e.trim().toLowerCase() === emailLower)
  )) {
    isPeAdmin = true;
  }

  // 5. 부서 내 체육 업무 배정 확인
  if (!isPeAdmin && org.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          if (
            (task.taskName.includes('체육') || task.taskName.includes('PAPS') || task.taskName.includes('스포츠')) &&
            task.assignedEmails?.some(e => e && e.trim().toLowerCase() === emailLower)
          ) {
            isPeAdmin = true;
            break;
          }
        }
      }
      if (isPeAdmin) break;
    }
  }

  // 6. 학급 담임 교사 정보 확인
  const homeroom = getTeacherHomeroom(email, org, profile);
  const isHomeroomOnly = !isPeAdmin && !!homeroom;
  const canAccess = isPeAdmin || isHomeroomOnly;

  return {
    canAccess,
    isPeAdmin,
    isHomeroomOnly,
    homeroom,
  };
}

/**
 * 학교 체육 성장 기록 시스템 접근 권한 확인 (하위 호환성 유지)
 * - 전교 체육 관리자 또는 학급 담임 교사에게 바로가기/접근 허용
 */
export function checkPeAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): boolean {
  return getPePermissionDetails(email, profile, org).canAccess;
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

/**
 * 학생 안전지도 관리 시스템 접근 권한 확인
 * - 최고 관리자, 학교 리더십, 안전지도 담당자(safetyManagers),
 *   또는 '안전'/'안전지도' 관련 업무 담당자에게 접근 허용
 */
export function checkSafetyAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): boolean {
  return getSafetyPermissionDetails(email, profile, org).canAccess;
}

/**
 * 안전지도 담당자 세부 권한 정보 조회
 */
export function getSafetyPermissionDetails(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): {
  canAccess: boolean;
  isAdmin: boolean;
  isSafetyManager: boolean;
  roleTitle: string;
} {
  if (!email) {
    return { canAccess: false, isAdmin: false, isSafetyManager: false, roleTitle: '' };
  }

  const emailLower = email.trim().toLowerCase();
  const isAdmin = !!profile?.isAdmin;

  // 1. 최고 관리자
  if (isAdmin) {
    return { canAccess: true, isAdmin: true, isSafetyManager: true, roleTitle: '시스템 관리자' };
  }

  if (!org) {
    return { canAccess: false, isAdmin: false, isSafetyManager: false, roleTitle: '' };
  }

  // 2. 학교 리더십 (교장, 교감, 교무부장, 행정실장)
  if (org.principal?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '학교장' };
  }
  if (org.vicePrincipal?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '교감' };
  }
  if (org.academicHead?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '교무부장' };
  }
  if (org.administrativeHead?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '행정실장' };
  }

  // 3. 전용 안전지도 담당자 목록 (safetyManagers)
  if (org.safetyManagers?.some(e => e.toLowerCase() === emailLower)) {
    return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '안전지도 담당자' };
  }

  // 4. 기본 직책 'safety'에 부여된 권한 확인
  const safetyRolePerms = org.dutyRolePermissions?.['safety'];
  if (safetyRolePerms?.features?.includes('safety_admin') && org.safetyManagers?.some(e => e.toLowerCase() === emailLower)) {
    return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '안전지도 담당자' };
  }

  // 5. 커스텀 직책(customDutyRoles) 중 '안전'/'안전지도' 명칭 포함 또는 safety_admin 권한
  if (org.customDutyRoles) {
    for (const role of org.customDutyRoles) {
      const hasEmail = role.teacherEmails?.some(e => e.toLowerCase() === emailLower);
      if (hasEmail) {
        const rName = role.roleName || '';
        const hasSafetyFeature = role.permissions?.features?.includes('safety_admin');
        if (hasSafetyFeature || rName.includes('안전') || rName.includes('지도') || rName.includes('생활지도')) {
          return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: role.roleName || '안전지도 담당자' };
        }
      }
    }
  }

  // 6. 소속 부서 업무(tasks) 중 '안전' 관련 업무 배정자
  if (org.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          const tName = task.taskName || '';
          if (tName.includes('안전') || tName.includes('지도')) {
            if (task.assignedEmails?.some(e => e.toLowerCase() === emailLower)) {
              return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: `${dept.name} ${tName} 담당` };
            }
          }
        }
      }
    }
  }

  // 7. 부서별 부원 업무 할당 매핑 (deptMemberDuties)
  if (org.deptMemberDuties) {
    for (const deptId in org.deptMemberDuties) {
      const memberDuties = org.deptMemberDuties[deptId]?.[emailLower] || [];
      if (memberDuties.some(d => d.includes('안전') || d === 'safety')) {
        return { canAccess: true, isAdmin: false, isSafetyManager: true, roleTitle: '안전지도 담당' };
      }
    }
  }

  return { canAccess: false, isAdmin: false, isSafetyManager: false, roleTitle: '' };
}

/**
 * 학년 말 인수인계 총괄 관리자(교무부장 / 인수인계 담당자 / 관리자) 권한 판별
 */
export function checkHandoverAdminPermission(
  user: UserProfile | null | undefined,
  org: Partial<OrgStructure> | null | undefined
): { canAccess: boolean; isAdmin: boolean; isHandoverManager: boolean; roleTitle: string } {
  if (!user || !user.email) {
    return { canAccess: false, isAdmin: false, isHandoverManager: false, roleTitle: '' };
  }
  const emailLower = user.email.trim().toLowerCase();

  // 1. 최고 관리자
  if (user.isAdmin) {
    return { canAccess: true, isAdmin: true, isHandoverManager: true, roleTitle: '시스템 관리자' };
  }

  if (!org) {
    return { canAccess: false, isAdmin: false, isHandoverManager: false, roleTitle: '' };
  }

  // 2. 학교 리더십 (교장, 교감, 교무부장, 행정실장)
  if (org.principal?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '학교장' };
  }
  if (org.vicePrincipal?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '교감' };
  }
  if (org.academicHead?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '교무부장' };
  }
  if (org.administrativeHead?.toLowerCase() === emailLower) {
    return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '행정실장' };
  }

  // 3. 전용 인수인계 담당자 목록 (handoverManagers)
  if (org.handoverManagers?.some(e => e.toLowerCase() === emailLower)) {
    return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '인수인계 담당자' };
  }

  // 4. 기본 직책 'handover'에 부여된 권한 확인
  const handoverRolePerms = org.dutyRolePermissions?.['handover'];
  if (handoverRolePerms?.features?.includes('handover_admin') && org.handoverManagers?.some(e => e.toLowerCase() === emailLower)) {
    return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '인수인계 담당자' };
  }

  // 5. 커스텀 직책(customDutyRoles) 중 '인수인계' 명칭 포함 또는 handover_admin 권한
  if (org.customDutyRoles) {
    for (const role of org.customDutyRoles) {
      const hasEmail = role.teacherEmails?.some(e => e.toLowerCase() === emailLower);
      if (hasEmail) {
        const rName = role.roleName || '';
        const hasHandoverFeature = role.permissions?.features?.includes('handover_admin');
        if (hasHandoverFeature || rName.includes('인수인계') || rName.includes('인계')) {
          return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: role.roleName || '인수인계 담당자' };
        }
      }
    }
  }

  // 6. 소속 부서 업무(tasks) 중 '인수인계' 관련 업무 배정자
  if (org.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          const tName = task.taskName || '';
          if (tName.includes('인수인계') || tName.includes('인계')) {
            if (task.assignedEmails?.some(e => e.toLowerCase() === emailLower)) {
              return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: `${dept.name} ${tName} 담당` };
            }
          }
        }
      }
    }
  }

  // 7. 부서별 부원 업무 할당 매핑 (deptMemberDuties)
  if (org.deptMemberDuties) {
    for (const deptId in org.deptMemberDuties) {
      const memberDuties = org.deptMemberDuties[deptId]?.[emailLower] || [];
      if (memberDuties.some(d => d.includes('인수인계') || d === 'handover')) {
        return { canAccess: true, isAdmin: false, isHandoverManager: true, roleTitle: '인수인계 담당' };
      }
    }
  }

  return { canAccess: false, isAdmin: false, isHandoverManager: false, roleTitle: '' };
}

/**
 * 방과후학교 시스템 접근 권한 확인
 * - 방과후 담당자, 본인 개설 강좌 보유 교사, 강사, 관리자
 */
export function checkAfterschoolAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null,
  myCoursesCount: number = 0
): boolean {
  if (profile?.role === '강사') return true;
  if (myCoursesCount > 0) return true;
  if (!email) return false;

  const emailLower = email.trim().toLowerCase();
  if (profile?.isAdmin) return true;

  if (org?.afterschoolManagers?.some((m) => m && m.trim().toLowerCase() === emailLower)) return true;
  if (org?.afterschoolManager && org.afterschoolManager.trim().toLowerCase() === emailLower) return true;

  if (
    org?.customDutyRoles?.some(
      (r) =>
        (r.roleName.includes('방과후') || r.permissions?.features?.includes('afterschool_admin')) &&
        r.teacherEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)
    )
  ) {
    return true;
  }

  if (org?.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          if (
            task.taskName.includes('방과후') &&
            task.assignedEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)
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
 * 스쿨버스 시스템 접근 권한 확인
 * - 스쿨버스 담당자, 스쿨버스 노선 배정 교사, 강사, 관리자
 */
export function checkBusAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): boolean {
  if (profile?.role === '강사') return true;
  if ((profile as any)?.assignedBusId) return true;
  if (!email) return false;

  const emailLower = email.trim().toLowerCase();
  if (profile?.isAdmin) return true;

  if (org?.busManagers?.some((m) => m && m.trim().toLowerCase() === emailLower)) return true;
  if (org?.busManager && org.busManager.trim().toLowerCase() === emailLower) return true;

  if (
    org?.customDutyRoles?.some(
      (r) =>
        (r.roleName.includes('버스') || r.roleName.includes('스쿨버스') || r.permissions?.features?.includes('bus_admin')) &&
        r.teacherEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)
    )
  ) {
    return true;
  }

  if (org?.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          if (
            (task.taskName.includes('버스') || task.taskName.includes('교통')) &&
            task.assignedEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)
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
 * 학생 봉사활동 시스템 접근 권한 확인
 * - 봉사활동 담당자, 커스텀 봉사 직책, 관리자
 */
export function checkVolunteerAccessPermission(
  email?: string | null,
  profile?: UserProfile | null,
  org?: Partial<OrgStructure> | null
): boolean {
  if (profile?.role === '강사') return false;
  if (!email) return false;

  const emailLower = email.trim().toLowerCase();
  if (profile?.isAdmin) return true;

  if (org?.volunteerManager && org.volunteerManager.trim().toLowerCase() === emailLower) return true;
  if ((org as any)?.volunteerManagers?.some((m: string) => m && m.trim().toLowerCase() === emailLower)) return true;

  if (
    org?.customDutyRoles?.some(
      (r) =>
        (r.roleName.includes('봉사') || r.roleName.includes('봉사활동')) &&
        r.teacherEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)
    )
  ) {
    return true;
  }

  if (org?.departments) {
    for (const dept of org.departments) {
      if (dept.tasks) {
        for (const task of dept.tasks) {
          if (
            task.taskName.includes('봉사') &&
            task.assignedEmails?.some((e) => e && e.trim().toLowerCase() === emailLower)
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}




