import { NextRequest, NextResponse } from 'next/server';
import { AfterschoolApiError, enrollAfterschoolCourse, resolveAfterschoolCaller } from '@/lib/server/afterschoolEnrollment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 방과후 수강신청: 로그인 확인 + 서버 시각 기준 기간 판정 + 선착순 트랜잭션 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const caller = await resolveAfterschoolCaller(req.headers.get('authorization'), body?.devProfile);
    const result = await enrollAfterschoolCourse(caller, { courseId: body?.courseId, needsBus: body?.needsBus });
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    if (err instanceof AfterschoolApiError) {
      return NextResponse.json({ success: false, errorCode: err.code, error: err.message }, { status: err.status });
    }
    console.error('[api/afterschool/enroll] error:', err);
    return NextResponse.json(
      { success: false, errorCode: 'UNKNOWN', ...(process.env.NODE_ENV === 'development' ? { detail: String(err?.message || err) } : {}), error: '신청이 몰려 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
