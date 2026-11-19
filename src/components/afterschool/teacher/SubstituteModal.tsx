'use client';

/**
 * 강사 결근·대강(보결) 등록 창 — 교사 출석부(AttendanceManagement)와 관리자 서류 검토(AdminPanel) 공용
 *
 * 오입력 방지
 *  - 결근 강사를 자동으로 고르지 않는다. 반드시 직접 골라야 저장된다.
 *  - 이 회차에 이미 등록된 결근·대강 기록을 모두 보여 주고, 기록별로 바로 수정·삭제한다.
 *  - 결근 강사를 바꾸면 그 강사의 기존 기록을 불러온다.
 *  - 대강 강사는 시스템 설정의 교직원 명단에서 고른다(도장이 계정 서명으로 확실히 연결). 명단에 없는 외부 강사만 직접 입력.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Trash2, UserPlus, X, XCircle } from 'lucide-react';
import type { Course, SubstituteRecord } from '@/lib/afterschool/types';
import type { ScheduleDay } from '@/lib/afterschool/schedule';
import { deleteSubstituteRecord, saveSubstituteRecord } from '@/lib/services/settingsService';
import { getTeacherIndex } from '@/lib/teachers/teacherRegistry';
import type { TeacherLite } from '@/lib/teachers/teacherKey';

const EXTERNAL = '__external__';

export function courseInstructorList(course: Partial<Course> | null | undefined): string[] {
  if (!course) return [];
  const list = [course.instructorName, course.instructor2, course.instructor3, course.instructor4, course.instructor5, course.instructor6, ...((course as any).assistantTeachers || [])]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

/** 기록의 결근 강사 (예전 기록은 targetInstructor가 없으면 주강사) */
export const recordAbsentee = (s: SubstituteRecord, course: Partial<Course> | null | undefined) =>
  String(s.targetInstructor || s.originalInstructor || course?.instructorName || '').trim();

export const recordSummary = (s: SubstituteRecord, course: Partial<Course> | null | undefined) =>
  `결근: ${recordAbsentee(s, course)} / 대강: ${s.isAbsence || s.recordType === 'ABSENCE' ? '없음' : s.substituteInstructor || '없음'}`;

interface Props {
  course: Course;
  day: ScheduleDay;
  substituteRecords: SubstituteRecord[];
  /** 특정 강사 칸에서 열었을 때만 그 강사. 날짜 칸에서 열면 비워 둔다(직접 선택) */
  initialTarget?: string;
  onClose: () => void;
  /** 겹쳐 뜨는 화면 위에 열 때 (예: 관리자 서류 보기 위) */
  zClassName?: string;
}

export function SubstituteModal({ course, day, substituteRecords, initialTarget, onClose, zClassName = 'z-50' }: Props) {
  const instructors = useMemo(() => courseInstructorList(course), [course]);
  const dayRecords = useMemo(
    () => substituteRecords.filter((s) => s.courseId === course.id && s.dayIndex === day.dayIndex),
    [substituteRecords, course.id, day.dayIndex]
  );
  const recordFor = (inst: string) => dayRecords.find((s) => recordAbsentee(s, course) === inst);

  const [faculty, setFaculty] = useState<TeacherLite[]>([]);
  const [target, setTarget] = useState<string>('');
  const [recordType, setRecordType] = useState<'SUBSTITUTE' | 'ABSENCE'>('SUBSTITUTE');
  const [subEmail, setSubEmail] = useState<string>(''); // 교직원 이메일 또는 EXTERNAL
  const [externalName, setExternalName] = useState<string>('');
  const [reason, setReason] = useState<string>('개인사정/병가');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getTeacherIndex()
      .then((idx) => {
        if (!alive) return;
        setFaculty(Array.from(idx.byEmail.values()).filter((t) => t.name).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko')));
      })
      .catch(() => setFaculty([]));
    return () => {
      alive = false;
    };
  }, []);

  const facultyByEmail = useMemo(() => new Map(faculty.map((t) => [t.email, t])), [faculty]);
  const sameNameCount = useMemo(() => {
    const m = new Map<string, number>();
    faculty.forEach((t) => m.set(String(t.name), (m.get(String(t.name)) || 0) + 1));
    return m;
  }, [faculty]);

  /** 결근 강사를 고르면 그 강사의 기존 기록을 불러온다 */
  const loadTarget = (inst: string) => {
    setTarget(inst);
    const ex = inst ? recordFor(inst) : undefined;
    if (ex) {
      const abs = Boolean(ex.isAbsence || ex.recordType === 'ABSENCE');
      setRecordType(abs ? 'ABSENCE' : 'SUBSTITUTE');
      setReason(ex.reason || '');
      const name = abs ? '' : String(ex.substituteInstructor || '').trim();
      const email = (ex as any).substituteEmail as string | undefined;
      const match = email && facultyByEmail.has(email) ? email : faculty.find((t) => t.name === name && sameNameCount.get(name) === 1)?.email;
      if (!name) {
        setSubEmail('');
        setExternalName('');
      } else if (match) {
        setSubEmail(match);
        setExternalName('');
      } else {
        setSubEmail(EXTERNAL);
        setExternalName(name);
      }
    } else {
      setRecordType('SUBSTITUTE');
      setSubEmail('');
      setExternalName('');
      setReason('개인사정/병가');
    }
  };

  // 처음 열 때: 특정 강사 칸에서 연 경우만 그 강사, 강사가 한 명뿐이면 그 강사. 그 외에는 직접 선택
  useEffect(() => {
    const init = initialTarget && instructors.includes(initialTarget) ? initialTarget : instructors.length === 1 ? instructors[0] : '';
    loadTarget(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, day.dayIndex, initialTarget]);

  // 교직원 명단이 늦게 오면 이미 고른 기록의 대강 강사를 다시 맞춘다
  useEffect(() => {
    if (target && faculty.length) loadTarget(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faculty.length]);

  const existing = target ? recordFor(target) : undefined;
  const subName = subEmail === EXTERNAL ? externalName.trim() : String(facultyByEmail.get(subEmail)?.name || '').trim();
  const otherAbsentees = dayRecords.map((s) => recordAbsentee(s, course)).filter((n) => n && n !== target);

  const handleSave = async () => {
    if (!target) {
      alert('결근한 강사를 먼저 선택해 주세요.');
      return;
    }
    const isAbs = recordType === 'ABSENCE';
    if (!isAbs) {
      if (!subName) {
        alert('대강(보결) 강사를 선택해 주세요.');
        return;
      }
      if (subName === target) {
        alert('결근한 강사와 대강 강사가 같습니다. 다시 확인해 주세요.');
        return;
      }
      if (otherAbsentees.includes(subName)) {
        alert(`${subName} 강사는 이 회차에 결근으로 등록되어 있어 대강 강사로 지정할 수 없습니다.`);
        return;
      }
      if (instructors.includes(subName) && !window.confirm(`${subName} 강사는 이 강좌의 공동 강사입니다.\n본인 수업과 별도로 ${target} 강사의 대강 차시까지 지급됩니다. 계속할까요?`)) {
        return;
      }
    }
    const msg = isAbs
      ? `[${day.dayIndex}회차 ${day.dateStr}]\n결근: ${target} / 대강: 없음\n\n이대로 저장할까요?`
      : `[${day.dayIndex}회차 ${day.dateStr}]\n결근: ${target} / 대강: ${subName}\n\n이대로 저장할까요?`;
    if (!window.confirm(msg)) return;

    const record: SubstituteRecord & { substituteEmail?: string; updatedAt?: string } = {
      id: existing?.id || `sub_${course.id}_d${day.dayIndex}_${target.replace(/\s+/g, '')}`,
      courseId: course.id,
      courseTitle: course.title,
      dayIndex: day.dayIndex,
      dateStr: day.dateStr,
      sessionNos: day.sessionNos,
      sessionCount: day.sessionNos.length,
      originalInstructor: target,
      targetInstructor: target,
      substituteInstructor: isAbs ? '결근' : subName,
      substituteEmail: !isAbs && subEmail && subEmail !== EXTERNAL ? subEmail : '',
      recordType,
      isAbsence: isAbs,
      reason: reason.trim(),
      createdAt: existing?.createdAt || new Date().toLocaleString('ko-KR'),
      updatedAt: existing ? new Date().toLocaleString('ko-KR') : undefined,
    };
    setSaving(true);
    const res = await saveSubstituteRecord(record);
    setSaving(false);
    if (!res.success) {
      alert(`저장하지 못했습니다: ${res.error || '알 수 없는 오류'}`);
      return;
    }
    onClose();
  };

  const handleDelete = async (rec: SubstituteRecord) => {
    if (!window.confirm(`이 기록을 삭제할까요?\n${recordSummary(rec, course)}\n\n삭제하면 ${recordAbsentee(rec, course)} 강사는 정상 출근으로 돌아갑니다.`)) return;
    const res = await deleteSubstituteRecord(rec.id);
    if (!res.success) {
      alert(`삭제하지 못했습니다: ${res.error || '알 수 없는 오류'}`);
      return;
    }
    if (recordAbsentee(rec, course) === target) loadTarget('');
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/70 backdrop-blur-xs ${zClassName} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-amber-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            <h3 className="font-bold text-base">강사 결근·대강(보결) 관리</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg transition" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1">
            <div className="font-bold text-amber-950">{course.title}</div>
            <div className="text-xs text-amber-800">
              대상 회차: <strong>{day.dayIndex}회차 ({day.startSessionNo}~{day.endSessionNo}차시)</strong> · 일자: {day.dateStr} ({day.fullDate})
            </div>
          </div>

          {/* 이 회차에 이미 등록된 기록 */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-700">이 회차에 등록된 결근·대강 기록 ({dayRecords.length}건)</div>
            {dayRecords.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">등록된 기록이 없습니다. (모든 강사 정상 출근)</div>
            ) : (
              <ul className="space-y-1.5">
                {dayRecords.map((rec) => {
                  const who = recordAbsentee(rec, course);
                  const active = who === target;
                  return (
                    <li
                      key={rec.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${active ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                    >
                      <span className="flex-1 font-bold text-slate-800">{recordSummary(rec, course)}</span>
                      <button
                        type="button"
                        onClick={() => loadTarget(who)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                      >
                        <Pencil className="w-3 h-3" /> 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rec)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold"
                      >
                        <Trash2 className="w-3 h-3" /> 삭제
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <div className="text-xs font-bold text-slate-500">{existing ? `기록 수정 — ${target} 강사` : '새 기록 등록'}</div>

            {/* 결근 강사 (직접 선택) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                결근한 강사 <span className="text-rose-500">*</span>
              </label>
              <select
                value={target}
                onChange={(e) => loadTarget(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none ${target ? 'border-slate-300' : 'border-rose-300 bg-rose-50/40'}`}
              >
                <option value="">— 결근한 강사를 선택하세요 —</option>
                {instructors.map((inst) => {
                  const rec = recordFor(inst);
                  return (
                    <option key={inst} value={inst}>
                      {inst}
                      {rec ? ` (등록됨: ${rec.isAbsence || rec.recordType === 'ABSENCE' ? '결근' : `대강 ${rec.substituteInstructor}`})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {target && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">처리 유형</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecordType('SUBSTITUTE')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        recordType === 'SUBSTITUTE' ? 'bg-amber-100 border-amber-400 text-amber-900 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>대강(보결) 강사 있음</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordType('ABSENCE')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        recordType === 'ABSENCE' ? 'bg-rose-100 border-rose-400 text-rose-900 ring-1 ring-rose-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>결근만 (대강 없음)</span>
                    </button>
                  </div>
                </div>

                {recordType === 'SUBSTITUTE' ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      대강(보결) 강사 <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={subEmail}
                      onChange={(e) => setSubEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">— 교직원 명단에서 선택하세요 —</option>
                      {faculty
                        .filter((t) => t.name !== target)
                        .map((t) => (
                          <option key={t.email} value={t.email}>
                            {t.name}
                            {sameNameCount.get(String(t.name))! > 1 ? ` (${t.email})` : t.dept ? ` · ${t.dept}` : ''}
                          </option>
                        ))}
                      <option value={EXTERNAL}>명단에 없는 외부 강사 (직접 입력)</option>
                    </select>
                    {subEmail === EXTERNAL && (
                      <input
                        type="text"
                        placeholder="외부 강사 이름"
                        value={externalName}
                        onChange={(e) => setExternalName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    )}
                    <p className="text-[11px] text-slate-500">
                      ※ 출근부에는 대강 강사 계정에 등록된 서명(도장)이 찍히고, 강사료는 대강 강사에게 지급됩니다.
                      {subEmail === EXTERNAL && ' 외부 강사는 시스템 계정이 없어 서명을 따로 등록해야 합니다.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 leading-relaxed">
                    <strong>{target}</strong> 강사의 이 회차 출근 날인과 강사료가 빠집니다. 대신 수업한 강사가 있으면 [대강(보결) 강사 있음]을 고르세요.
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">사유</label>
                  <input
                    type="text"
                    placeholder="예: 병가, 공결, 출장, 개인사정 등"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800">
                  저장될 내용: 결근: {target} / 대강: {recordType === 'ABSENCE' ? '없음' : subName || '(선택 필요)'}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6 pt-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition">
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={!target || saving}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              recordType === 'SUBSTITUTE' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {existing ? '수정 저장' : recordType === 'SUBSTITUTE' ? '대강 등록' : '결근 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
