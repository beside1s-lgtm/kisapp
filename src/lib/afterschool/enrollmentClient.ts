'use client';

import { auth } from '@/lib/firebase';

/**
 * 방과후 수강신청/취소 서버 API 호출 (학생·학부모 화면 전용)
 * - 로그인 토큰을 붙여 보내며, 신청자 정보와 시각 판정은 서버가 결정한다.
 * - 로컬 개발 서버의 우회 로그인(Firebase 로그인 없음)일 때만 프로필을 함께 보낸다.
 */
export type AfterschoolApiResult = {
  success: boolean;
  status?: 'ENROLLED' | 'WAITING';
  enrollmentId?: string;
  waitingReason?: string;
  promotedStudentName?: string;
  promotedCourseTitle?: string;
  cancelled?: any;
  errorCode?: string;
  error?: string;
};

async function postAfterschool(path: string, payload: Record<string, any>, profile?: any): Promise<AfterschoolApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const body: Record<string, any> = { ...payload };
  const user = auth.currentUser;
  if (user) {
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } else if (process.env.NODE_ENV === 'development' && profile) {
    body.devProfile = profile;
  }
  try {
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (data && typeof data.success === 'boolean') return data;
    return { success: false, errorCode: 'UNKNOWN', error: `서버 응답 오류 (${res.status})` };
  } catch {
    return { success: false, errorCode: 'NETWORK', error: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.' };
  }
}

export function requestAfterschoolEnrollment(courseId: string, needsBus: boolean, profile?: any) {
  return postAfterschool('/api/afterschool/enroll', { courseId, needsBus }, profile);
}

export function requestAfterschoolCancellation(enrollmentId: string, profile?: any) {
  return postAfterschool('/api/afterschool/cancel', { enrollmentId }, profile);
}
