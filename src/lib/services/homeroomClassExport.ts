/**
 * 학급 기록 내보내기(보관용 HTML)
 *
 * 학년도를 넘기기 전, 담임이 한 학급(homeroom_classes/{classKey})의 기록을
 * 브라우저만 있으면 열 수 있는 단일 HTML 파일로 내려받는다. (서버에는 아무것도 쓰지 않음)
 *  - 알림장, 숙제·숙제 확인, 정기 과제, 행동 관찰, 상담 메모, 학부모 상담 예약, 자리배치도, 칭찬 점수
 */
import { getDb } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type {
  HomeroomDailyMemo,
  HomeroomHomework,
  HomeroomHomeworkCheck,
  HomeroomBehaviorRecord,
  HomeroomConsultation,
  BookingSlot,
  RecurringHomework,
} from '@/lib/types/homeroomClass';
import type { SeatingPlan } from '@/lib/types/seating';

type StudentLite = { id: string; name: string; num?: string | number };

export type ClassExportInput = {
  /** Firestore 학급 데이터 키 (homeroomDataKey 결과) */
  classKey: string;
  classLabel: string;
  academicYear: number;
  students: StudentLite[];
  exportedBy?: string;
};

export type ClassExportResult = { html: string; fileName: string; counts: Record<string, number> };

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const multiline = (v: unknown) => esc(v).replace(/\n/g, '<br>');
const byStr = (f: (x: any) => string) => (a: any, b: any) => f(a).localeCompare(f(b));

async function readCol<T>(classKey: string, sub: string): Promise<T[]> {
  const snap = await getDocs(collection(getDb(), 'homeroom_classes', classKey, sub));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as T[];
}

function section(title: string, count: number, body: string) {
  return `<section><h2>${esc(title)} <span class="cnt">${count}건</span></h2>${count ? body : '<p class="empty">기록 없음</p>'}</section>`;
}

function table(headers: string[], rows: string[][]) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function seatingGrid(plan: SeatingPlan) {
  const slots = (plan.slots || []).filter((s) => s.isActive !== false);
  if (!slots.length) return '<p class="empty">좌석 없음</p>';
  const maxR = Math.max(...slots.map((s) => s.row));
  const maxC = Math.max(...slots.map((s) => s.col));
  const at = new Map(slots.map((s) => [`${s.row}_${s.col}`, s]));
  let html = '<div class="board">칠판</div><table class="seat">';
  for (let r = 0; r <= maxR; r++) {
    html += '<tr>';
    for (let c = 0; c <= maxC; c++) {
      const s = at.get(`${r}_${c}`);
      html += s ? `<td class="desk">${esc(s.studentName || '')}</td>` : '<td class="gap"></td>';
    }
    html += '</tr>';
  }
  return html + '</table>';
}

export async function buildClassRecordExport(input: ClassExportInput): Promise<ClassExportResult> {
  const { classKey, classLabel, academicYear, students, exportedBy } = input;
  const seatingKey = classKey.replace(/\//g, '_');

  const [memos, homeworks, checks, recurring, behaviors, consults, slots, plans, states] = await Promise.all([
    readCol<HomeroomDailyMemo & { id: string }>(classKey, 'memos'),
    readCol<HomeroomHomework>(classKey, 'homeworks'),
    readCol<HomeroomHomeworkCheck>(classKey, 'hw_checks'),
    readCol<RecurringHomework>(classKey, 'recurring_homeworks'),
    readCol<HomeroomBehaviorRecord>(classKey, 'behaviors'),
    readCol<HomeroomConsultation & { id: string }>(classKey, 'consultations'),
    readCol<BookingSlot>(classKey, 'consultation_slots'),
    readCol<SeatingPlan>(seatingKey, 'seating_plans'),
    readCol<{ id: string; key?: string; value?: string | null }>(classKey, 'state').catch(() => []),
  ]);

  const nameOf = new Map(students.map((s) => [s.id, s.name]));
  const sortedStudents = [...students].sort((a, b) => Number(a.num || 0) - Number(b.num || 0) || a.name.localeCompare(b.name));
  const parts: string[] = [];

  // 1. 알림장
  memos.sort(byStr((m) => m.date || m.id));
  parts.push(section('알림장', memos.length, table(['날짜', '내용'],
    memos.map((m) => [esc(m.date || m.id), multiline(m.content)]))));

  // 2. 숙제 및 확인 현황 (학생 × 숙제)
  homeworks.sort(byStr((h) => `${h.date}${h.createdAt || ''}`));
  const checked = new Set(checks.filter((c) => c.checked).map((c) => `${c.hwId}_${c.studentId}`));
  let hwBody = table(['날짜', '숙제', '제출'],
    homeworks.map((h) => {
      const n = sortedStudents.filter((s) => checked.has(`${h.id}_${s.id}`)).length;
      return [esc(h.dateWithDay || h.date), esc(h.title), `${n} / ${sortedStudents.length}`];
    }));
  if (homeworks.length && sortedStudents.length) {
    hwBody += '<h3>학생별 미제출</h3>' + table(['번호', '이름', '미제출 수', '미제출 숙제'],
      sortedStudents.map((s) => {
        const miss = homeworks.filter((h) => !checked.has(`${h.id}_${s.id}`));
        return [esc(s.num ?? ''), esc(s.name), String(miss.length), esc(miss.map((h) => `${h.date} ${h.title}`).join(', '))];
      }));
  }
  parts.push(section('숙제', homeworks.length, hwBody));

  // 3. 정기 과제
  const freq: Record<string, string> = { weekly: '매주', biweekly: '격주', monthly: '매월' };
  const wd = ['일', '월', '화', '수', '목', '금', '토'];
  parts.push(section('정기 과제', recurring.length, table(['과제', '주기', '기간', '상태'],
    recurring.map((r) => [
      esc(r.title),
      esc(`${freq[r.frequency] || r.frequency} ${r.frequency === 'monthly' ? `${r.monthDay ?? ''}일` : `${wd[r.weekDay ?? 0]}요일`}`),
      esc(`${r.startDate || ''} ~ ${r.endDate || ''}`),
      r.isActive ? '사용' : '중지',
    ]))));

  // 4. 행동 관찰 (학생별로 묶기)
  behaviors.sort(byStr((b) => `${b.studentNum || ''}${b.studentName}${b.date}`));
  parts.push(section('행동 관찰', behaviors.length, table(['번호', '이름', '날짜', '내용'],
    behaviors.map((b) => [esc(b.studentNum || ''), esc(b.studentName || nameOf.get(b.studentId) || ''), esc(b.date), multiline(b.content)]))));

  // 5. 상담 메모
  consults.sort(byStr((c) => c.studentName || nameOf.get(c.studentId || c.id) || ''));
  parts.push(section('상담 메모', consults.length, table(['이름', '내용', '최종 수정'],
    consults.map((c) => [esc(c.studentName || nameOf.get(c.studentId || c.id) || c.id), multiline(c.content), esc((c.updatedAt || '').slice(0, 10))]))));

  // 6. 학부모 상담 예약 (예약된 칸만)
  const booked = slots.filter((s) => s.status === 'BOOKED' && s.bookedBy).sort(byStr((s) => `${s.date}${s.timeRange}`));
  parts.push(section('학부모 상담 예약', booked.length, table(['날짜', '시간', '학생'],
    booked.map((s) => [esc(s.date), esc(s.timeRange), esc(s.bookedBy?.studentName || '')]))));

  // 7. 자리배치도
  plans.sort(byStr((p) => p.createdAt || ''));
  parts.push(section('자리배치도', plans.length, plans
    .map((p) => `<div class="plan"><h3>${esc(p.title || p.config?.title || '자리배치도')} <small>${esc((p.updatedAt || p.createdAt || '').slice(0, 10))}</small></h3>${seatingGrid(p)}</div>`)
    .join('')));

  // 8. 칭찬 점수 (학급 도구 상태: kis_praise_{classKey}_{studentId})
  const praisePrefix = `kis_praise_${classKey}_`;
  const praise = new Map<string, number>();
  for (const st of states) {
    const k = st.key || '';
    if (k.startsWith(praisePrefix)) praise.set(k.slice(praisePrefix.length), Number(st.value) || 0);
  }
  const praiseRows = sortedStudents.filter((s) => praise.has(s.id));
  parts.push(section('칭찬 점수', praiseRows.length, table(['번호', '이름', '점수'],
    praiseRows.map((s) => [esc(s.num ?? ''), esc(s.name), String(praise.get(s.id))]))));

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const title = `${academicYear}학년도 ${classLabel} 학급 기록`;
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1e293b;background:#fff;max-width:1000px;margin:0 auto;padding:24px 16px;font-size:14px}
h1{font-size:22px;margin:0 0 4px}.meta{color:#64748b;font-size:12px;margin-bottom:16px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}nav a{font-size:12px;padding:3px 8px;border:1px solid #cbd5e1;border-radius:6px;color:#334155;text-decoration:none}
section{margin-bottom:28px;break-inside:avoid-page}h2{font-size:17px;border-bottom:2px solid #2471B2;padding-bottom:4px}h3{font-size:14px;margin:14px 0 6px}
.cnt{font-size:12px;color:#64748b;font-weight:normal}.empty{color:#94a3b8}
table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f5f9;white-space:nowrap}
table.seat{width:auto}table.seat td{width:72px;height:34px;text-align:center;font-size:12px}td.desk{background:#f8fafc}td.gap{border:none}
.board{width:220px;text-align:center;background:#334155;color:#fff;font-size:12px;padding:3px;margin:4px 0 8px;border-radius:4px}
@media print{nav{display:none}body{padding:0}}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">재적 ${students.length}명 · 내보낸 날 ${stamp}${exportedBy ? ` · ${esc(exportedBy)}` : ''} · 보관용 사본(이 파일을 고쳐도 앱 데이터는 바뀌지 않습니다)</div>
${parts.join('\n')}
</body></html>`;

  const safeLabel = classLabel.replace(/[\\/:*?"<>|\s]+/g, '_');
  return {
    html,
    fileName: `${academicYear}학년도_${safeLabel}_학급기록_${stamp}.html`,
    counts: {
      memos: memos.length, homeworks: homeworks.length, behaviors: behaviors.length,
      consultations: consults.length, bookings: booked.length, seating: plans.length, praise: praiseRows.length,
    },
  };
}

export function downloadHtml(html: string, fileName: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
