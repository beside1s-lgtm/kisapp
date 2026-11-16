import { NextResponse } from 'next/server';

// 서버(인터넷 표준) 시각 제공: 화면의 카운트다운/신청 가능 표시를 기기 시계가 아닌 서버 시각에 맞추는 데 사용
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
