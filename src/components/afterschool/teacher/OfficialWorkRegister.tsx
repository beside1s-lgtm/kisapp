'use client';

import React from 'react';
import { Printer, X, UserPlus, Trash2 } from 'lucide-react';
import { OfficialSeal } from './OfficialAttendanceSheet';

export interface WorkRegisterScheduleDay {
  dayIndex: number;
  dateStr: string;
  fullDate?: string;
  startSessionNo?: number;
  endSessionNo?: number;
  sessionNos: number[];
}

export interface OfficialWorkRegisterProps {
  course: {
    id: string;
    title: string;
    instructorName?: string;
    instructor2?: string;
    instructor3?: string;
    instructor4?: string;
    assistantTeachers?: string[];
    classTime?: string;
    startDate?: string;
    endDate?: string;
  };
  scheduleDays: WorkRegisterScheduleDay[];
  attendanceRecords: Array<{
    courseId: string;
    sessionNo?: number;
    status?: string;
    markSymbol?: string;
  }>;
  substituteRecords?: Array<{
    id: string;
    courseId: string;
    dayIndex: number;
    isAbsence?: boolean;
    reason?: string;
    substituteInstructor?: string;
    targetInstructor?: string;
  }>;
  getInstructorSeal: (name: string) => string | undefined;
  managerSignature?: string;
  vicePrincipalSignature?: string;
  isManagerApproved?: boolean;
  isVicePrincipalApproved?: boolean;
  onRequestSignature?: (teacherName: string, courseId?: string) => void;
  onManageSubstitute?: (day: WorkRegisterScheduleDay, targetInstructor?: string) => void;
  onClose?: () => void;
  onDeleteApprovalDoc?: () => void;
  deleteDocLabel?: string;
  isModal?: boolean;
  yearSemesterText?: string;
}

export const OfficialWorkRegister: React.FC<OfficialWorkRegisterProps> = ({
  course,
  scheduleDays,
  attendanceRecords,
  substituteRecords = [],
  getInstructorSeal,
  managerSignature,
  vicePrincipalSignature,
  isManagerApproved,
  isVicePrincipalApproved,
  onRequestSignature,
  onManageSubstitute,
  onClose,
  onDeleteApprovalDoc,
  deleteDocLabel = '제출 서류 반려 및 삭제',
  isModal = true,
  yearSemesterText = '2026학년도 1학기 방과후학교',
}) => {
  const mainInstructor = course.instructorName || '강사';
  const assistantInstructors = [
    course.instructor2,
    course.instructor3,
    course.instructor4,
    ...(course.assistantTeachers || []),
  ].filter((name): name is string => Boolean(name && name.trim() !== mainInstructor.trim()));

  const allCourseInstructors = [mainInstructor, ...assistantInstructors];

  const handlePrint = () => {
    if (!getInstructorSeal(mainInstructor) && onRequestSignature) {
      if (
        confirm(
          `주강사 [${mainInstructor}] 선생님의 도장(서명)이 등록되지 않았습니다. 서명을 먼저 등록하시겠습니까?\n(취소 시 기본 원형 직인으로 인쇄됩니다)`
        )
      ) {
        onRequestSignature(mainInstructor, course.id);
        return;
      }
    }
    window.print();
  };

  const content = (
    <div className="official-work-register-print-area bg-white p-4 md:p-6 print:p-0 border border-slate-300 print:border-none rounded-lg text-slate-950 font-sans">
      {/* ─── 상단 헤더 & 결재란 (실물 규격: 가로 24mm x 세로 18mm 결재란 완벽 고정) ─── */}
      <div className="flex justify-between items-start gap-4 mb-3 border-b border-slate-900 pb-3">
        <div>
          <div className="text-xs text-slate-600 font-bold font-sans tracking-tight">
            {yearSemesterText}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-950 font-sans mt-0.5 tracking-tight">
            강사출근부 ({course.title})
          </h1>
          <div className="text-xs text-slate-700 mt-1.5 space-y-0.5 font-sans">
            <div>
              <span className="font-semibold text-slate-600">지도강사: </span>
              <strong className="text-slate-950 font-bold">{mainInstructor}</strong>
              {assistantInstructors.length > 0 && (
                <span className="text-slate-600 ml-1.5">
                  (보조강사: <strong className="text-slate-900">{assistantInstructors.join(', ')}</strong>)
                </span>
              )}
            </div>
            {course.classTime && (
              <div>
                <span className="font-semibold text-slate-600">수업시간: </span>
                <span className="text-slate-800">{course.classTime}</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── 표준 결재란 (인쇄 및 화면 1:1 완벽 일치 규격) ─── */}
        <div className="shrink-0">
          <table className="border-collapse border-2 border-black text-xs text-center font-sans">
            <tbody>
              <tr>
                <td
                  rowSpan={2}
                  className="border border-black bg-slate-100 font-bold w-[20px] text-[10.5px] leading-tight px-1 py-1 align-middle text-center"
                >
                  결<br />재
                </td>
                <td className="border border-black bg-slate-50 font-bold w-[24mm] min-w-[24mm] max-w-[24mm] py-1 text-[11px] text-center">
                  부장
                </td>
                <td className="border border-black bg-slate-50 font-bold w-[24mm] min-w-[24mm] max-w-[24mm] py-1 text-[11px] text-center">
                  교감
                </td>
              </tr>
              <tr className="h-[18mm] min-h-[18mm] max-h-[18mm]">
                <td className="border border-black p-0.5 align-middle text-center w-[24mm] min-w-[24mm] max-w-[24mm] h-[18mm]">
                  <div className="w-full h-full flex items-center justify-center">
                    {isManagerApproved ? (
                      <OfficialSeal name="부장" signatureUrl={managerSignature} size="md" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </td>
                <td className="border border-black p-0.5 align-middle text-center w-[24mm] min-w-[24mm] max-w-[24mm] h-[18mm]">
                  <div className="w-full h-full flex items-center justify-center">
                    {isVicePrincipalApproved ? (
                      <OfficialSeal name="교감" signatureUrl={vicePrincipalSignature} size="md" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 출근부 본체 테이블 ─── */}
      <table className="w-full border-collapse border-2 border-black text-xs text-center font-sans">
        <thead className="bg-slate-100 font-bold">
          <tr>
            <th className="border border-black p-1.5 w-[28mm] min-w-[28mm] text-[11px] text-center">
              회차 (차시)
            </th>
            <th className="border border-black p-1.5 w-[36mm] min-w-[36mm] text-[11px] text-center">
              수업 날짜
            </th>
            <th className="border border-black p-1.5 text-[11px] text-center">
              강사 서명 (출근 날인)
            </th>
            {onManageSubstitute && (
              <th className="border border-black p-1.5 w-[28mm] min-w-[28mm] text-[11px] text-center no-print">
                보결/결근 관리
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {scheduleDays.map((day) => {
            const records = attendanceRecords.filter(
              (r) =>
                r.courseId === course.id &&
                day.sessionNos.includes(r.sessionNo || 0) &&
                Boolean(r.status || (r as any).markSymbol)
            );
            const hasChecked = records.length > 0;

            const daySubs = substituteRecords.filter(
              (s) => s.courseId === course.id && s.dayIndex === day.dayIndex
            );

            return (
              <tr
                key={day.dayIndex}
                className={`h-[16mm] min-h-[16mm] hover:bg-slate-50 ${daySubs.length > 0 ? 'bg-amber-50/40' : ''}`}
              >
                <td className="border border-black font-mono font-bold bg-slate-50 text-[10.5px] px-1.5 py-1 align-middle text-center">
                  {day.dayIndex}회차
                  <div className="text-[9.5px] text-slate-500 font-normal">
                    ({day.startSessionNo || (day.dayIndex * 2 - 1)}~{day.endSessionNo || (day.dayIndex * 2)}차시)
                  </div>
                </td>
                <td className="border border-black font-mono text-[11px] text-slate-900 px-1.5 py-1 align-middle text-center">
                  <div className="font-bold">{day.dateStr}</div>
                  {day.fullDate && <div className="text-[9.5px] text-slate-500">{day.fullDate}</div>}
                  {daySubs.map((s) => (
                    <div key={s.id} className="text-[9.5px] text-amber-800 font-sans font-medium mt-0.5">
                      {s.targetInstructor ? `[${s.targetInstructor}] ` : ''}
                      {s.isAbsence ? '결근' : `보결(${s.substituteInstructor})`}
                    </div>
                  ))}
                </td>
                <td className="border border-black px-2 py-1 align-middle">
                  {hasChecked ? (
                    /* 강사 서명: 1줄에 2명씩 2열 그리드 배치 (도장 15mm 실물 규격 유지) */
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 items-center justify-items-center">
                      {allCourseInstructors.map((inst) => {
                        const sub = daySubs.find((s) => !s.targetInstructor || s.targetInstructor === inst);
                        if (sub?.isAbsence) {
                          return (
                            <div key={inst} className="flex items-center gap-1">
                              <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.5 rounded font-bold">
                                결근
                              </span>
                              <span className="line-through text-slate-400 font-bold text-[11px]">{inst}</span>
                              <span className="text-[9.5px] text-slate-500">({sub.reason || '사유미기재'})</span>
                            </div>
                          );
                        }
                        if (sub) {
                          return (
                            <div key={inst} className="flex items-center gap-1">
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-1 py-0.5 rounded font-bold">
                                보결
                              </span>
                              <span className="font-bold text-[11px] text-amber-900">{sub.substituteInstructor}</span>
                              <OfficialSeal
                                name={sub.substituteInstructor || '강사'}
                                signatureUrl={getInstructorSeal(sub.substituteInstructor || '')}
                                size="sm"
                              />
                              <span className="text-[9px] text-slate-400 font-sans">(원: {inst})</span>
                            </div>
                          );
                        }
                        return (
                          <div key={inst} className="flex items-center gap-1.5">
                            <span className="font-bold text-[11px] text-slate-900">{inst}</span>
                            <OfficialSeal name={inst} signatureUrl={getInstructorSeal(inst)} size="sm" />
                            {!getInstructorSeal(inst) && onRequestSignature && (
                              <button
                                type="button"
                                onClick={() => onRequestSignature(inst, course.id)}
                                className="no-print text-[9px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1 py-0.5 rounded font-bold cursor-pointer transition"
                                title="도장/서명 등록"
                              >
                                서명 등록
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5 items-center justify-center text-slate-400 text-[11px]">
                      {daySubs.map((s) => (
                        <span key={s.id} className="text-amber-700 font-bold text-[10px]">
                          [{s.targetInstructor || '강사'} {s.isAbsence ? '결근' : `보결: ${s.substituteInstructor}`}]
                        </span>
                      ))}
                      <span>미출근 (체크 전)</span>
                    </div>
                  )}
                </td>
                {onManageSubstitute && (
                  <td className="border border-black px-1 py-1 no-print align-middle text-center">
                    <div className="flex flex-col gap-1 items-center justify-center">
                      {allCourseInstructors.map((inst) => {
                        const sub = daySubs.find((s) => !s.targetInstructor || s.targetInstructor === inst);
                        return (
                          <button
                            key={inst}
                            type="button"
                            onClick={() => onManageSubstitute(day, inst)}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition flex items-center justify-center gap-1 w-full max-w-[120px] cursor-pointer ${
                              sub
                                ? sub.isAbsence
                                  ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                  : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                            title={sub ? '보결/결근 정보 수정/삭제' : `${inst} 보결 등록 또는 결근 처리`}
                          >
                            <UserPlus className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span className="truncate">
                              {allCourseInstructors.length > 1 ? `${inst}: ` : ''}
                              {sub ? (sub.isAbsence ? '결근 수정' : '보결 수정') : '보결/결근'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* 인쇄 전용 스타일 태그 (A4 Portrait 단 1장 완벽 고정 & 결재란 왜곡 원천 차단) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .official-work-register-print-area,
          .official-work-register-print-area * {
            visibility: visible !important;
          }
          .official-work-register-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 p-4 md:p-6 space-y-4 my-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none">
        {/* 모달 상단 헤더 컨트롤 바 */}
        <div className="flex justify-between items-center border-b pb-3 no-print">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              공식 강사출근부 (A4 세로 표준 양식)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              실물 서명 규격(도장 1.5cm, 사인 2.0x1.5cm)과 표준 결재란이 A4 세로 1장에 맞춰 완벽히 인쇄됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow"
            >
              <Printer className="w-4 h-4" />
              출근부 인쇄
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 인쇄 대상 본문 */}
        {content}

        {/* 모달 하단 액션 푸터 (화면 전용, 인쇄 시 자동 숨김) */}
        {(onDeleteApprovalDoc || onClose) && (
          <div className="border-t border-slate-200 pt-3 flex justify-between items-center no-print">
            <div>
              {onDeleteApprovalDoc && (
                <button
                  type="button"
                  onClick={onDeleteApprovalDoc}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{deleteDocLabel}</span>
                </button>
              )}
            </div>
            <div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow cursor-pointer"
                >
                  확인 (닫기)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficialWorkRegister;
