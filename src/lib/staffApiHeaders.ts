import { auth } from '@/lib/firebase';

/**
 * 교직원 전용 서버 API 호출용 헤더.
 * 로그인 토큰(Bearer)을 붙이고, 로컬 개발 서버의 우회 로그인(Firebase 로그인 없음)일 때만 개발용 표시 헤더를 붙인다.
 */
export async function buildStaffApiHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json', ...(await buildStaffAuthHeaders()), ...extra };
}

/** 인증 헤더만 (FormData 업로드·GET 요청용: Content-Type은 브라우저가 정하도록 둔다) */
export async function buildStaffAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const user = auth.currentUser;
  if (user) {
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } else if (process.env.NODE_ENV === 'development') {
    headers['X-Dev-Bypass'] = '1';
  }
  return headers;
}
