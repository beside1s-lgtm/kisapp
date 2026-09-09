'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

// 대한민국 학교 공식 붉은색 원형 직인/서명 컴포넌트
export const OfficialSeal: React.FC<{ name: string; signatureUrl?: string; size?: 'sm' | 'md' }> = ({
  name,
  signatureUrl,
}) => {
  if (signatureUrl && (signatureUrl.startsWith('http') || signatureUrl.startsWith('data:') || signatureUrl.startsWith('/') || signatureUrl.length > 50)) {
    return (
      <img
        src={signatureUrl}
        alt={`${name} 서명`}
        className="object-contain inline-block shrink-0 max-w-[20mm] max-h-[15mm] w-auto h-auto print:max-w-[20mm] print:max-h-[15mm]"
        style={{ maxWidth: '20mm', maxHeight: '15mm' }}
      />
    );
  }
  const char = name ? (name.length >= 3 ? name.slice(-2) : name) : '인';
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-red-600 font-serif font-black text-red-600 select-none shrink-0 bg-red-50/50 leading-none shadow-2xs w-[15mm] h-[15mm] min-w-[15mm] min-h-[15mm] text-[11px] border-[1.5px] print:w-[15mm] print:h-[15mm]"
      style={{ width: '15mm', height: '15mm', minWidth: '15mm', minHeight: '15mm', letterSpacing: '-0.06em' }}
      title={`${name} 직인`}
    >
      {char}
    </span>
  );
};

export interface AttendanceStudent {
  id: string;
  studentId: string;
  name: string;
  grade: number | string;
  classNum: number | string;
  studentNum?: number | string;
  kisbusNo?: string;
  parentPhone?: string;
}

export interface AttendanceScheduleDay {
  dayIndex: number;
  dateStr: string;
  fullDate?: string;
}

export interface OfficialAttendanceSheetProps {
  course: {
    id: string;
    title: string;
    instructorName?: string;
    instructor2?: string;
    instructor3?: string;
    instructor4?: string;
    assistantTeachers?: string[];
    period?: string;
    startDate?: string;
    endDate?: string;
  };
  students: AttendanceStudent[];
  scheduleDays: AttendanceScheduleDay[];
  getDayMark: (studentId: string, dayIndex: number) => { symbol: string } | string;
  getInstructorSeal: (teacherName: string) => string | undefined;
  onRequestSignature?: (teacherName: string, courseId?: string) => void;
  onClose: () => void;
}

// 페이지당 최대 학생 수 (초과 시 2페이지 분리)
const ROWS_PER_PAGE = 30;
// 빈 행으로 채울 최소 행 수 (1페이지 단독)
const MIN_ROWS_SINGLE = 19;

export const OfficialAttendanceSheet: React.FC<OfficialAttendanceSheetProps> = ({
  course,
  students,
  scheduleDays,
  getDayMark,
  getInstructorSeal,
  onRequestSignature,
  onClose,
}) => {
  // Portal SSR 가드: 클라이언트 마운트 후에만 portal 렌더링
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const mainInstructor = course.instructorName || '강사';
  const assistantInstructors = [
    course.instructor2,
    course.instructor3,
    course.instructor4,
    ...(course.assistantTeachers || []),
  ].filter((name): name is string => Boolean(name && name.trim() !== mainInstructor.trim()));

  const allInstructors = [mainInstructor, ...assistantInstructors].filter(Boolean);
  const isMultiPage = students.length > ROWS_PER_PAGE;

  // 페이지별 학생 분배 (30명 이하 → 단일 페이지, 31명 이상 → 2페이지)
  const pageStudentsList: AttendanceStudent[][] = isMultiPage
    ? [students.slice(0, ROWS_PER_PAGE), students.slice(ROWS_PER_PAGE)]
    : [students];

  const handlePrint = () => {
    if (!getInstructorSeal(mainInstructor) && onRequestSignature) {
      if (confirm(`주강사 [${mainInstructor}] 선생님의 도장(서명)이 등록되지 않았습니다. 서명을 먼저 등록하시겠습니까?\n(취소 시 기본 원형 직인으로 인쇄됩니다)`)) {
        onRequestSignature(mainInstructor, course.id);
        return;
      }
    }
    window.print();
  };

  const courseTitle = course.title?.includes('출석부') ? course.title : `${course.title} 출석부`;

  // 지도교사 영역 — 우측 정렬, 이름 바로 옆 도장
  const renderInstructorArea = () => (
    <div className="flex justify-end items-center gap-2 mb-1 mt-1 text-sm font-bold text-black font-sans flex-wrap">
      <span className="font-extrabold whitespace-nowrap">지도교사:</span>
      <div className="flex items-center gap-3 flex-wrap">
        {allInstructors.map((name) => (
          <div key={name} className="flex items-center gap-1">
            <span className="font-black">{name}</span>
            <OfficialSeal
              name={name}
              signatureUrl={getInstructorSeal(name)}
              size="sm"
            />
            {!getInstructorSeal(name) && onRequestSignature && (
              <button
                type="button"
                onClick={() => onRequestSignature(name, course.id)}
                className="no-print text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold cursor-pointer transition"
                title="도장/서명 등록"
              >
                서명 등록
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // 테이블 헤더
  const renderTableHead = () => (
    <thead>
      <tr className="bg-slate-100">
        <th rowSpan={2} className="border border-black font-bold p-1 w-[36px] min-w-[36px] text-[11px] leading-tight text-center align-middle">일련<br />번호</th>
        <th rowSpan={2} className="border border-black font-bold p-1 w-[30px] min-w-[30px] text-[11px] text-center align-middle">학년</th>
        <th rowSpan={2} className="border border-black font-bold p-1 w-[30px] min-w-[30px] text-[11px] text-center align-middle">반</th>
        <th rowSpan={2} className="border border-black font-bold p-1 w-[60px] min-w-[60px] text-[11px] text-center align-middle whitespace-nowrap">성명</th>
        <th colSpan={scheduleDays.length} className="border border-black font-bold py-1 px-2 text-[12px] tracking-wider text-center">활동 시간 누가 기록</th>
      </tr>
      <tr className="bg-white">
        {scheduleDays.map((d) => {
          const shortDate = d.dateStr.replace(/\([가-힣]\)/g, '').replace(/^0/, '').replace(/\/0/, '/').trim();
          return (
            <th key={d.dayIndex} className="border border-black font-medium py-1 px-0.5 text-[10px] min-w-[22px] text-center whitespace-nowrap">
              {shortDate}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  // 테이블 바디 (rowOffset: 이전 페이지 행 수 → 일련번호 이어받기)
  const renderTableBody = (pageStudents: AttendanceStudent[], rowOffset: number, rowHeightClass: string) => {
    const minRows = isMultiPage ? ROWS_PER_PAGE : MIN_ROWS_SINGLE;
    const totalRows = Math.max(pageStudents.length, minRows);
    const rows = Array.from({ length: totalRows }, (_, i) => pageStudents[i] || null);
    return (
      <tbody>
        {rows.map((enr, idx) => {
          const rowNum = rowOffset + idx + 1;
          return (
            <tr key={enr?.id || `empty-${rowOffset}-${idx}`} className={`text-center ${rowHeightClass}`}>
              <td className="border border-black text-slate-800 text-[10.5px] font-normal align-middle">{rowNum}</td>
              <td className="border border-black text-slate-900 text-[10.5px] align-middle">{enr ? enr.grade : ''}</td>
              <td className="border border-black text-slate-900 text-[10.5px] align-middle">{enr ? enr.classNum : ''}</td>
              <td className="border border-black font-bold text-slate-950 text-[10.5px] align-middle whitespace-nowrap px-1">{enr ? enr.name : ''}</td>
              {scheduleDays.map((d) => {
                if (!enr) return <td key={d.dayIndex} className="border border-black align-middle">&nbsp;</td>;
                const rm = getDayMark(enr.studentId, d.dayIndex);
                const symbol = typeof rm === 'object' ? rm.symbol : rm;
                const isO = symbol === 'O' || symbol === '출석';
                const isTri = symbol === '△' || symbol === '지각' || symbol === '조퇴';
                const isX = symbol === '×' || symbol === 'X' || symbol === '결석';
                return (
                  <td
                    key={d.dayIndex}
                    className={`border border-black text-[11px] font-bold align-middle ${
                      isO ? 'text-black font-black' : isTri ? 'text-purple-700' : isX ? 'text-rose-600' : 'text-slate-300'
                    }`}
                  >
                    {isO ? 'O' : isTri ? '△' : isX ? '×' : (symbol && symbol !== '-' ? symbol : '')}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    );
  };

  // 행 높이: 2페이지(30행) h-[7.5mm] / 1페이지≤18 h-[7.2mm] / 1페이지 19~30 h-[6.0mm]
  const rowHeightClass = isMultiPage
    ? 'h-[7.5mm] print:h-[7.5mm]'
    : students.length > 18
      ? 'h-[6.0mm] print:h-[5.8mm]'
      : 'h-[7.2mm] print:h-[7.0mm]';

  if (!mounted) return null;

  const modalContent = (
    <div className="oas-modal-overlay fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* 인쇄 전용 스타일 — Portal로 body 직속 자식 → body>*:not(.oas-modal-overlay) 숨김으로 admin UI 레이아웃 공간 완전 제거 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* admin UI 등 모달 외 모든 요소 레이아웃 공간까지 완전 제거 */
          body > *:not(.oas-modal-overlay) {
            display: none !important;
          }
          /* 모달 오버레이: position static 정상 흐름 (page-break 활성화) */
          .oas-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* 모달 박스: 장식 제거 */
          .oas-modal-box {
            position: static !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 auto !important;
            max-width: none !important;
            width: 100% !important;
          }
          /* 인쇄 영역 */
          .official-attendance-print-area {
            position: static !important;
            width: 100% !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          /* 단일 페이지: 넘침 차단 */
          .attendance-page-single {
            max-height: 277mm !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* 멀티 페이지: 각 블록 1장씩 */
          .attendance-page-block {
            width: 100% !important;
            height: 277mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: always !important;
          }
          .attendance-page-block:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="oas-modal-box bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 p-4 md:p-6 space-y-4 my-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none">
        {/* 모달 헤더 (화면 전용) */}
        <div className="flex justify-between items-center border-b pb-3 no-print">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              공식 출석부 ({isMultiPage ? 'A4 세로 2페이지' : 'A4 세로 단일 페이지'} 표준 양식)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isMultiPage
                ? `수강생 ${students.length}명 — 30명씩 2페이지로 분리 출력됩니다.`
                : '사용자 지정 표준 규격에 맞추어 A4 세로 1장으로 깔끔하게 출력됩니다.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow"
            >
              <Printer className="w-4 h-4" />
              인쇄하기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 인쇄 대상 본문 */}
        <div className="official-attendance-print-area bg-white border border-slate-300 print:border-none rounded-lg text-slate-950 font-sans">
          {pageStudentsList.map((pageStudents, pageIdx) => {
            const rowOffset = pageIdx * ROWS_PER_PAGE;
            const blockClass = isMultiPage
              ? 'attendance-page-block p-4 md:p-6 print:p-0'
              : 'attendance-page-single p-4 md:p-6 print:p-0';
            return (
              <div key={pageIdx} className={blockClass}>
                {/* 화면 전용: 페이지 구분선 */}
                {isMultiPage && pageIdx > 0 && (
                  <div className="no-print border-t-4 border-dashed border-indigo-300 my-6 flex items-center justify-center">
                    <span className="bg-white px-3 text-xs text-indigo-500 font-bold">— 2페이지 —</span>
                  </div>
                )}

                {/* 제목 (가운데 정렬, 1cm 상단 여백) */}
                <div className="text-center pt-[10mm] pb-0">
                  <h1 className="text-2xl md:text-[26px] font-black tracking-wider text-black font-sans leading-tight">
                    {courseTitle}
                  </h1>
                </div>

                {/* 지도교사 (우측 정렬, 이름 옆 도장) */}
                {renderInstructorArea()}

                {/* 출석부 테이블 */}
                <table className="w-full border-collapse border-2 border-black text-black text-xs font-sans text-center">
                  {renderTableHead()}
                  {renderTableBody(pageStudents, rowOffset, rowHeightClass)}
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default OfficialAttendanceSheet;
