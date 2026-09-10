'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

// 대한민국 학교 공식 붉은색 원형 직인/서명 컴포넌트
export const OfficialSeal: React.FC<{ name: string; signatureUrl?: string; size?: 'sm' | 'md' }> = ({
  name,
  signatureUrl,
  size = 'sm',
}) => {
  const isSm = size === 'sm';
  if (signatureUrl && (signatureUrl.startsWith('http') || signatureUrl.startsWith('data:') || signatureUrl.startsWith('/') || signatureUrl.length > 50)) {
    return (
      <img
        src={signatureUrl}
        alt={`${name} 서명`}
        className={`object-contain inline-block shrink-0 ${
          isSm ? 'max-w-[14mm] max-h-[10mm]' : 'max-w-[20mm] max-h-[14mm]'
        } w-auto h-auto`}
        style={{ maxWidth: isSm ? '14mm' : '20mm', maxHeight: isSm ? '10mm' : '14mm' }}
      />
    );
  }
  const char = name ? (name.length >= 3 ? name.slice(-2) : name) : '인';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-red-600 font-serif font-black text-red-600 select-none shrink-0 bg-red-50/50 leading-none shadow-2xs ${
        isSm
          ? 'w-[10.5mm] h-[10.5mm] min-w-[10.5mm] min-h-[10.5mm] text-[9px] border-[1.2px]'
          : 'w-[14mm] h-[14mm] min-w-[14mm] min-h-[14mm] text-[11px] border-[1.5px]'
      }`}
      style={{
        width: isSm ? '10.5mm' : '14mm',
        height: isSm ? '10.5mm' : '14mm',
        minWidth: isSm ? '10.5mm' : '14mm',
        minHeight: isSm ? '10.5mm' : '14mm',
        letterSpacing: '-0.06em',
      }}
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
    instructor5?: string;
    instructor6?: string;
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

// 2페이지 분리 기준 (30명 초과 시에만 2페이지 분리)
const MULTI_PAGE_THRESHOLD = 30;

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
    course.instructor5,
    course.instructor6,
    ...(course.assistantTeachers || []),
  ].filter((name): name is string => Boolean(name && name.trim() !== mainInstructor.trim()));

  const allInstructors = [mainInstructor, ...assistantInstructors].filter(Boolean);

  // 30명 초과인 경우에만 2페이지 모드 적용 (30명 이하는 무조건 1페이지 고정)
  const isMultiPage = students.length > MULTI_PAGE_THRESHOLD;

  // 페이지별 학생 분배
  // 30명 이하: [students] (단일 페이지 1장 고정)
  // 30명 초과: [students.slice(0, 30), students.slice(30)] (2장 고정)
  const pageStudentsList: AttendanceStudent[][] = isMultiPage
    ? [students.slice(0, 30), students.slice(30)]
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
    <div className="flex justify-end items-center gap-2 mb-1 mt-0.5 text-xs sm:text-sm font-bold text-black font-sans flex-wrap">
      <span className="font-extrabold whitespace-nowrap">지도교사:</span>
      <div className="flex items-center gap-2.5 flex-wrap">
        {allInstructors.map((name) => (
          <div key={name} className="flex items-center gap-1">
            <span className="font-black text-xs sm:text-sm">{name}</span>
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
        <th rowSpan={2} className="border border-black font-bold p-0.5 w-[34px] min-w-[34px] text-[10px] leading-tight text-center align-middle">일련<br />번호</th>
        <th rowSpan={2} className="border border-black font-bold p-0.5 w-[28px] min-w-[28px] text-[10px] text-center align-middle">학년</th>
        <th rowSpan={2} className="border border-black font-bold p-0.5 w-[28px] min-w-[28px] text-[10px] text-center align-middle">반</th>
        <th rowSpan={2} className="border border-black font-bold p-0.5 w-[56px] min-w-[56px] text-[10.5px] text-center align-middle whitespace-nowrap">성명</th>
        <th colSpan={scheduleDays.length} className="border border-black font-bold py-0.5 px-1 text-[11px] tracking-wider text-center">활동 시간 누가 기록</th>
      </tr>
      <tr className="bg-white">
        {scheduleDays.map((d) => {
          const shortDate = d.dateStr.replace(/\([가-힣]\)/g, '').replace(/^0/, '').replace(/\/0/, '/').trim();
          return (
            <th key={d.dayIndex} className="border border-black font-medium py-0.5 px-0.5 text-[9.5px] min-w-[20px] text-center whitespace-nowrap">
              {shortDate}
            </th>
          );
        })}
      </tr>
    </thead>
  );

  // 테이블 바디
  // 단일 페이지일 때:
  // - 18명 이하: 최소 18행 채움 (큼직하게 꽉 찬 1장)
  // - 19~30명: 학생 수 그대로 (빈 행 추가로 2페이지 넘치는 것 원천 차단!)
  // 2페이지일 때:
  // - 1페이지: 30행 고정
  // - 2페이지: 남은 학생 수 (최소 18행 채움)
  const renderTableBody = (pageStudents: AttendanceStudent[], rowOffset: number, rowHeightClass: string) => {
    let totalRows: number;
    if (isMultiPage) {
      totalRows = rowOffset === 0 ? 30 : Math.max(pageStudents.length, 18);
    } else {
      totalRows = students.length <= 18 ? 18 : students.length;
    }

    const rows = Array.from({ length: totalRows }, (_, i) => pageStudents[i] || null);
    return (
      <tbody>
        {rows.map((enr, idx) => {
          const rowNum = rowOffset + idx + 1;
          return (
            <tr key={enr?.id || `empty-${rowOffset}-${idx}`} className={`text-center ${rowHeightClass}`}>
              <td className="border border-black text-slate-800 text-[10px] font-normal align-middle">{rowNum}</td>
              <td className="border border-black text-slate-900 text-[10px] align-middle">{enr ? enr.grade : ''}</td>
              <td className="border border-black text-slate-900 text-[10px] align-middle">{enr ? enr.classNum : ''}</td>
              <td className="border border-black font-bold text-slate-950 text-[10px] align-middle whitespace-nowrap px-0.5">{enr ? enr.name : ''}</td>
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
                    className={`border border-black text-[10.5px] font-bold align-middle ${
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

  // 행 높이 및 폰트 크기 동적 산출:
  // - 2페이지(30행): h-[6.0mm] print:h-[5.8mm]
  // - 단일 페이지 <= 18명: h-[8.5mm] print:h-[8.2mm] (1페이지에 큼직하게 꽉 참)
  // - 단일 페이지 19~24명: h-[7.0mm] print:h-[6.8mm]
  // - 단일 페이지 25~30명: h-[5.9mm] print:h-[5.7mm] (절대 2페이지 안 넘침)
  const rowHeightClass = isMultiPage
    ? 'h-[6.0mm] print:h-[5.8mm]'
    : students.length <= 18
      ? 'h-[8.5mm] print:h-[8.2mm]'
      : students.length <= 24
        ? 'h-[7.0mm] print:h-[6.8mm]'
        : 'h-[5.9mm] print:h-[5.7mm]';

  // 제목 상단 패딩: 학생 수가 많으면 상단 패딩을 줄여 높이 확보
  const titlePaddingClass = (!isMultiPage && students.length <= 18)
    ? 'pt-[8mm] pb-0'
    : 'pt-[4mm] pb-0';

  if (!mounted) return null;

  const modalContent = (
    <div className="oas-modal-overlay fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* 인쇄 전용 스타일 — Portal로 body 직속 자식 → body>*:not(.oas-modal-overlay) 숨김으로 admin UI 레이아웃 공간 완전 제거 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
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
          /* admin UI 등 모달 외 모든 요소 레이아웃 공간까지 완전 제거 (11장 백지 방지) */
          body > *:not(.oas-modal-overlay) {
            display: none !important;
          }
          /* 모달 오버레이: position static 정상 흐름 */
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
            max-width: 194mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          /* 타입 1: 30명 이하 단일 페이지 (절대 2페이지 넘침 원천 차단) */
          .attendance-page-single {
            width: 100% !important;
            height: 280mm !important;
            max-height: 280mm !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          /* 타입 2: 30명 초과 2페이지 모드 (정확히 2장 분할) */
          .attendance-page-multi-first {
            width: 100% !important;
            height: 280mm !important;
            max-height: 280mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
          }
          .attendance-page-multi-second {
            width: 100% !important;
            height: 280mm !important;
            max-height: 280mm !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            box-sizing: border-box !important;
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
                ? `수강생 ${students.length}명 — 30명 초과로 1페이지(1~30번), 2페이지(31번~) 2장으로 분리 출력됩니다.`
                : `수강생 ${students.length}명 — A4 세로 1장으로 꽉 차게 출력됩니다.`}
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
            const rowOffset = pageIdx * 30;
            const blockClass = !isMultiPage
              ? 'attendance-page-single p-3 sm:p-5 print:p-0'
              : pageIdx === 0
                ? 'attendance-page-multi-first p-3 sm:p-5 print:p-0'
                : 'attendance-page-multi-second p-3 sm:p-5 print:p-0';

            return (
              <div key={pageIdx} className={blockClass}>
                {/* 화면 전용: 페이지 구분선 */}
                {isMultiPage && pageIdx > 0 && (
                  <div className="no-print border-t-4 border-dashed border-indigo-300 my-6 flex items-center justify-center">
                    <span className="bg-white px-3 text-xs text-indigo-500 font-bold">— 2페이지 —</span>
                  </div>
                )}

                {/* 제목 (가운데 정렬) */}
                <div className={`text-center ${titlePaddingClass}`}>
                  <h1 className="text-xl sm:text-2xl font-black tracking-wider text-black font-sans leading-tight">
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
