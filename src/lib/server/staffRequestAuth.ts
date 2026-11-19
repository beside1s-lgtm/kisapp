import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';

/**
 * 교직원 전용 서버 API의 요청자 확인.
 * - Authorization: Bearer <Firebase ID 토큰> 을 검증하고 users/{email} 프로필을 조회한다.
 * - 학부모·학생 계정과 미등록 계정은 거부한다.
 * - 로컬 개발 서버(NODE_ENV=development)의 '교직원/어드민 세션 주입' 로그인은 Firebase 토큰이 없으므로
 *   X-Dev-Bypass 헤더가 있을 때만 통과시킨다. (운영 빌드에서는 무시됨)
 */
export class StaffAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface StaffCaller {
  email: string;
  profile: Record<string, any>;
  isDevBypass: boolean;
}

const NON_STAFF_ROLES = ['학부모', '학생', 'parent', 'student'];

export async function resolveStaffCaller(headers: Headers): Promise<StaffCaller> {
  const authorization = headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) {
    if (process.env.NODE_ENV === 'development' && headers.get('x-dev-bypass') === '1') {
      return { email: 'dev-bypass@localhost', profile: { role: 'admin', isAdmin: true }, isDevBypass: true };
    }
    throw new StaffAuthError(401, '로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.');
  }

  let email = '';
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    email = String(decoded.email || '').toLowerCase().trim();
  } catch {
    throw new StaffAuthError(401, '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.');
  }
  if (!email) throw new StaffAuthError(401, '로그인 계정의 이메일을 확인할 수 없습니다.');

  const snap = await getAdminDb().collection('users').doc(email).get();
  if (!snap.exists) throw new StaffAuthError(403, '등록된 교직원 계정만 사용할 수 있습니다.');
  const profile = { ...(snap.data() || {}), email };
  const role = String((profile as any).role || '');
  if (NON_STAFF_ROLES.includes(role) && !(profile as any).isAdmin) {
    throw new StaffAuthError(403, '교직원 계정만 사용할 수 있습니다.');
  }
  return { email, profile, isDevBypass: false };
}

/**
 * 라우트 첫 줄에서 사용: 교직원이 아니면 거부 응답(401/403)을 반환하고, 통과하면 null.
 *   const denied = await denyIfNotStaff(req); if (denied) return denied;
 */
export async function denyIfNotStaff(req: { headers: Headers }, logPrefix = '[staff-api]'): Promise<NextResponse | null> {
  try {
    await resolveStaffCaller(req.headers);
    return null;
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error(`${logPrefix} 요청자 확인 오류:`, err);
    return NextResponse.json({ success: false, error: '요청자 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
