'use client';

import React from 'react';
import { Printer, X, Trash2 } from 'lucide-react';
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
    instructor5?: string;
    instructor6?: string;
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

// 출근부 전용 컴팩트 서명/도장 렌더러 (이름 텍스트 없이 도장/서명 이미지만 단독 렌더링, 150% 가독성 최적화)
const WorkRegisterSeal: React.FC<{
  name: string;
  signatureUrl?: string;
  courseId?: string;
  onRequestSignature?: (name: string, courseId?: string) => void;
}> = ({ name, signatureUrl, courseId, onRequestSignature }) => {
  if (
    signatureUrl &&
    (signatureUrl.startsWith('http') ||
      signatureUrl.startsWith('data:') ||
      signatureUrl.startsWith('/') ||
      signatureUrl.length > 50)
  ) {
    return (
      <img
        src={signatureUrl}
        alt="서명"
        className="object-contain inline-block shrink-0 w-auto h-auto"
        style={{
          maxWidth: '12mm',
          maxHeight: '11mm',
        }}
        title={`${name} 서명`}
      />
    );
  }

  // 등록된 서명이 없는 경우: 원형 직인만 표시하고, 클릭 시 서명 등록 모달 호출
  const char = name ? (name.length >= 3 ? name.slice(-2) : name) : '인';
  return (
    <button
      type="button"
      onClick={() => onRequestSignature?.(name, courseId)}
      className="inline-flex items-center justify-center rounded-full border border-red-600 font-serif font-black text-red-600 select-none shrink-0 bg-red-50/50 leading-none shadow-2xs text-[11px] border-[1.5px] cursor-pointer hover:scale-105 transition-transform"
      style={{
        width: '11mm',
        height: '11mm',
        minWidth: '11mm',
        minHeight: '11mm',
        letterSpacing: '-0.06em',
      }}
      title={`${name} 직인 (클릭하여 서명/도장 변경)`}
    >
      {char}
    </button>
  );
};

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
  yearSemesterText = '2026학년도 2학기 방과후학교',
}) => {
  const mainInstructor = course.instructorName || '강사';
  const assistantInstructors = [
    course.instructor2,
    course.instructor3,
    course.instructor4,
    course.instructor5,
    course.instructor6,
    ...(course.assistantTeachers || []),
  ].filter((name): name is string => Boolean(name && name.trim() !== mainInstructor.trim()));

  const allCourseInstructors = [mainInstructor, ...assistantInstructors];

  // 강의시간 표기 파싱 (예: 15:00 ~ 16:30 (8~9차시) -> 8-9교시)
  let displayClassTime = course.classTime || '';
  const matchPeriod = displayClassTime.match(/(\d+)\s*[~-]\s*(\d+)\s*[차교]시?/);
  if (matchPeriod) {
    displayClassTime = `${matchPeriod[1]}-${matchPeriod[2]}교시`;
  } else if (!displayClassTime) {
    displayClassTime = '8-9교시';
  }

  // 강사 표기 (주강사, 보조강사 구분 없이 쉼표로 연결: 예: 강지욱, 김태현)
  const displayTeacherName = allCourseInstructors.join(', ');

  // 강좌명 표기 (스케줄 요일 자동 추출하여 예: KIS 배구부 (월, 수) 형태로 표기)
  const extractedDays = Array.from(
    new Set(
      scheduleDays
        .map((d) => {
          const m = d.dateStr.match(/\(([월화수목금토일])\)/);
          return m ? m[1] : null;
        })
        .filter((d): d is string => Boolean(d))
    )
  );
  const daySuffix =
    extractedDays.length > 0 && !course.title.includes('(') ? ` (${extractedDays.join(', ')})` : '';
  const displayCourseTitle = `${course.title}${daySuffix}`;

  // 행 수 결정 (주 2회 양식: 기본 10행 고정, 20회차 초과 시 유연 확장)
  const rowCount = Math.max(10, Math.ceil(scheduleDays.length / 2));

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
    const prevTitle = document.title;
    document.title = `${displayCourseTitle} 출근부`;
    window.print();
    document.title = prevTitle;
  };

  // 단일 차시 셀/데이터 렌더링 헬퍼 (표 안 글씨 150% 확대: 11px -> 16px)
  const renderCellSet = (idx: number) => {
    const day = scheduleDays[idx];
    const sessionLabel = day
      ? `${day.startSessionNo || idx * 2 + 1}-${day.endSessionNo || idx * 2 + 2}`
      : `${idx * 2 + 1}-${idx * 2 + 2}`;

    if (!day) {
      return (
        <React.Fragment key={`empty-${idx}`}>
          <td
            className="font-mono text-[13px] font-bold text-slate-900 text-center py-1 px-1 align-middle bg-slate-50/20"
            style={{ border: '1px solid #000000', width: '9%' }}
          >
            {sessionLabel}
          </td>
          <td
            className="text-center py-1 px-1 align-middle"
            style={{ border: '1px solid #000000', width: '13%' }}
          ></td>
          <td
            className="text-center py-1 px-1 align-middle"
            style={{ border: '1px solid #000000', width: '28%' }}
          ></td>
        </React.Fragment>
      );
    }

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

    // 날짜 텍스트 (공백 없이 정갈하게 예: 09/07(월))
    const formattedDate = day.dateStr.replace(/\s+/g, '');

    return (
      <React.Fragment key={day.dayIndex}>
        {/* 차시 칸 */}
        <td
          className="font-mono text-[13px] font-bold text-slate-900 text-center py-1 px-1 align-middle bg-slate-50/40"
          style={{ border: '1px solid #000000', width: '9%' }}
        >
          {sessionLabel}
        </td>

        {/* 날짜 칸 */}
        <td
          className="group relative font-mono text-[13px] font-bold text-slate-900 text-center py-1 px-1 align-middle"
          style={{ border: '1px solid #000000', width: '13%' }}
        >
          <div>{formattedDate}</div>
          {daySubs.map((s) => (
            <div key={s.id} className="text-[12px] text-amber-800 font-sans font-medium mt-0.5 leading-tight">
              {s.isAbsence ? '결근' : `보결(${s.substituteInstructor})`}
            </div>
          ))}
          {onManageSubstitute && (
            <button
              type="button"
              onClick={() => onManageSubstitute(day)}
              className="no-print opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2 text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.5 rounded cursor-pointer"
              title="보결/결근 관리"
            >
              보결
            </button>
          )}
        </td>

        {/* 서명 칸 — 4명까지 한 줄에 배치 */}
        <td
          className="text-center py-1 px-1 align-middle"
          style={{ border: '1px solid #000000', width: '28%' }}
        >
          {hasChecked ? (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {allCourseInstructors.map((inst) => {
                const sub = daySubs.find((s) => !s.targetInstructor || s.targetInstructor === inst);
                if (sub?.isAbsence) {
                  return (
                    <span
                      key={inst}
                      className="text-[12px] bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded font-bold"
                    >
                      결근
                    </span>
                  );
                }
                if (sub) {
                  return (
                    <WorkRegisterSeal
                      key={inst}
                      name={sub.substituteInstructor || '보결'}
                      signatureUrl={getInstructorSeal(sub.substituteInstructor || '')}
                      courseId={course.id}
                      onRequestSignature={onRequestSignature}
                    />
                  );
                }
                return (
                  <WorkRegisterSeal
                    key={inst}
                    name={inst}
                    signatureUrl={getInstructorSeal(inst)}
                    courseId={course.id}
                    onRequestSignature={onRequestSignature}
                  />
                );
              })}
            </div>
          ) : (
            // 미출근/체크 전 회차는 첨부 양식처럼 깨끗하게 빈칸
            <div className="w-full h-full min-h-[18px]"></div>
          )}
        </td>
      </React.Fragment>
    );
  };

  // 인라인 뷰인 경우 print:hidden으로 인쇄 시 출력에서 완전히 제외하여 중복 겹침 원천 차단
  const content = (
    <div
      className={`${
        isModal ? 'official-work-register-modal-print' : 'no-print print:hidden'
      } bg-white p-4 md:p-6 print:p-0 print:pt-[10mm] border border-slate-300 print:border-none rounded-lg text-slate-950 font-sans`}
      style={{
        paddingTop: isModal ? '10mm' : undefined,
      }}
    >
      {/* ─── 상단 학년도/학기 & 결재란 (상단 1cm 여백 완벽 확보) ─── */}
      <div className="flex justify-between items-start mb-1">
        {/* 표 밖 텍스트: 기존 크기 유지 */}
        <div className="text-xs font-bold text-slate-800 tracking-tight pt-1">
          {yearSemesterText}
        </div>

        {/* 우측 상단 결재란 (표 안 글씨 150% 확대: 11px -> 16px) */}
        <div className="shrink-0">
          <table
            className="border-collapse text-center font-sans"
            style={{ border: '1px solid #000000', borderCollapse: 'collapse' }}
          >
            <tbody>
              <tr>
                <td
                  rowSpan={2}
                  className="bg-slate-100 font-bold text-[14px] leading-tight px-2 py-1 align-middle text-center"
                  style={{ border: '1px solid #000000', width: '26px' }}
                >
                  결<br />재
                </td>
                <td
                  className="bg-slate-50 font-bold py-1 text-[15px] text-center"
                  style={{ border: '1px solid #000000', width: '60px', minWidth: '60px' }}
                >
                  부장
                </td>
                <td
                  className="bg-slate-50 font-bold py-1 text-[15px] text-center"
                  style={{ border: '1px solid #000000', width: '60px', minWidth: '60px' }}
                >
                  교감
                </td>
              </tr>
              <tr style={{ height: '50px' }}>
                <td
                  className="p-0.5 align-middle text-center"
                  style={{ border: '1px solid #000000', width: '60px', height: '50px' }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {isManagerApproved ? (
                      <OfficialSeal name="부장" signatureUrl={managerSignature} size="md" />
                    ) : (
                      <span className="text-slate-300 print:hidden">-</span>
                    )}
                  </div>
                </td>
                <td
                  className="p-0.5 align-middle text-center"
                  style={{ border: '1px solid #000000', width: '60px', height: '50px' }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {isVicePrincipalApproved ? (
                      <OfficialSeal name="교감" signatureUrl={vicePrincipalSignature} size="md" />
                    ) : (
                      <span className="text-slate-300 print:hidden">-</span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 중앙 메인 타이틀 (표 밖 텍스트: 기존 크기 유지) ─── */}
      <div className="text-center -mt-4 mb-3">
        <h1 className="text-2xl font-black text-slate-950 font-sans tracking-tight inline-flex items-baseline gap-2.5">
          <span className="text-2xl md:text-[26px]">강사출근부</span>
          <span className="text-lg md:text-xl font-bold text-slate-800 font-sans">Teacher&apos;s attendance</span>
        </h1>
      </div>

      {/* ─── 메타 정보 표 (표 안 글씨 150% 확대: 11px/12px -> 15px/17px) ─── */}
      <table
        className="w-full border-collapse font-sans mb-2"
        style={{ border: '1px solid #000000', borderCollapse: 'collapse' }}
      >
        <tbody>
          <tr style={{ height: '40px' }}>
            <th
              className="bg-slate-50 font-bold text-[15px] text-center leading-tight py-1 px-2"
              style={{ border: '1px solid #000000', width: '15%' }}
            >
              강의시간<br />
              <span className="text-[13px] font-normal text-slate-600">Time</span>
            </th>
            <td
              className="text-center font-bold text-[17px] text-slate-900 py-1 px-2"
              style={{ border: '1px solid #000000', width: '35%' }}
            >
              {displayClassTime}
            </td>
            <th
              className="bg-slate-50 font-bold text-[15px] text-center leading-tight py-1 px-2"
              style={{ border: '1px solid #000000', width: '15%' }}
            >
              강사<br />
              <span className="text-[13px] font-normal text-slate-600">Teacher</span>
            </th>
            <td
              className="text-center font-bold text-[17px] text-slate-900 py-1 px-2"
              style={{ border: '1px solid #000000', width: '35%' }}
            >
              {allCourseInstructors.length >= 4 ? (
                <div className="leading-snug">
                  <div>{allCourseInstructors.slice(0, 2).join(', ')}</div>
                  <div>{allCourseInstructors.slice(2).join(', ')}</div>
                </div>
              ) : (
                displayTeacherName
              )}
            </td>
          </tr>
          <tr style={{ height: '40px' }}>
            <th
              className="bg-slate-50 font-bold text-[15px] text-center leading-tight py-1 px-2"
              style={{ border: '1px solid #000000', width: '15%' }}
            >
              강좌명<br />
              <span className="text-[13px] font-normal text-slate-600">Class</span>
            </th>
            <td
              colSpan={3}
              className="text-center font-bold text-[18px] text-slate-950 py-1 px-3"
              style={{ border: '1px solid #000000' }}
            >
              {displayCourseTitle}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ─── 본문 출근부 테이블 (주 2회 양식: 표 안 글씨 150% 확대: 11px -> 16px) ─── */}
      <table
        className="w-full border-collapse text-center font-sans"
        style={{ border: '1px solid #000000', borderCollapse: 'collapse' }}
      >
        <thead>
          <tr className="bg-slate-50 font-bold" style={{ height: '42px' }}>
            {/* 좌측 3열 */}
            <th
              className="text-center text-[14px] leading-tight py-1 px-1"
              style={{ border: '1px solid #000000', width: '9%' }}
            >
              차시<br />
              <span className="text-[11px] font-normal text-slate-600">Period</span>
            </th>
            <th
              className="text-center text-[14px] leading-tight py-1 px-1"
              style={{ border: '1px solid #000000', width: '13%' }}
            >
              날짜<br />
              <span className="text-[11px] font-normal text-slate-600">Date</span>
            </th>
            <th
              className="text-center text-[14px] leading-tight py-1 px-1"
              style={{ border: '1px solid #000000', width: '28%' }}
            >
              서명<br />
              <span className="text-[11px] font-normal text-slate-600">Sign</span>
            </th>

            {/* 우측 3열 */}
            <th
              className="text-center text-[14px] leading-tight py-1 px-1"
              style={{ border: '1px solid #000000', width: '9%' }}
            >
              차시<br />
              <span className="text-[11px] font-normal text-slate-600">Period</span>
            </th>
            <th
              className="text-center text-[14px] leading-tight py-1 px-1"
              style={{ border: '1px solid #000000', width: '13%' }}
            >
              날짜<br />
              <span className="text-[11px] font-normal text-slate-600">Date</span>
            </th>
            <th
              className="text-center text-[14px] leading-tight py-1 px-1"
              style={{ border: '1px solid #000000', width: '28%' }}
            >
              서명<br />
              <span className="text-[11px] font-normal text-slate-600">Sign</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rIndex) => {
            const leftIdx = rIndex;
            const rightIdx = rIndex + rowCount;

            return (
              <tr
                key={rIndex}
                className="hover:bg-slate-50/50"
                style={{ height: '44px', minHeight: '44px' }}
              >
                {/* 좌측 3열 (1~10회차) */}
                {renderCellSet(leftIdx)}

                {/* 우측 3열 (11~20회차) */}
                {renderCellSet(rightIdx)}
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
      {/* 인쇄 전용 스타일 태그 (상단 1cm 여백 완벽 확보 & 오직 모달 출력 영역만 단독으로 렌더링) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 10mm 10mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .official-work-register-modal-print,
          .official-work-register-modal-print * {
            visibility: visible !important;
          }
          .official-work-register-modal-print {
            position: fixed !important;
            top: 10mm !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            padding-top: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
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
              공식 강사출근부 (A4 세로 1장 표준 양식)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              주 2회 20회차(40차시) 전 회차가 A4 세로 1장에 깔끔하게 수납되어 인쇄됩니다.
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

        {/* 인쇄 대상 본문 (모달 전용 단독 렌더링) */}
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
