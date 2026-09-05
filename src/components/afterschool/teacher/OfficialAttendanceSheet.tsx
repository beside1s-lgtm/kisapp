'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';

// 대한민국 학교 공식 붉은색 원형 직인/서명 컴포넌트
// [사용자 요구사항]: 인쇄 시 도장은 지름 1.5cm의 원, 서명(사인)은 가로 2.0cm, 세로 1.5cm 이내 실물 규격 적용
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
        style={{
          maxWidth: '20mm',
          maxHeight: '15mm',
        }}
      />
    );
  }
  const char = name ? (name.length >= 3 ? name.slice(-2) : name) : '인';
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-red-600 font-serif font-black text-red-600 select-none shrink-0 bg-red-50/50 leading-none shadow-2xs w-[15mm] h-[15mm] min-w-[15mm] min-h-[15mm] text-[11px] border-[1.5px] print:w-[15mm] print:h-[15mm]"
      style={{
        width: '15mm',
        height: '15mm',
        minWidth: '15mm',
        minHeight: '15mm',
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

export const OfficialAttendanceSheet: React.FC<OfficialAttendanceSheetProps> = ({
  course,
  students,
  scheduleDays,
  getDayMark,
  getInstructorSeal,
  onRequestSignature,
  onClose,
}) => {
  const mainInstructor = course.instructorName || '강사';
  const assistantInstructors = [
    course.instructor2,
    course.instructor3,
    course.instructor4,
    ...(course.assistantTeachers || []),
  ].filter((name): name is string => Boolean(name && name.trim() !== mainInstructor.trim()));

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

  // 캡처 이미지(media_1788571419504.png) 규격: 최소 19행을 채워서 A4 세로 1장에 꽉 차고 안정적인 양식 구성
  // 학생 수에 따라 동적으로 행 높이를 조절하여 1장에 완벽히 수납되도록 보장
  const TOTAL_ROWS = Math.max(students.length, 19);
  const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => students[i] || null);
  const isCompact = students.length > 18;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 md:p-4 overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* 인쇄 전용 스타일 (A4 Portrait 세로 1장 완벽 맞춤 & 다중 페이지 복제 원천 차단) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .official-attendance-print-area,
          .official-attendance-print-area * {
            visibility: visible !important;
          }
          .official-attendance-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 190mm !important;
            max-height: 275mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: hidden !important;
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
        {/* 모달 헤더 컨트롤 바 (화면 전용, 인쇄 시 숨김) */}
        <div className="flex justify-between items-center border-b pb-3 no-print">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              공식 출석부 (A4 세로 단일 페이지 표준 양식)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              사용자 지정 표준 규격에 맞추어 A4 세로 1장으로 깔끔하게 출력됩니다.
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

        {/* 인쇄 대상 본문 (A4 세로 표준 서식) */}
        <div className="official-attendance-print-area bg-white p-4 md:p-6 print:p-0 border border-slate-300 print:border-none rounded-lg text-slate-950 font-sans">
          {/* 상단 중앙 타이틀 (캡처 이미지 형태와 일치) */}
          <div className="text-center pt-2 pb-4">
            <h1 className="text-2xl md:text-[26px] font-black tracking-wider text-black font-sans leading-tight">
              {course.title?.includes('출석부') ? course.title : `${course.title} 출석부`}
            </h1>
          </div>

          {/* 우측 상단 지도교사/보조강사 날인 영역 (표 바로 위 우측 정렬) */}
          <div className="flex justify-end items-center gap-4 mb-2 text-xs md:text-sm font-bold text-black font-sans">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm">지도교사:</span>
              <span className="font-black text-sm">{mainInstructor}</span>
              <div className="inline-flex items-center justify-center">
                <OfficialSeal
                  name={mainInstructor}
                  signatureUrl={getInstructorSeal(mainInstructor)}
                  size="sm"
                />
              </div>
              {!getInstructorSeal(mainInstructor) && onRequestSignature && (
                <button
                  type="button"
                  onClick={() => onRequestSignature(mainInstructor, course.id)}
                  className="no-print text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold cursor-pointer transition"
                  title="도장/서명 등록"
                >
                  서명 등록
                </button>
              )}
            </div>

            {assistantInstructors.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-normal">|</span>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">보조강사:</span>
                  {assistantInstructors.map((asst) => (
                    <div key={asst} className="flex items-center gap-1">
                      <span className="font-bold text-sm">{asst}</span>
                      <OfficialSeal
                        name={asst}
                        signatureUrl={getInstructorSeal(asst)}
                        size="sm"
                      />
                      {!getInstructorSeal(asst) && onRequestSignature && (
                        <button
                          type="button"
                          onClick={() => onRequestSignature(asst, course.id)}
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
            )}
          </div>

          {/* 출석부 본체 테이블 (캡처 이미지 표준 양식) */}
          <table className="w-full border-collapse border-2 border-black text-black text-xs font-sans text-center">
            <thead>
              <tr className="bg-slate-100">
                <th
                  rowSpan={2}
                  className="border border-black font-bold p-1 w-[36px] min-w-[36px] text-[11px] leading-tight text-center align-middle"
                >
                  일련<br />번호
                </th>
                <th
                  rowSpan={2}
                  className="border border-black font-bold p-1 w-[30px] min-w-[30px] text-[11px] text-center align-middle"
                >
                  학년
                </th>
                <th
                  rowSpan={2}
                  className="border border-black font-bold p-1 w-[30px] min-w-[30px] text-[11px] text-center align-middle"
                >
                  반
                </th>
                <th
                  rowSpan={2}
                  className="border border-black font-bold p-1 w-[60px] min-w-[60px] text-[11px] text-center align-middle whitespace-nowrap"
                >
                  성명
                </th>
                <th
                  colSpan={scheduleDays.length}
                  className="border border-black font-bold py-1 px-2 text-[12px] tracking-wider text-center"
                >
                  활동 시간 누가 기록
                </th>
              </tr>
              <tr className="bg-white">
                {scheduleDays.map((d) => {
                  const shortDate = d.dateStr.replace(/\([가-힣]\)/g, '').replace(/^0/, '').replace(/\/0/, '/').trim();
                  return (
                    <th
                      key={d.dayIndex}
                      className="border border-black font-medium py-1 px-0.5 text-[10px] min-w-[22px] text-center whitespace-nowrap"
                    >
                      {shortDate}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((enr, idx) => {
                return (
                  <tr
                    key={enr?.id || `empty-${idx}`}
                    className={`text-center ${isCompact ? 'h-[5.8mm] print:h-[5.6mm]' : 'h-[7.2mm] print:h-[7.0mm]'}`}
                  >
                    <td className="border border-black text-slate-800 text-[10.5px] font-normal align-middle">
                      {idx + 1}
                    </td>
                    <td className="border border-black text-slate-900 text-[10.5px] align-middle">
                      {enr ? enr.grade : ''}
                    </td>
                    <td className="border border-black text-slate-900 text-[10.5px] align-middle">
                      {enr ? enr.classNum : ''}
                    </td>
                    <td className="border border-black font-bold text-slate-950 text-[10.5px] align-middle whitespace-nowrap px-1">
                      {enr ? enr.name : ''}
                    </td>
                    {scheduleDays.map((d) => {
                      if (!enr) {
                        return <td key={d.dayIndex} className="border border-black align-middle">&nbsp;</td>;
                      }
                      const rawMark = getDayMark(enr.studentId, d.dayIndex);
                      const symbol = typeof rawMark === 'object' ? rawMark.symbol : rawMark;
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
          </table>
        </div>
      </div>
    </div>
  );
};
export default OfficialAttendanceSheet;
