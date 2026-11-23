/**
 * 학급 기록 내보내기(보관용 HTML)
 *
 * 학년도를 넘기기 전, 담임이 한 학급(homeroom_classes/{classKey})의 기록을
 * 브라우저만 있으면 열 수 있는 단일 HTML 파일(읽기 전용, 앱과 비슷한 탭 화면)로 내려받는다.
 * 서버에는 아무것도 쓰지 않는다.
 *  탭: 자리배치(학생 카드) · 칭찬(등급·통장·보상·내역) · 숙제 · 알림장 · 관찰·상담(선택)
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
import { getPraiseTier } from '@/lib/types/seating';
import type { RewardItem, StudentRewardAccount, PointTransaction } from '@/lib/types/praiseReward';
import { AVATAR_PRESETS } from '@/lib/types/avatars';

export type ExportStudent = {
  id: string;
  name: string;
  num?: string | number;
  gender?: string;
  photoUrl?: string | null;
};

export type ClassExportInput = {
  /** Firestore 학급 데이터 키 (homeroomDataKey 결과) */
  classKey: string;
  classLabel: string;
  academicYear: number;
  students: ExportStudent[];
  exportedBy?: string;
  /** 학생 사진(및 사진형 아바타)을 파일 안에 넣을지 */
  includePhotos: boolean;
  /** 행동 관찰·상담 메모·학부모 상담 예약을 넣을지 */
  includeCounsel: boolean;
};

export type ClassExportResult = { html: string; fileName: string; counts: Record<string, number> };

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const multiline = (v: unknown) => esc(v).replace(/\n/g, '<br>');
const byStr = (f: (x: any) => string) => (a: any, b: any) => f(a).localeCompare(f(b));
const parseJson = <T,>(v: string | null | undefined, fb: T): T => {
  if (!v) return fb;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fb;
  }
};

async function readCol<T>(classKey: string, sub: string): Promise<T[]> {
  const snap = await getDocs(collection(getDb(), 'homeroom_classes', classKey, sub));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as T[];
}

/** 사진을 파일 안에 넣기 위해 data URL로 (실패하면 null) */
async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size > 1.5 * 1024 * 1024) return null;
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function table(headers: string[], rows: string[][], cls = '') {
  if (!rows.length) return '<p class="empty">기록 없음</p>';
  return `<table class="${cls}"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function card(title: string, body: string, extra = '') {
  return `<div class="card"><div class="card-h">${title}${extra ? `<span class="cnt">${extra}</span>` : ''}</div>${body}</div>`;
}

const genderLabel = (g?: string) => (!g ? '' : /^(m|male|남)/i.test(g) ? '남' : /^(f|female|여)/i.test(g) ? '여' : g);

export async function buildClassRecordExport(input: ClassExportInput): Promise<ClassExportResult> {
  const { classKey, classLabel, academicYear, students, exportedBy, includePhotos, includeCounsel } = input;
  const seatingKey = classKey.replace(/\//g, '_');

  const [memos, homeworks, checks, recurring, behaviors, consults, slots, plans, states] = await Promise.all([
    readCol<HomeroomDailyMemo & { id: string }>(classKey, 'memos'),
    readCol<HomeroomHomework>(classKey, 'homeworks'),
    readCol<HomeroomHomeworkCheck>(classKey, 'hw_checks'),
    readCol<RecurringHomework>(classKey, 'recurring_homeworks'),
    includeCounsel ? readCol<HomeroomBehaviorRecord>(classKey, 'behaviors') : Promise.resolve([]),
    includeCounsel ? readCol<HomeroomConsultation & { id: string }>(classKey, 'consultations') : Promise.resolve([]),
    includeCounsel ? readCol<BookingSlot>(classKey, 'consultation_slots') : Promise.resolve([]),
    readCol<SeatingPlan>(seatingKey, 'seating_plans'),
    readCol<{ id: string; key?: string; value?: string | null }>(classKey, 'state').catch(() => []),
  ]);

  // ── 학급 도구 상태 (서버 동기화본: 칭찬 점수·통장·보상·아바타)
  const stateMap = new Map<string, string | null>();
  for (const st of states) if (st.key) stateMap.set(st.key, st.value ?? null);
  const praisePrefix = `kis_praise_${classKey}_`;
  const praise = new Map<string, number>();
  const avatarPrefix = `kis_custom_avatar_${classKey}_`;
  const avatars = new Map<string, any>();
  for (const [k, v] of stateMap) {
    if (k.startsWith(avatarPrefix)) avatars.set(k.slice(avatarPrefix.length), parseJson(v, null));
    else if (k.startsWith(praisePrefix)) praise.set(k.slice(praisePrefix.length), Number(v) || 0);
  }
  const rewards = parseJson<RewardItem[]>(stateMap.get(`kis_praise_rewards_${classKey}`), []);
  const accounts = parseJson<Record<string, StudentRewardAccount>>(stateMap.get(`kis_praise_accounts_${classKey}`), {});
  const txs = parseJson<PointTransaction[]>(stateMap.get(`kis_praise_tx_${classKey}`), []);

  // 자리배치에만 있는 학생도 학생 목록에 포함
  const studentMap = new Map<string, ExportStudent>();
  for (const s of students) if (s.id) studentMap.set(s.id, s);
  for (const p of plans)
    for (const sl of p.slots || [])
      if (sl.studentId && !studentMap.has(sl.studentId))
        studentMap.set(sl.studentId, {
          id: sl.studentId,
          name: sl.studentName || '',
          num: sl.studentNum || '',
          gender: sl.studentGender || '',
          photoUrl: sl.studentPhotoUrl || null,
        });
  const sortedStudents = [...studentMap.values()].sort(
    (a, b) => Number(a.num || 0) - Number(b.num || 0) || a.name.localeCompare(b.name),
  );
  const nameOf = (id?: string) => (id && studentMap.get(id)?.name) || '';

  // ── 사진 (선택)
  const photos = new Map<string, string>();
  if (includePhotos) {
    await Promise.all(
      sortedStudents.map(async (s) => {
        const av = avatars.get(s.id);
        const src = av?.type === 'url' && av.value ? av.value : s.photoUrl || '';
        const data = src ? await toDataUrl(src) : null;
        if (data) photos.set(s.id, data);
      }),
    );
  }
  const avatarHtml = (sid: string, size: 'sm' | 'lg') => {
    const ph = photos.get(sid);
    if (ph) return `<img class="av av-${size}" src="${esc(ph)}" alt="">`;
    const av = avatars.get(sid);
    const emoji = av?.type === 'preset' ? av.emoji || AVATAR_PRESETS.find((p) => p.id === av.value)?.emoji : '';
    if (emoji) return `<span class="av av-${size} av-emoji">${esc(emoji)}</span>`;
    return `<span class="av av-${size} av-init">${esc((nameOf(sid) || '?').slice(-2))}</span>`;
  };
  const tierOf = (sid: string) => getPraiseTier(praise.get(sid) || 0, classKey);

  // ── 숙제 확인
  homeworks.sort(byStr((h) => `${h.date}${h.createdAt || ''}`));
  const checked = new Set(checks.filter((c) => c.checked).map((c) => `${c.hwId}_${c.studentId}`));
  const missOf = (sid: string) => homeworks.filter((h) => !checked.has(`${h.id}_${sid}`));

  behaviors.sort(byStr((b) => `${b.date}${b.createdAt || ''}`));
  const consultOf = new Map(consults.map((c) => [c.studentId || c.id, c]));

  // ══ 탭 1. 자리배치 ══
  plans.sort(byStr((p) => p.updatedAt || p.createdAt || ''));
  plans.reverse(); // 최신 배치가 먼저
  const seatGrid = (plan: SeatingPlan) => {
    const ss = (plan.slots || []).filter((s) => s.isActive !== false);
    if (!ss.length) return '<p class="empty">좌석 없음</p>';
    const maxR = Math.max(...ss.map((s) => s.row));
    const maxC = Math.max(...ss.map((s) => s.col));
    const at = new Map(ss.map((s) => [`${s.row}_${s.col}`, s]));
    let html = `<div class="board">칠판</div><div class="grid" style="grid-template-columns:repeat(${maxC + 1},minmax(64px,1fr))">`;
    for (let r = 0; r <= maxR; r++)
      for (let c = 0; c <= maxC; c++) {
        const s = at.get(`${r}_${c}`);
        if (!s) html += '<div class="gap"></div>';
        else if (!s.studentId) html += '<div class="desk empty-desk">빈자리</div>';
        else {
          const t = tierOf(s.studentId);
          html += `<button class="desk" data-sid="${esc(s.studentId)}">${avatarHtml(s.studentId, 'sm')}<b>${esc(
            nameOf(s.studentId) || s.studentName || '',
          )}</b><small>${esc(t.icon)} ${praise.get(s.studentId) || 0}점</small></button>`;
        }
      }
    return html + '</div>';
  };
  const seatingTab = plans.length
    ? `${plans.length > 1 ? `<div class="chips">${plans.map((p, i) => `<button class="chip${i ? '' : ' on'}" data-plan="${i}">${esc(p.config?.title || (p as any).title || `배치 ${i + 1}`)}</button>`).join('')}</div>` : ''}
      ${plans.map((p, i) => `<div class="plan" data-plan-body="${i}"${i ? ' hidden' : ''}>${card(esc(p.config?.title || (p as any).title || '자리배치도'), seatGrid(p), esc((p.updatedAt || p.createdAt || '').slice(0, 10)))}</div>`).join('')}
      <p class="hint">학생 자리를 누르면 학생 카드가 열립니다.</p>`
    : '<p class="empty">저장된 자리배치도가 없습니다.</p>';
  const rosterTab = `<div class="roster">${sortedStudents
    .map((s) => `<button class="desk" data-sid="${esc(s.id)}">${avatarHtml(s.id, 'sm')}<b>${esc(s.num ?? '')}. ${esc(s.name)}</b><small>${esc(tierOf(s.id).icon)} ${praise.get(s.id) || 0}점</small></button>`)
    .join('')}</div>`;

  // ══ 탭 2. 칭찬 ══
  const praiseRows = sortedStudents.map((s) => {
    const t = tierOf(s.id);
    const a = accounts[s.id];
    return [
      esc(s.num ?? ''),
      esc(s.name),
      `<b>${praise.get(s.id) || 0}</b>`,
      `${esc(t.icon)} ${esc(t.name)}`,
      a ? String(a.balance ?? 0) : '-',
      a ? String(a.totalEarned ?? 0) : '-',
      a ? String(a.totalSpent ?? 0) : '-',
    ];
  });
  const praiseTotal = sortedStudents.reduce((n, s) => n + (praise.get(s.id) || 0), 0);
  const txSorted = [...txs].sort(byStr((t) => t.timestamp || '')).reverse();
  const praiseTab =
    card('학생별 칭찬 점수·등급·통장', table(['번호', '이름', '칭찬 점수', '등급', '통장 잔액', '누적 적립', '누적 사용'], praiseRows), `학급 합계 ${praiseTotal}점`) +
    card('보상 목록', table(['보상', '필요 포인트', '설명', '사용'], rewards.map((r) => [`${esc(r.icon)} ${esc(r.name)}`, String(r.cost), esc(r.desc), r.isEnabled ? '사용' : '중지'])), `${rewards.length}개`) +
    card('포인트 내역', table(['일시', '이름', '구분', '증감', '사유', '잔액'], txSorted.map((t) => [
      esc((t.timestamp || '').replace('T', ' ').slice(0, 16)),
      esc(t.studentName || nameOf(t.studentId)),
      esc({ EARN: '적립', SPEND: '사용', ADJUST: '조정', TRANSFER: '이체' }[t.type] || t.type),
      `<span class="${t.amount < 0 ? 'neg' : 'pos'}">${t.amount > 0 ? '+' : ''}${t.amount}</span>`,
      esc(t.reason),
      String(t.balanceAfter ?? ''),
    ]), 'small'), `${txs.length}건`);

  // ══ 탭 3. 숙제 ══
  const freq: Record<string, string> = { weekly: '매주', biweekly: '격주', monthly: '매월' };
  const wd = ['일', '월', '화', '수', '목', '금', '토'];
  const hwTab =
    card('숙제 목록', table(['날짜', '숙제', '제출'], homeworks.map((h) => {
      const n = sortedStudents.filter((s) => checked.has(`${h.id}_${s.id}`)).length;
      return [esc(h.dateWithDay || h.date), esc(h.title), `${n} / ${sortedStudents.length}`];
    })), `${homeworks.length}건`) +
    (homeworks.length ? card('학생별 미제출', table(['번호', '이름', '미제출', '미제출 숙제'], sortedStudents.map((s) => {
      const miss = missOf(s.id);
      return [esc(s.num ?? ''), esc(s.name), String(miss.length), esc(miss.map((h) => `${h.date} ${h.title}`).join(', '))];
    }), 'small')) : '') +
    card('정기 과제', table(['과제', '주기', '기간', '상태'], recurring.map((r) => [
      esc(r.title),
      esc(`${freq[r.frequency] || r.frequency} ${r.frequency === 'monthly' ? `${r.monthDay ?? ''}일` : `${wd[r.weekDay ?? 0]}요일`}`),
      esc(`${r.startDate || ''} ~ ${r.endDate || ''}`),
      r.isActive ? '사용' : '중지',
    ])), `${recurring.length}건`);

  // ══ 탭 4. 알림장 ══
  memos.sort(byStr((m) => m.date || m.id)).reverse();
  const memoTab = memos.length
    ? memos.map((m) => card(esc(m.date || m.id), `<div class="memo">${multiline(m.content)}</div>`)).join('')
    : '<p class="empty">기록 없음</p>';

  // ══ 탭 5. 관찰·상담 (선택) ══
  const booked = slots.filter((s) => s.status === 'BOOKED' && s.bookedBy).sort(byStr((s) => `${s.date}${s.timeRange}`));
  const counselTab = includeCounsel
    ? card('행동 관찰', table(['날짜', '번호', '이름', '내용'], behaviors.map((b) => [
        esc(b.date), esc(b.studentNum || studentMap.get(b.studentId)?.num || ''), esc(b.studentName || nameOf(b.studentId)), multiline(b.content),
      ])), `${behaviors.length}건`) +
      card('상담 메모', table(['이름', '내용', '최종 수정'], [...consults].sort(byStr((c) => c.studentName || nameOf(c.studentId || c.id))).map((c) => [
        esc(c.studentName || nameOf(c.studentId || c.id) || c.id), multiline(c.content), esc((c.updatedAt || '').slice(0, 10)),
      ])), `${consults.length}건`) +
      card('학부모 상담 예약', table(['날짜', '시간', '학생'], booked.map((s) => [esc(s.date), esc(s.timeRange), esc(s.bookedBy?.studentName || '')])), `${booked.length}건`)
    : '';

  // ── 학생 카드 (자리배치·명단에서 누르면 열림)
  const studentCards = sortedStudents.map((s) => {
    const t = tierOf(s.id);
    const a = accounts[s.id];
    const miss = missOf(s.id);
    const myBeh = behaviors.filter((b) => b.studentId === s.id);
    const myCon = consultOf.get(s.id);
    const myTx = txSorted.filter((x) => x.studentId === s.id).slice(0, 10);
    return `<div class="scard" data-card="${esc(s.id)}" hidden>
      <div class="scard-top">${avatarHtml(s.id, 'lg')}<div><div class="sname">${esc(s.name)}</div>
      <div class="smeta">${esc(classLabel)} ${esc(s.num ?? '')}번${genderLabel(s.gender) ? ` · ${esc(genderLabel(s.gender))}` : ''}</div>
      <div class="tier">${esc(t.icon)} ${esc(t.name)} · 칭찬 ${praise.get(s.id) || 0}점</div></div></div>
      <div class="stats"><div><b>${a ? a.balance ?? 0 : '-'}</b><span>통장 잔액</span></div><div><b>${a ? a.totalEarned ?? 0 : '-'}</b><span>누적 적립</span></div><div><b>${homeworks.length ? `${homeworks.length - miss.length}/${homeworks.length}` : '-'}</b><span>숙제 제출</span></div></div>
      ${miss.length ? `<h4>미제출 숙제</h4><p class="small">${esc(miss.map((h) => `${h.date} ${h.title}`).join(', '))}</p>` : ''}
      ${myTx.length ? `<h4>최근 포인트 내역</h4>${table(['일시', '증감', '사유'], myTx.map((x) => [esc((x.timestamp || '').slice(0, 10)), `${x.amount > 0 ? '+' : ''}${x.amount}`, esc(x.reason)]), 'small')}` : ''}
      ${includeCounsel ? `<h4>행동 관찰 ${myBeh.length}건</h4>${myBeh.length ? table(['날짜', '내용'], myBeh.map((b) => [esc(b.date), multiline(b.content)]), 'small') : '<p class="empty">없음</p>'}
      <h4>상담 메모</h4>${myCon?.content ? `<div class="memo">${multiline(myCon.content)}</div>` : '<p class="empty">없음</p>'}` : ''}
    </div>`;
  }).join('');

  const tabs: [string, string, string][] = [
    ['seating', '자리배치', seatingTab + card('학생 명단', rosterTab, `${sortedStudents.length}명`)],
    ['praise', '칭찬', praiseTab],
    ['homework', '숙제', hwTab],
    ['memo', '알림장', memoTab],
  ];
  if (includeCounsel) tabs.push(['counsel', '관찰·상담', counselTab]);

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const title = `${academicYear}학년도 ${classLabel} 학급 기록`;
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box}body{font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1e293b;background:#f1f5f9;margin:0;font-size:14px}
.wrap{max-width:1100px;margin:0 auto;padding:20px 16px 48px}
.head{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
h1{font-size:20px;font-weight:900;margin:0}.meta{color:#64748b;font-size:12px}.badge{display:inline-block;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:999px;font-size:11px;font-weight:700;padding:1px 8px;margin-left:6px}
.notice{margin-top:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:8px 12px;font-size:12px}
.tabs{display:flex;gap:4px;flex-wrap:wrap;margin:14px 0 12px;background:#e2e8f0;padding:4px;border-radius:12px;width:fit-content;max-width:100%}
.tabs button{border:0;background:transparent;padding:7px 14px;border-radius:9px;font-weight:700;color:#475569;cursor:pointer;font-size:13px}.tabs button.on{background:#fff;color:#0f172a;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;margin-bottom:12px;overflow-x:auto}
.card-h{font-weight:800;font-size:15px;margin-bottom:10px;display:flex;gap:8px;align-items:baseline}.cnt{font-size:12px;color:#64748b;font-weight:500}
.empty{color:#94a3b8;margin:4px 0}.hint{color:#64748b;font-size:12px;margin:-4px 0 12px}.small{font-size:12px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;word-break:keep-all;text-align:left;vertical-align:top}th{background:#f8fafc;color:#475569;font-size:12px;white-space:nowrap}table.small td,table.small th{font-size:12px;padding:4px 6px}
.pos{color:#059669;font-weight:700}.neg{color:#dc2626;font-weight:700}
.board{width:50%;min-width:180px;margin:0 auto 12px;text-align:center;background:#14532d;color:#ecfdf5;font-size:12px;font-weight:700;padding:5px;border-radius:6px}
.grid{display:grid;gap:8px}.gap{min-height:20px}
.desk{display:flex;flex-direction:column;align-items:center;gap:3px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:8px 4px;cursor:pointer;font:inherit;color:inherit}.desk:hover{border-color:#2471B2;background:#eff6ff}
.desk b{font-size:12px}.desk small{font-size:11px;color:#64748b}.empty-desk{background:#f8fafc;border:1.5px dashed #cbd5e1;color:#94a3b8;font-size:11px;cursor:default;justify-content:center}
.roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.chip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer}.chip.on{background:#2471B2;color:#fff;border-color:#2471B2}
.av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;object-fit:cover;background:#e2e8f0;color:#475569;font-weight:800;flex-shrink:0}
.av-sm{width:36px;height:36px;font-size:12px}.av-lg{width:72px;height:72px;font-size:20px}.av-emoji.av-sm{font-size:20px}.av-emoji.av-lg{font-size:40px}
.memo{white-space:normal;line-height:1.6}
.ov{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10}.ov[hidden]{display:none}
.modal{background:#fff;border-radius:20px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:18px;position:relative}
.x{position:absolute;top:10px;right:12px;border:0;background:#f1f5f9;border-radius:8px;width:30px;height:30px;font-size:16px;cursor:pointer}
.scard-top{display:flex;gap:14px;align-items:center}.sname{font-size:20px;font-weight:900}.smeta{color:#64748b;font-size:12px}.tier{margin-top:4px;font-weight:700;color:#b45309;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.stats div{background:#f8fafc;border-radius:12px;padding:8px;text-align:center}.stats b{display:block;font-size:17px}.stats span{font-size:11px;color:#64748b}
h4{font-size:13px;margin:14px 0 6px}
@media print{body{background:#fff}.tabs,.chips,.hint,.ov{display:none!important}[data-tab-body]{display:block!important}[data-plan-body]{display:block!important}.card{break-inside:avoid-page}}
</style></head><body><div class="wrap">
<div class="head"><div><h1>${esc(title)}<span class="badge">재적 ${students.length}명</span></h1>
<div class="meta">내보낸 날 ${stamp}${exportedBy ? ` · ${esc(exportedBy)}` : ''} · 읽기 전용 보관본 (이 파일을 고쳐도 앱 데이터는 바뀌지 않습니다)</div></div></div>
<div class="notice">🔒 학생 개인정보${includePhotos ? '(사진 포함)' : ''}${includeCounsel ? '와 관찰·상담 기록' : ''}이 들어 있는 파일입니다. 학교 업무용 저장소에만 보관하고, 메신저·개인 메일로 보내거나 공유 폴더에 올리지 마세요. 보존 기간이 지나면 지워 주세요.</div>
<div class="tabs">${tabs.map(([id, label], i) => `<button data-tab="${id}"${i ? '' : ' class="on"'}>${esc(label)}</button>`).join('')}</div>
${tabs.map(([id, , body], i) => `<div data-tab-body="${id}"${i ? ' hidden' : ''}>${body}</div>`).join('\n')}
</div>
<div class="ov" id="ov" hidden><div class="modal"><button class="x" id="x" aria-label="닫기">✕</button>${studentCards}</div></div>
<script>
(function(){
  var $=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
  $('[data-tab]').forEach(function(b){b.onclick=function(){
    $('[data-tab]').forEach(function(x){x.classList.toggle('on',x===b)});
    $('[data-tab-body]').forEach(function(x){x.hidden=x.getAttribute('data-tab-body')!==b.getAttribute('data-tab')});
  }});
  $('[data-plan]').forEach(function(b){b.onclick=function(){
    $('[data-plan]').forEach(function(x){x.classList.toggle('on',x===b)});
    $('[data-plan-body]').forEach(function(x){x.hidden=x.getAttribute('data-plan-body')!==b.getAttribute('data-plan')});
  }});
  var ov=document.getElementById('ov');
  $('.desk[data-sid]').forEach(function(d){d.onclick=function(){
    var id=d.getAttribute('data-sid');
    $('[data-card]').forEach(function(c){c.hidden=c.getAttribute('data-card')!==id});
    ov.hidden=false;
  }});
  document.getElementById('x').onclick=function(){ov.hidden=true};
  ov.onclick=function(e){if(e.target===ov)ov.hidden=true};
  document.addEventListener('keydown',function(e){if(e.key==='Escape')ov.hidden=true});
})();
</script>
</body></html>`;

  const safeLabel = classLabel.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '');
  return {
    html,
    fileName: `${academicYear}학년도_${safeLabel}_학급기록.html`,
    counts: {
      memos: memos.length, homeworks: homeworks.length, behaviors: behaviors.length,
      consultations: consults.length, bookings: booked.length, seating: plans.length,
      praise: praise.size, transactions: txs.length, photos: photos.size,
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
