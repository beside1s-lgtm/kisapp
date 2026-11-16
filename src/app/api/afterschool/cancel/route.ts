import { NextRequest, NextResponse } from 'next/server';
import { AfterschoolApiError, cancelAfterschoolCourse, resolveAfterschoolCaller } from '@/lib/server/afterschoolEnrollment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 방과후 수강신청 취소: 본인(자녀) 신청만 취소 + 대기 1순위 자동 승격 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const caller = await resolveAfterschoolCaller(req.headers.get('authorization'), body?.devProfile);
    const result = await cancelAfterschoolCourse(caller, { enrollmentId: body?.enrollmentId });
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    if (err instanceof AfterschoolApiError) {
      return NextResponse.json({ success: false, errorCode: err.code, error: err.message }, { status: err.status });
    }
    console.error('[api/afterschool/cancel] error:', err);
    return NextResponse.json({ success: false, errorCode: 'UNKNOWN', ...(process.env.NODE_ENV === 'development' ? { detail: String(err?.message || err) } : {}), error: '수강 신청 취소 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
