'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, X, Award, CheckCircle2, User, Sparkles } from 'lucide-react';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/pe/types';
import { buildPapsStudentReport, type PapsStudentReportData } from '@/lib/pe/papsReportCommentEngine';

interface PapsReportPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  initialGrade?: string;
  initialClassNum?: string;
}

export default function PapsReportPrintDialog({
  open,
  onOpenChange,
  allStudents,
  allItems,
  allRecords,
  initialGrade = 'all',
  initialClassNum = 'all',
}: PapsReportPrintDialogProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade);
  const [selectedClassNum, setSelectedClassNum] = useState<string>(initialClassNum);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  // 사용 가능한 학년 및 반 목록
  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [...new Set(allStudents.map(s => s.grade))].sort((a, b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach(grade => {
      classNumsByGrade[grade] = [
        ...new Set(allStudents.filter(s => s.grade === grade).map(s => s.classNum)),
      ].sort((a, b) => parseInt(a) - parseInt(b));
    });
    return { grades, classNumsByGrade };
  }, [allStudents]);

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return allStudents.filter(student => {
      if (selectedGrade !== 'all' && student.grade !== selectedGrade) return false;
      if (selectedClassNum !== 'all' && student.classNum !== selectedClassNum) return false;
      if (selectedStudentId !== 'all' && student.id !== selectedStudentId) return false;
      return true;
    }).sort((a, b) => {
      if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
      if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
      return parseInt(a.studentNum || '0') - parseInt(b.studentNum || '0');
    });
  }, [allStudents, selectedGrade, selectedClassNum, selectedStudentId]);

  // 학생별 리포트 데이터 생성
  const reportsData = useMemo<PapsStudentReportData[]>(() => {
    const currentYear = new Date().getFullYear().toString();
    return filteredStudents.map(student => {
      return buildPapsStudentReport(student, allItems, allRecords, currentYear);
    });
  }, [filteredStudents, allItems, allRecords]);

  // 학년/반 변경 시 학생 선택 리셋
  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    setSelectedClassNum('all');
    setSelectedStudentId('all');
  };

  const handleClassChange = (classNum: string) => {
    setSelectedClassNum(classNum);
    setSelectedStudentId('all');
  };

  // 선택된 그룹/학생 기준 PDF 저장 파일명 (document.title) 생성
  const getPrintTitle = () => {
    if (selectedStudentId !== 'all') {
      const student = filteredStudents.find(s => s.id === selectedStudentId);
      if (student) {
        return `${student.grade}학년_${student.classNum}반_${student.name}_맞춤형체력평가보고서`;
      }
    }
    if (selectedGrade !== 'all' && selectedClassNum !== 'all') {
      return `${selectedGrade}학년_${selectedClassNum}반_맞춤형체력평가보고서`;
    }
    if (selectedGrade !== 'all') {
      return `${selectedGrade}학년_맞춤형체력평가보고서`;
    }
    return '맞춤형체력평가보고서';
  };

  const printContainerRef = useRef<HTMLDivElement>(null);

  // 부모 페이지 간섭 및 백지 여러 장 출력을 원천 차단하는 독립 팝업 인쇄
  const handlePrint = () => {
    const printContainer = printContainerRef.current;
    if (!printContainer || reportsData.length === 0) return;

    const printTitle = getPrintTitle();

    // 현재 문서의 Tailwind 및 전역 스타일시트 태그 수집
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    const printHtml = printContainer.innerHTML;

    // 독립 팝업 창 생성 (부모 페이지 레이아웃 및 14페이지 테이블 간섭 0% 차단)
    const printWin = window.open('', '_blank', 'width=900,height=1000');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <title>${printTitle}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Roboto, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .paps-sheet-page {
              width: 210mm !important;
              height: 297mm !important;
              max-height: 297mm !important;
              margin: 0 auto !important;
              padding: 10mm 13mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }
            .paps-sheet-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            @media screen {
              body {
                background: #f1f5f9 !important;
                padding: 16px 0;
              }
              .paps-sheet-page {
                box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                margin-bottom: 20px !important;
              }
            }
          </style>
        </head>
        <body>
          ${printHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    } else {
      // 팝업 차단 환경 Fallback
      const prevTitle = document.title;
      document.title = printTitle;
      window.print();
      setTimeout(() => {
        document.title = prevTitle;
      }, 1000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] p-0 flex flex-col overflow-hidden bg-slate-100">
        {/* 상단 컨트롤러 (인쇄 시 숨김 - 우측 닫기(X) 버튼과 겹치지 않도록 pr-14 안전 여백 부여) */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 pr-14 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold text-slate-900">
                PAPS 학생 맞춤형 체력평가 보고서
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                총 {reportsData.length}명의 학생 맞춤형 체력평가 보고서가 A4 1인 1장 규격으로 준비되었습니다.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 학년 선택 */}
            <Select value={selectedGrade} onValueChange={handleGradeChange}>
              <SelectTrigger className="w-[85px] h-8 text-xs font-semibold">
                <SelectValue placeholder="학년" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학년</SelectItem>
                {grades.map(g => (
                  <SelectItem key={g} value={g}>{g}학년</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 반 선택 */}
            <Select
              value={selectedClassNum}
              onValueChange={handleClassChange}
              disabled={selectedGrade === 'all'}
            >
              <SelectTrigger className="w-[80px] h-8 text-xs font-semibold">
                <SelectValue placeholder="반" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 반</SelectItem>
                {selectedGrade !== 'all' && classNumsByGrade[selectedGrade]?.map(c => (
                  <SelectItem key={c} value={c}>{c}반</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 개별 학생 선택 */}
            <Select
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
              disabled={selectedGrade === 'all' || selectedClassNum === 'all'}
            >
              <SelectTrigger className="w-[110px] h-8 text-xs font-semibold">
                <SelectValue placeholder="학생 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">학급 전체 ({filteredStudents.length}명)</SelectItem>
                {filteredStudents.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.studentNum}번 {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 인쇄 버튼 */}
            <Button
              onClick={handlePrint}
              disabled={reportsData.length === 0}
              className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              보고서 인쇄 ({reportsData.length}장)
            </Button>
          </div>
        </div>

        {/* 인쇄 미리보기 컨테이너 */}
        <div ref={printContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
          {reportsData.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <User className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold">조회된 학생 데이터가 없습니다.</p>
              <p className="text-xs text-slate-400 mt-1">학년 및 반 필터를 조정해 보세요.</p>
            </div>
          ) : (
            reportsData.map((report, idx) => (
              <SingleStudentPapsSheet
                key={report.student.id || idx}
                report={report}
                isLast={idx === reportsData.length - 1}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 개별 학생 PAPS 맞춤형 체력평가 보고서 A4 1페이지 서식
 */
function SingleStudentPapsSheet({ report, isLast }: { report: PapsStudentReportData; isLast: boolean }) {
  const { student, academicYear, evaluations, totalScore, finalGrade, measuredDate } = report;

  return (
    <div
      className={`paps-sheet-page bg-white text-slate-900 mx-auto w-full max-w-[210mm] border border-slate-300 shadow-lg p-[10mm] sm:p-[12mm] flex flex-col justify-between overflow-hidden ${
        !isLast ? 'break-after-page' : ''
      }`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        maxHeight: '297mm',
        pageBreakAfter: isLast ? 'auto' : 'always',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. 상단 타이틀 및 학교 정보 */}
      <div>
        <div className="text-center border-b-2 border-slate-900 pb-2.5 mb-3.5">
          <p className="text-xs font-bold text-slate-500 tracking-wider">
            {academicYear}학년도 학생 건강체력평가(PAPS)
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900 mt-1">
            맞 춤 형  체 력  평 가  보 고 서
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            호치민시한국국제학교 (KOREAN INTERNATIONAL SCHOOL HCMC)
          </p>
        </div>

        {/* 2. 학생 인적사항 테이블 */}
        <table
          className="w-full border-collapse border border-slate-900 text-xs mb-4"
          style={{ border: '1px solid #0f172a', borderCollapse: 'collapse' }}
        >
          <tbody>
            <tr className="h-8 bg-slate-50">
              <th className="border border-slate-900 w-[15%] text-center font-bold text-slate-700 bg-slate-100">
                학 년
              </th>
              <td className="border border-slate-900 w-[18%] text-center font-semibold">
                {student.grade}학년
              </td>
              <th className="border border-slate-900 w-[15%] text-center font-bold text-slate-700 bg-slate-100">
                반 / 번호
              </th>
              <td className="border border-slate-900 w-[18%] text-center font-semibold">
                {student.classNum}반 {student.studentNum ? `${student.studentNum}번` : '-'}
              </td>
              <th className="border border-slate-900 w-[15%] text-center font-bold text-slate-700 bg-slate-100">
                성 명 / 성별
              </th>
              <td className="border border-slate-900 w-[19%] text-center font-bold text-slate-900">
                {student.name} ({student.gender || '남'})
              </td>
            </tr>
            <tr className="h-8">
              <th className="border border-slate-900 text-center font-bold text-slate-700 bg-slate-100">
                측정 기준일
              </th>
              <td className="border border-slate-900 text-center font-medium">
                {measuredDate}
              </td>
              <th className="border border-slate-900 text-center font-bold text-slate-700 bg-slate-100">
                종합 체력 점수
              </th>
              <td className="border border-slate-900 text-center font-bold text-indigo-700">
                {totalScore}점 / 20점
              </td>
              <th className="border border-slate-900 text-center font-bold text-slate-700 bg-slate-100">
                종합 체력 등급
              </th>
              <td className="border border-slate-900 text-center font-black text-sm text-indigo-900 bg-indigo-50/50">
                {finalGrade}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. 5대 체력 요인별 측정 결과 테이블 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
              <span className="w-1.5 h-3 bg-indigo-600 rounded-xs inline-block"></span>
              PAPS 5대 체력 요인별 측정 결과 및 등급
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">※ 1~2등급: 우수, 3등급: 보통, 4~5등급: 향상 권장</span>
          </div>

          <table
            className="w-full border-collapse border border-slate-900 text-xs text-center"
            style={{ border: '1px solid #0f172a', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr className="bg-slate-100 h-8 text-slate-800 font-bold border-b border-slate-900">
                <th className="border border-slate-900 w-[22%]">체력 요인</th>
                <th className="border border-slate-900 w-[28%]">측정 종목</th>
                <th className="border border-slate-900 w-[22%]">측정 기록</th>
                <th className="border border-slate-900 w-[14%]">요인 등급</th>
                <th className="border border-slate-900 w-[14%]">환산 배점</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev, idx) => (
                <tr key={idx} className="h-7 hover:bg-slate-50/50">
                  <td className="border border-slate-900 font-bold text-slate-700 bg-slate-50/40">
                    {ev.factor}
                  </td>
                  <td className="border border-slate-900 text-slate-800 font-medium">
                    {ev.itemName}
                  </td>
                  <td className="border border-slate-900 font-semibold text-slate-900">
                    {ev.value > 0 ? `${ev.value} ${ev.unit}` : '-'}
                  </td>
                  <td className="border border-slate-900 font-bold">
                    {ev.grade > 0 ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                          ev.grade <= 2
                            ? 'bg-blue-100 text-blue-800'
                            : ev.grade === 3
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {ev.grade}등급
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="border border-slate-900 font-bold text-slate-700">
                    {ev.score > 0 ? `${ev.score}점` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. 맞춤형 신체활동 처방 및 종합 소견 */}
        <div className="space-y-2.5 mb-4">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
            <span className="w-1.5 h-3 bg-indigo-600 rounded-xs inline-block"></span>
            학생 맞춤형 건강체력 분석 및 신체활동 처방
          </h3>

          {/* 영역 1: 종합 등급별 총평 */}
          <div className="border border-slate-800 rounded p-2.5 bg-slate-50/70">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>[종합 체력 총평]</span>
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                {finalGrade} 수준
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700 text-justify pl-5">
              {report.overallComment}
            </p>
          </div>

          {/* 영역 2: 최고 성취 요인 칭찬 */}
          <div className="border border-slate-800 rounded p-2.5 bg-blue-50/40">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 mb-1">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>[최고 성취 역량 격려]</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700 text-justify pl-5">
              {report.strengthPraise}
            </p>
          </div>

          {/* 영역 3-1 & 3-2: 2단 배치 (우수 요인 심화 처방 & 취약 요인 놀이형 개선) */}
          <div className="grid grid-cols-2 gap-2">
            {/* 우수 요인 심화 */}
            <div className="border border-slate-800 rounded p-2.5 bg-emerald-50/30 flex flex-col">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">[우수 요인 심화 스포츠 추천]</span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-slate-700 text-justify pl-5 flex-1">
                {report.advancedSportsGuide}
              </p>
            </div>

            {/* 취약 요인 놀이형 개선 */}
            <div className="border border-slate-800 rounded p-2.5 bg-amber-50/30 flex flex-col">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">[취약 요인 놀이·게임형 처방]</span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-slate-700 text-justify pl-5 flex-1">
                {report.playfulImprovementGuide}
              </p>
            </div>
          </div>

          {/* 영역 4: 체질량지수(BMI) 및 생활 습관 */}
          <div className="border border-slate-800 rounded p-2.5 bg-slate-50/70">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block ml-1 mr-0.5"></span>
              <span>[체형 및 건강 생활 습관 가이드]</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700 text-justify pl-5">
              {report.bmiHealthGuide}
            </p>
          </div>
        </div>
      </div>

      {/* 5. 하단 날짜, 안내 및 학교장 직인란 */}
      <div className="pt-2 border-t border-slate-300 mt-2">
        <p className="text-[10px] text-slate-500 text-center leading-normal mb-3">
          본 보고서는 교육부 학생건강체력평가(PAPS) 기준에 따라 학생의 신체 능력과 체형 발달 상태를 진단한 결과입니다.<br />
          가정에서도 학생이 규칙적인 운동과 올바른 식습관을 형성할 수 있도록 따뜻한 관심과 격려를 부탁드립니다.
        </p>

        <div className="flex items-center justify-between px-6">
          <div className="text-xs font-bold text-slate-600">
            발행일자: {measuredDate}
          </div>

          <div className="text-right">
            <span className="text-sm font-black tracking-widest text-slate-900">
              호치민시한국국제학교
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
