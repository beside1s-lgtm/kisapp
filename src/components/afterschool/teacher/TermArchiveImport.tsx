'use client';

import React, { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { listTermArchives, getArchivedCourses, type TermArchiveMeta } from '@/lib/afterschool/closeSemester';

/** 보관된 강좌를 새 학기 일괄 개설 목록 형식으로 (인원·상태·수업 일정·수강료는 새 학기 기준으로 다시) */
const COPY_FIELDS = [
  'title', 'category', 'description',
  'instructorName', 'instructor2', 'instructor3', 'instructor4', 'instructor5', 'instructor6',
  'instructorPhone', 'instructorEmails', 'assistantTeachers',
  'classTime', 'selectedPeriods', 'classDays', 'classroom', 'classroomId',
  'maxStudents', 'maxWaiting', 'minStudentsToOpen', 'textbookFee', 'materialFee',
  'isFree', 'hasBusOption', 'kisbusDepartureTime', 'targetGrades',
] as const;

function toPreviewCourse(c: any, idx: number, classrooms: { id: string; name: string }[]) {
  const out: any = {};
  for (const k of COPY_FIELDS) if (c[k] !== undefined && c[k] !== null) out[k] = c[k];
  // 교실이 지금 교실 목록에 없으면 이름만 유지
  if (out.classroomId && !classrooms.some((r) => r.id === out.classroomId)) {
    const byName = classrooms.find((r) => r.name === out.classroom);
    out.classroomId = byName?.id || '';
  }
  return {
    ...out,
    id: `archive_${idx}_${Date.now()}`,
    currentStudents: 0,
    waitingStudents: 0,
    maxWaiting: out.maxWaiting ?? 5,
    textbookFee: out.textbookFee ?? 0,
    materialFee: out.materialFee ?? 0,
    tuition: 0, // 새 학기 운영 기간·수업일수로 다시 계산
    status: 'OPEN',
    checked: true,
  };
}

interface Props {
  classrooms: { id: string; name: string }[];
  onLoad: (courses: any[], label: string) => void;
}

export function TermArchiveImport({ classrooms, onLoad }: Props) {
  const [archives, setArchives] = useState<TermArchiveMeta[] | null>(null);
  const [selected, setSelected] = useState('');
  const [onlyOpened, setOnlyOpened] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listTermArchives()
      .then((list) => {
        setArchives(list);
        if (list[0]) setSelected(list[0].id);
      })
      .catch((e) => {
        console.warn('[TermArchiveImport] 보관 학기 목록을 읽지 못했습니다:', e);
        setArchives([]);
      });
  }, []);

  const handleLoad = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const meta = archives?.find((a) => a.id === selected);
      const list = await getArchivedCourses(selected);
      const picked = list
        .filter((c) => !onlyOpened || (c.status !== 'CANCELLED' && c.status !== 'PENDING'))
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ko'));
      if (!picked.length) {
        alert('불러올 강좌가 없습니다.');
        return;
      }
      const label = meta ? `${meta.year}학년도 ${meta.semester}` : selected;
      onLoad(picked.map((c, i) => toPreviewCourse(c, i, classrooms)), label);
    } catch (e: any) {
      alert('지난 학기 강좌를 불러오지 못했습니다.\n' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-violet-50/60 border border-violet-200/80 rounded-2xl p-5 space-y-3 shadow-sm">
      <div>
        <h4 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
          <History className="w-4 h-4 text-violet-600" />
          지난 학기 강좌 불러오기
        </h4>
        <p className="text-xs text-slate-500 mt-1">
          [운영 종료] 때 보관된 학년도·학기의 강좌와 강사 정보를 아래 목록으로 불러옵니다. 수강 인원은 0명으로, 수강료와 수업 일정은 이번 학기 기준으로 다시 계산됩니다.
        </p>
      </div>
      {archives === null ? (
        <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 보관된 학기를 확인하는 중…</p>
      ) : archives.length === 0 ? (
        <p className="text-xs text-slate-400">아직 보관된 학기가 없습니다. 방과후 [운영 종료]를 누르면 그 학기 강좌가 보관됩니다.</p>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 border border-violet-200 p-2.5 rounded-xl bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
          >
            {archives.map((a) => (
              <option key={a.id} value={a.id}>
                {a.year}학년도 {a.semester} — 강좌 {a.courseCount}개 · 강사 {a.instructorNames?.length ?? 0}명 · 수강 신청 {a.enrollmentCount}건
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={onlyOpened} onChange={(e) => setOnlyOpened(e.target.checked)} className="accent-violet-600" />
            개설된 강좌만 (폐강 제외)
          </label>
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading || !selected}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition text-xs shadow-sm whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            목록으로 불러오기
          </button>
        </div>
      )}
    </div>
  );
}
