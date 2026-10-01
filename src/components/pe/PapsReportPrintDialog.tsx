'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, X, Award, CheckCircle2, User, Sparkles } from 'lucide-react';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/pe/types';
import { buildPapsStudentReport, type PapsStudentReportData, type PapsFactorEvaluation } from '@/lib/pe/papsReportCommentEngine';
import { getDocConfig, onDocConfigUpdate } from '@/lib/services/settingsService';

type PapsFactorEval = PapsFactorEvaluation;

interface PapsReportPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  initialGrade?: string;
  initialClassNum?: string;
}

/**
 * GloNaCal 맞춤형 체육 성장 리포트 전용 인라인 CSS (모달 미리보기 및 팝업 인쇄 공유)
 */
export const PAPS_REPORT_STYLES = `
  :root {
    --gold: #C7972A;
    --gold-deep: #A87618;
    --blue: #1C6FB5;
    --red: #C32B39;
    --ink: #272320;
    --ink-soft: #5B554C;
    --paper: #F7F4EC;
    --paper-card: #FFFFFF;
    --line: #E1DACB;
    --line-strong: #DDD5BF;
  }
  .paps-sheet-page {
    width: 210mm !important;
    min-width: 210mm !important;
    max-width: 210mm !important;
    height: 297mm !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 auto !important;
    padding: 9mm 12mm 7mm 12mm !important;
    box-sizing: border-box !important;
    page-break-after: always !important;
    break-after: page !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    overflow: hidden !important;
    background: #ffffff !important;
    position: relative !important;
    flex-shrink: 0 !important;
  }
  .paps-sheet-page:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  .sheet-band {
    height: 5px;
    border-radius: 2px;
    background: linear-gradient(90deg, #1C6FB5 0 33.3%, #C7972A 33.3% 66.6%, #C32B39 66.6% 100%);
    margin-bottom: 8px;
  }
  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
    border-bottom: 1.2px solid #E1DACB;
    padding-bottom: 6px;
  }
  .school-name {
    font-size: 11px;
    font-weight: 700;
    color: #A87618;
    letter-spacing: 0.5px;
  }
  .doc-title {
    font-size: 19px;
    font-weight: 900;
    color: #272320;
    margin: 2px 0 6px 0;
    letter-spacing: 0.5px;
  }
  .meta-table {
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: #272320;
  }
  .mt-label {
    color: #5B554C;
    font-weight: 500;
    margin-right: 4px;
  }
  .mt-value {
    font-weight: 700;
  }
  .stamp img {
    height: 38px;
    object-fit: contain;
  }
  .section {
    margin-bottom: 8px;
  }
  .section-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }
  .sec-no {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: #272320;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .sec-title {
    font-size: 12.5px;
    font-weight: 800;
    color: #272320;
  }
  .sec-en {
    font-size: 9.5px;
    color: #5B554C;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tri-wrap {
    display: flex;
    gap: 14px;
    align-items: center;
    background: #FCFBF6;
    border: 1px solid #E1DACB;
    border-radius: 10px;
    padding: 8px 12px;
  }
  .tri-left-box {
    width: 175px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .tri-svg-box {
    width: 100%;
  }
  .tri-caption {
    font-size: 8.5px;
    color: #5B554C;
    text-align: center;
    margin-top: 2px;
    line-height: 1.35;
    word-break: keep-all;
  }
  .tri-legend {
    flex: 1;
    min-width: 0;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3.5px;
    font-size: 10.5px;
  }
  .legend-dot {
    width: 7.5px;
    height: 7.5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend-name {
    font-weight: 700;
    width: 72px;
    flex-shrink: 0;
    color: #272320;
    font-size: 10px;
  }
  .legend-bar-track {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: #EFE9DA;
    overflow: hidden;
    position: relative;
  }
  .legend-bar-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
  }
  .legend-record {
    width: 62px;
    text-align: right;
    font-weight: 600;
    color: #5B554C;
    font-size: 9.5px;
    flex-shrink: 0;
  }
  .legend-pct {
    width: 68px;
    text-align: right;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .comment-box {
    margin-top: 4px;
    background: #FDF9EE;
    border: 1px solid #DDD5BF;
    border-left: 3px solid #C7972A;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 9.5px;
    line-height: 1.45;
    color: #272320;
    text-align: justify;
  }
  .skill-chart-foot {
    margin-top: 3px;
    padding-top: 3px;
    border-top: 1px dashed #E1DACB;
    font-size: 9px;
    line-height: 1.4;
  }
  .scf-gray {
    color: #9A9382;
    margin: 0;
  }
  .scf-ink {
    color: #272320;
    margin: 1px 0 0 0;
  }
  .cert-official-wrap {
    position: relative;
    overflow: hidden;
    border: 1.4px solid #C7972A;
    border-radius: 12px;
    padding: 9px 12px;
    background: #fff;
  }
  .cert-watermark {
    position: absolute;
    right: -35px;
    top: -35px;
    opacity: 0.05;
    pointer-events: none;
  }
  .cert-official-label {
    font-size: 10px;
    color: #A87618;
    letter-spacing: 1px;
    font-weight: 700;
    margin-bottom: 7px;
  }
  .cert-official-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    position: relative;
  }
  .cert-card-official {
    position: relative;
    border-radius: 8px;
    padding: 8px 9px;
    background: #fff;
    border: 1px solid #E1DACB;
    min-height: 68px;
  }
  .cert-card-official.achieved {
    border: 1.4px solid #C7972A;
  }
  .cco-head {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 3px;
    font-size: 10.5px;
    color: #5B554C;
    font-weight: 600;
  }
  .cco-sub {
    font-size: 9px;
    color: #A79F88;
  }
  .cco-value {
    font-size: 15px;
    font-weight: 800;
    color: #272320;
    margin-bottom: 3px;
  }
  .cco-value small {
    font-size: 10px;
    color: #5B554C;
    font-weight: 500;
  }
  .cco-note {
    font-size: 9px;
    color: #5B554C;
    line-height: 1.35;
  }
  .cert-stamp {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 66px;
    height: 66px;
    pointer-events: none;
  }
  .cert-card-official.achieved .cco-head,
  .cert-card-official.achieved .cco-value {
    padding-right: 48px;
  }
  .library-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
    background: #FCFBF6;
    border: 1px solid #E1DACB;
    border-radius: 10px;
    padding: 8px 12px;
  }
  .lib-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .lib-icon {
    font-size: 22px;
    line-height: 1;
  }
  .lib-value {
    font-size: 17px;
    font-weight: 800;
    color: #272320;
  }
  .lib-value small {
    font-size: 11px;
    font-weight: 500;
    color: #5B554C;
    margin-left: 2px;
  }
  .lib-label {
    font-size: 9.5px;
    color: #A87618;
    font-weight: 700;
    margin-top: 1px;
  }
  .lib-right {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .lib-compare-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lib-compare-label {
    font-size: 10px;
    color: #5B554C;
    width: 48px;
    flex-shrink: 0;
    font-weight: 600;
  }
  .lib-compare-track {
    flex: 1;
    height: 7px;
    background: #EFE9DA;
    border-radius: 4px;
    position: relative;
  }
  .lib-compare-num {
    font-size: 10px;
    color: #272320;
    width: 46px;
    text-align: right;
    flex-shrink: 0;
  }
  .lib-legend {
    display: flex;
    gap: 10px;
    font-size: 9px;
    color: #5B554C;
  }
  .lib-legend i {
    display: inline-block;
    width: 7.5px;
    height: 7.5px;
    border-radius: 2px;
    margin-right: 3px;
    vertical-align: -1px;
  }
  .lib-note {
    font-size: 9.5px;
    color: #272320;
    line-height: 1.4;
    text-align: justify;
  }
  .doc-end {
    margin-top: 6px;
    padding-top: 6px;
  }
  .doc-end-band {
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, #1C6FB5 0 33.3%, #C7972A 33.3% 66.6%, #C32B39 66.6% 100%);
    margin-bottom: 6px;
  }
  .doc-end-slogan {
    text-align: center;
    white-space: nowrap;
    font-size: 12.5px;
    font-weight: 600;
    color: #4A4A4A;
    letter-spacing: -0.2px;
  }
  .doc-end-slogan .gl-glo { color: #1270B9; font-weight: 800; }
  .doc-end-slogan .gl-na { color: #D0A426; font-weight: 800; }
  .doc-end-slogan .gl-cal { color: #C30F24; font-weight: 800; }
  .paps-school-logo {
    height: 22px !important;
    max-height: 22px !important;
    max-width: 180px !important;
    object-fit: contain !important;
    display: inline-block !important;
    vertical-align: middle !important;
  }
`;

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
  const [headerImage, setHeaderImage] = useState<string>('');

  // 시스템 설정의 헤더 이미지 (학교 이름 이미지) 동적 바인딩
  useEffect(() => {
    getDocConfig().then(cfg => {
      if (cfg?.headerImage) {
        setHeaderImage(cfg.headerImage);
      }
    });

    const unsub = onDocConfigUpdate(cfg => {
      if (cfg?.headerImage !== undefined) {
        setHeaderImage(cfg.headerImage || '');
      }
    });

    return () => unsub();
  }, []);

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
            ${PAPS_REPORT_STYLES}
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
              color: var(--ink);
            }
            .paps-sheet-page {
              width: 210mm !important;
              height: 297mm !important;
              max-height: 297mm !important;
              margin: 0 auto !important;
              padding: 9mm 12mm 7mm 12mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              overflow: hidden !important;
              background: #ffffff !important;
              position: relative !important;
            }
            .paps-sheet-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .sheet-band {
              height: 5px;
              border-radius: 2px;
              background: linear-gradient(90deg, var(--blue) 0 33.3%, var(--gold) 33.3% 66.6%, var(--red) 66.6% 100%);
              margin-bottom: 8px;
            }
            .sheet-head {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 8px;
              border-bottom: 1.2px solid var(--line);
              padding-bottom: 6px;
            }
            .school-name {
              font-size: 11px;
              font-weight: 700;
              color: var(--gold-deep);
              letter-spacing: 0.5px;
            }
            .doc-title {
              font-size: 19px;
              font-weight: 900;
              color: var(--ink);
              margin: 2px 0 6px 0;
              letter-spacing: 0.5px;
            }
            .meta-table {
              display: flex;
              gap: 14px;
              font-size: 11px;
              color: var(--ink);
            }
            .mt-label {
              color: var(--ink-soft);
              font-weight: 500;
              margin-right: 4px;
            }
            .mt-value {
              font-weight: 700;
            }
            .stamp img {
              height: 38px;
              object-fit: contain;
            }
            .section {
              margin-bottom: 8px;
            }
            .section-head {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 5px;
            }
            .sec-no {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 17px;
              height: 17px;
              border-radius: 50%;
              background: var(--gold);
              color: #fff;
              font-size: 10.5px;
              font-weight: 800;
              flex-shrink: 0;
            }
            .sec-title {
              font-size: 12.5px;
              font-weight: 800;
              color: var(--ink);
            }
            .sec-en {
              font-size: 10px;
              color: var(--ink-soft);
              font-weight: 500;
              margin-left: auto;
            }
            .tri-wrap {
              display: flex;
              gap: 14px;
              align-items: center;
              margin-bottom: 5px;
            }
            .tri-left-box {
              width: 170px;
              flex-shrink: 0;
            }
            .tri-svg-box {
              width: 100%;
            }
            .tri-caption {
              font-size: 8.5px;
              color: var(--ink-soft);
              text-align: center;
              margin-top: 2px;
              line-height: 1.35;
            }
            .tri-legend {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .legend-row {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 10.5px;
            }
            .legend-dot {
              width: 6.5px;
              height: 6.5px;
              border-radius: 50%;
              flex-shrink: 0;
            }
            .legend-name {
              width: 78px;
              flex-shrink: 0;
              font-weight: 700;
              font-size: 10.5px;
            }
            .legend-bar-track {
              flex: 1;
              height: 6px;
              background: #EFE9DA;
              border-radius: 3px;
              overflow: hidden;
            }
            .legend-bar-fill {
              display: block;
              height: 100%;
              border-radius: 3px;
            }
            .legend-record {
              width: 50px;
              text-align: right;
              font-size: 10px;
              font-weight: 600;
              color: var(--ink);
            }
            .legend-pct {
              width: 74px;
              text-align: right;
              font-size: 10px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: flex-end;
            }
            .comment-box {
              margin-top: 3px;
              background: #FBF8F0;
              border: 1px solid var(--line);
              border-left: 3.5px solid var(--gold);
              border-radius: 6px;
              padding: 5px 8px;
              font-size: 10px;
              line-height: 1.45;
              color: var(--ink);
              text-align: justify;
            }
            .skill-chart-foot {
              margin-top: 3px;
              padding-top: 3px;
              border-top: 1px dashed var(--line);
              font-size: 9px;
              line-height: 1.4;
            }
            .scf-gray {
              color: #9A9382;
              margin: 0;
            }
            .scf-ink {
              color: var(--ink);
              margin: 1px 0 0 0;
            }
            .cert-official-wrap {
              position: relative;
              overflow: hidden;
              border: 1.4px solid var(--gold);
              border-radius: 12px;
              padding: 9px 12px;
              background: #fff;
            }
            .cert-watermark {
              position: absolute;
              right: -35px;
              top: -35px;
              opacity: 0.05;
              pointer-events: none;
            }
            .cert-official-label {
              font-size: 10px;
              color: var(--gold-deep);
              letter-spacing: 1px;
              font-weight: 700;
              margin-bottom: 7px;
            }
            .cert-official-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 8px;
              position: relative;
            }
            .cert-card-official {
              position: relative;
              border-radius: 8px;
              padding: 8px 9px;
              background: #fff;
              border: 1px solid var(--line);
              min-height: 68px;
            }
            .cert-card-official.achieved {
              border: 1.4px solid var(--gold);
            }
            .cco-head {
              display: flex;
              align-items: center;
              gap: 4px;
              margin-bottom: 3px;
              font-size: 10.5px;
              color: var(--ink-soft);
              font-weight: 600;
            }
            .cco-sub {
              font-size: 9px;
              color: #A79F88;
            }
            .cco-value {
              font-size: 15px;
              font-weight: 800;
              color: var(--ink);
              margin-bottom: 3px;
            }
            .cco-value small {
              font-size: 10px;
              color: var(--ink-soft);
              font-weight: 500;
            }
            .cco-note {
              font-size: 9px;
              color: var(--ink-soft);
              line-height: 1.35;
            }
            .cert-stamp {
              position: absolute;
              top: -10px;
              right: -10px;
              width: 66px;
              height: 66px;
              pointer-events: none;
            }
            .cert-card-official.achieved .cco-head,
            .cert-card-official.achieved .cco-value {
              padding-right: 48px;
            }
            .library-wrap {
              display: flex;
              align-items: center;
              gap: 14px;
              background: #FCFBF6;
              border: 1px solid var(--line);
              border-radius: 10px;
              padding: 8px 12px;
            }
            .lib-left {
              display: flex;
              align-items: center;
              gap: 10px;
              flex-shrink: 0;
            }
            .lib-icon {
              font-size: 22px;
              line-height: 1;
            }
            .lib-value {
              font-size: 17px;
              font-weight: 800;
              color: var(--ink);
            }
            .lib-value small {
              font-size: 11px;
              font-weight: 500;
              color: var(--ink-soft);
              margin-left: 2px;
            }
            .lib-label {
              font-size: 9.5px;
              color: var(--gold-deep);
              font-weight: 700;
              margin-top: 1px;
            }
            .lib-right {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 3px;
            }
            .lib-compare-row {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .lib-compare-label {
              font-size: 10px;
              color: var(--ink-soft);
              width: 48px;
              flex-shrink: 0;
              font-weight: 600;
            }
            .lib-compare-track {
              flex: 1;
              height: 7px;
              background: #EFE9DA;
              border-radius: 4px;
              position: relative;
            }
            .lib-compare-num {
              font-size: 10px;
              color: var(--ink);
              width: 46px;
              text-align: right;
              flex-shrink: 0;
            }
            .lib-legend {
              display: flex;
              gap: 10px;
              font-size: 9px;
              color: var(--ink-soft);
            }
            .lib-legend i {
              display: inline-block;
              width: 7.5px;
              height: 7.5px;
              border-radius: 2px;
              margin-right: 3px;
              vertical-align: -1px;
            }
            .lib-note {
              font-size: 9.5px;
              color: var(--ink);
              line-height: 1.4;
              text-align: justify;
            }
            .doc-end {
              margin-top: 6px;
              padding-top: 6px;
            }
            .doc-end-band {
              height: 3px;
              border-radius: 2px;
              background: linear-gradient(90deg, var(--blue) 0 33.3%, var(--gold) 33.3% 66.6%, var(--red) 66.6% 100%);
              margin-bottom: 6px;
            }
            .doc-end-slogan {
              text-align: center;
              white-space: nowrap;
              font-size: 12.5px;
              font-weight: 600;
              color: #4A4A4A;
              letter-spacing: -0.2px;
            }
            .doc-end-slogan .gl-glo { color: #1270B9; font-weight: 800; }
            .doc-end-slogan .gl-na { color: #D0A426; font-weight: 800; }
            .doc-end-slogan .gl-cal { color: #C30F24; font-weight: 800; }
            .paps-school-logo {
              height: 22px !important;
              max-height: 22px !important;
              max-width: 180px !important;
              object-fit: contain !important;
              display: inline-block !important;
              vertical-align: middle !important;
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
              }, 500);
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
        {/* 모달 미리보기 화면을 위한 GloNaCal 전용 CSS 스타일 주입 */}
        <style>{PAPS_REPORT_STYLES}</style>

        {/* 상단 컨트롤러 (인쇄 시 숨김 - 우측 닫기(X) 버튼과 겹치지 않도록 pr-14 안전 여백 부여) */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 p-3.5 pr-14 bg-white border-b border-slate-200 shrink-0 shadow-xs">
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

        {/* 인쇄 미리보기 컨테이너 (세로 중앙 정렬 및 가로 축소 방지) */}
        <div
          ref={printContainerRef}
          className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center gap-8 w-full bg-slate-100"
        >
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
                headerImage={headerImage}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * KIS 날개 로고 에셋 (GloNaCal 원본 Base64 PNG)
 */
const KIS_LOGO_BASE64 = "data:image/png;base64,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";

/**
 * 5대 요인별 시그니처 테마 색상 (GloNaCal 감성 컬러 매핑)
 */
const FACTOR_THEME_COLORS: Record<string, string> = {
  '심폐지구력': '#1C6FB5', // Blue
  '유연성': '#C7972A',     // Gold
  '근력/근지구력': '#C32B39', // Red
  '순발력': '#2E7D32',     // Green
  '체질량지수(BMI)': '#8E24AA', // Purple
};

/**
 * 공식 인증 도장 SVG (1~2등급 학생 날인용)
 */
function renderCertStampSVG(uid: string) {
  const G = '#A87618';
  return (
    <svg
      width="82"
      height="82"
      viewBox="0 0 120 120"
      className="cert-stamp"
      aria-label="호치민시한국국제학교 공식 인증"
    >
      <g transform="rotate(-6 60 60)">
        <circle cx="60" cy="60" r="57" fill="#fff" stroke={G} strokeWidth="3.2" />
        <circle cx="60" cy="60" r="52.5" fill="none" stroke={G} strokeWidth="0.9" />
        <circle cx="60" cy="60" r="36.5" fill="none" stroke={G} strokeWidth="1.3" />
        <path id={`sTop${uid}`} d="M 26,83.8 A 41.5,41.5 0 1 1 94,83.8" fill="none" />
        <text
          fontFamily="Georgia,'Times New Roman',serif"
          fontSize="8.4"
          fontWeight="700"
          letterSpacing="0.35"
          fill={G}
        >
          <textPath href={`#sTop${uid}`} startOffset="50%" textAnchor="middle">
            KOREAN INTERNATIONAL SCHOOL
          </textPath>
        </text>
        <path id={`sBot${uid}`} d="M 21.1,87.3 A 47.5,47.5 0 0 0 98.9,87.3" fill="none" />
        <text
          fontFamily="Georgia,'Times New Roman',serif"
          fontSize="8.4"
          fontWeight="700"
          letterSpacing="1.6"
          fill={G}
        >
          <textPath href={`#sBot${uid}`} startOffset="50%" textAnchor="middle">
            ★ HCMC ★
          </textPath>
        </text>
        <g fill={G} fontFamily="Georgia,serif" textAnchor="middle">
          <text x="48" y="45" fontSize="6.5">★</text>
          <text x="60" y="42" fontSize="8">★</text>
          <text x="72" y="45" fontSize="6.5">★</text>
        </g>
        <path d="M 22,52 L 98,52 L 94.5,60 L 98,68 L 22,68 L 25.5,60 Z" fill={G} />
        <text
          x="60"
          y="63.9"
          textAnchor="middle"
          fontFamily="Georgia,'Times New Roman',serif"
          fontSize="11"
          fontWeight="700"
          letterSpacing="0.6"
          fill="#fff"
          textLength="58"
          lengthAdjust="spacingAndGlyphs"
        >
          CERTIFIED
        </text>
        <line x1="44" y1="77" x2="76" y2="77" stroke={G} strokeWidth="1" />
        <line x1="50" y1="80.5" x2="70" y2="80.5" stroke={G} strokeWidth="0.7" />
      </g>
    </svg>
  );
}

/**
 * 5대 체력 요인 5각형 레이더 차트 SVG 렌더러
 */
function renderPapsRadarSVG(evaluations: PapsFactorEval[], uid: string) {
  // 중심점 및 반경
  const Cx = 120;
  const Cy = 114;
  const R = 72;

  // 5개 축 꼭짓점 (위에서부터 시계방향: 심폐지구력(-90°), 유연성(-18°), 근력(54°), 순발력(126°), BMI(198°))
  const factorKeys: Array<'심폐지구력' | '유연성' | '근력/근지구력' | '순발력' | '체질량지수(BMI)'> = [
    '심폐지구력',
    '유연성',
    '근력/근지구력',
    '순발력',
    '체질량지수(BMI)',
  ];

  const angles = [-90, -18, 54, 126, 198].map(deg => (deg * Math.PI) / 180);

  // 축 꼭짓점 좌표
  const vertices = angles.map(a => ({
    x: Cx + R * Math.cos(a),
    y: Cy + R * Math.sin(a),
  }));

  // 가이드 다각형 문자열 생성 (1/3, 2/3, 1.0)
  const getPolygonPoints = (scale: number) => {
    return vertices
      .map(v => {
        const px = Cx + (v.x - Cx) * scale;
        const py = Cy + (v.y - Cy) * scale;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
  };

  // 학생 요인별 배점 매핑 (0~20점 기준)
  const evalMap: Record<string, PapsFactorEval> = {};
  evaluations.forEach(e => {
    evalMap[e.factor] = e;
  });

  // 학생 점수 기반 다각형 포인트 계산
  const studentPoints = factorKeys.map((factor, idx) => {
    const ev = evalMap[factor];
    const score = ev?.score || 0;
    // 점수 비율 (0.15~1.0 최소 가시성 확보)
    const t = Math.max(0.15, Math.min(1, score / 20));
    const vx = vertices[idx].x;
    const vy = vertices[idx].y;
    return {
      x: Cx + (vx - Cx) * t,
      y: Cy + (vy - Cy) * t,
      score,
      factor,
      color: FACTOR_THEME_COLORS[factor] || '#C7972A',
    };
  });

  const studentPolygonStr = studentPoints
    .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const gradId = `papsRadarFill-${uid}`;

  return (
    <svg viewBox="0 0 240 220" width="100%" className="overflow-visible" aria-label="5대 체력 요인 레이더 차트">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1C6FB5" stopOpacity="0.32" />
          <stop offset="50%" stopColor="#C7972A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#C32B39" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* 3단계 동심 5각형 가이드라인 */}
      <polygon points={getPolygonPoints(1.0)} fill="none" stroke="#E1DACB" strokeWidth="1.2" />
      <polygon points={getPolygonPoints(2 / 3)} fill="none" stroke="#E1DACB" strokeWidth="1" strokeDasharray="2,3" />
      <polygon points={getPolygonPoints(1 / 3)} fill="none" stroke="#E1DACB" strokeWidth="1" strokeDasharray="2,3" />

      {/* 중심축 라인 */}
      {vertices.map((v, i) => (
        <line
          key={i}
          x1={Cx}
          y1={Cy}
          x2={v.x}
          y2={v.y}
          stroke="#E1DACB"
          strokeWidth="1"
        />
      ))}

      {/* 눈금 숫자 (좌측상단 축 근처) */}
      <text x={Cx - 14} y={Cy - 18} textAnchor="end" fontSize="7.5" fill="#B9AE8F" fontFamily="sans-serif">7점</text>
      <text x={Cx - 28} y={Cy - 40} textAnchor="end" fontSize="7.5" fill="#B9AE8F" fontFamily="sans-serif">14점</text>
      <text x={Cx - 42} y={Cy - 62} textAnchor="end" fontSize="7.5" fill="#B9AE8F" fontFamily="sans-serif">20점</text>

      {/* 학생 체력 성취 영역 */}
      <polygon
        points={studentPolygonStr}
        fill={`url(#${gradId})`}
        stroke="#272320"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* 꼭짓점 원 표식 */}
      {studentPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4.5"
          fill={p.color}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      ))}

      {/* 요인별 텍스트 레이블 */}
      {/* 0. 심폐지구력 (상단) */}
      <text x={120} y={26} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#1C6FB5">
        심폐지구력
      </text>
      {/* 1. 유연성 (우상단) */}
      <text x={198} y={93} textAnchor="start" fontSize="10.5" fontWeight="700" fill="#C7972A">
        유연성
      </text>
      {/* 2. 근력/근지구력 (우하단) */}
      <text x={168} y={196} textAnchor="start" fontSize="10.5" fontWeight="700" fill="#C32B39">
        근력·근지구력
      </text>
      {/* 3. 순발력 (좌하단) */}
      <text x={72} y={196} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#2E7D32">
        순발력
      </text>
      {/* 4. 체질량지수(BMI) (좌상단) */}
      <text x={42} y={93} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#8E24AA">
        BMI
      </text>
    </svg>
  );
}

/**
 * 개별 학생 PAPS 맞춤형 체력평가 보고서 A4 1페이지 서식 (GloNaCal 테마 1:1 완벽 이식)
 */
function SingleStudentPapsSheet({
  report,
  isLast,
  headerImage,
}: {
  report: PapsStudentReportData;
  isLast: boolean;
  headerImage?: string;
}) {
  const { student, academicYear, evaluations, totalScore, finalGrade, measuredDate } = report;
  const uidBase = `${student.id || student.studentNum || 's'}_${Math.round(Math.random() * 9999)}`;

  // 1~2등급 학생 공식 인증 날인 여부
  const isCertified = finalGrade === '1등급' || finalGrade === '2등급';

  // 우수 요인 및 취약 요인 도출
  const sortedEvals = [...evaluations].sort((a, b) => b.score - a.score);
  const topFactor = sortedEvals[0];
  const lowFactor = sortedEvals[sortedEvals.length - 1];

  // BMI 수치 및 상태 계산
  const bmiEval = evaluations.find(e => e.factor === '체질량지수(BMI)');
  const bmiValue = bmiEval?.value || 0;

  // BMI 게이지 바 위치 계산 (12 ~ 32 스케일)
  const bmiMin = 13;
  const bmiMax = 31;
  const bmiMarkerPct = bmiValue > 0
    ? Math.min(100, Math.max(0, ((bmiValue - bmiMin) / (bmiMax - bmiMin)) * 100))
    : null;

  let bmiStatusText = '표준 체형';
  if (bmiValue > 0) {
    if (bmiValue < 18.5) bmiStatusText = '저체중 구간';
    else if (bmiValue < 23) bmiStatusText = '표준 체형';
    else if (bmiValue < 25) bmiStatusText = '과체중 구간';
    else bmiStatusText = '비만 구간';
  }

  return (
    <div
      className={`paps-sheet-page sheet bg-white text-[#272320] mx-auto shrink-0 shadow-lg ${
        !isLast ? 'break-after-page' : ''
      }`}
      style={{
        width: '210mm',
        minWidth: '210mm',
        maxWidth: '210mm',
        height: '297mm',
        minHeight: '297mm',
        maxHeight: '297mm',
        pageBreakAfter: isLast ? 'auto' : 'always',
        boxSizing: 'border-box',
        flexShrink: 0,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
      }}
    >
      <div className="pg-head">
        {/* 1. 상단 3색 밴드 (GloNaCal 시그니처 밴드) */}
        <div className="sheet-band" />

        {/* 2. 헤더 메타 영역 */}
        <div className="sheet-head">
          <div className="flex-1 min-w-0 pr-4">
            <div className="school-name">호치민시한국국제학교</div>
            <div className="doc-title">{academicYear}학년도 PAPS 학생 체육 성장 리포트</div>
            <div className="meta-table">
              <div>
                <span className="mt-label">학년/반</span>
                <span className="mt-value">{student.grade}학년 {student.classNum}반</span>
              </div>
              <div>
                <span className="mt-label">번호</span>
                <span className="mt-value">{student.studentNum ? `${student.studentNum}번` : '-'}</span>
              </div>
              <div>
                <span className="mt-label">이름</span>
                <span className="mt-value">{student.name} ({student.gender || '남'})</span>
              </div>
              <div>
                <span className="mt-label">측정일</span>
                <span className="mt-value">{measuredDate}</span>
              </div>
            </div>
          </div>
          <div className="stamp shrink-0">
            <img
              src={KIS_LOGO_BASE64}
              alt="호치민시한국국제학교 심볼"
              className="h-[38px] object-contain"
            />
          </div>
        </div>

        {/* 3. 섹션 1: 5대 체력 요인별 성취 및 레이더 분석 */}
        <div className="section" data-section="radar">
          <div className="section-head">
            <span className="sec-no">1</span>
            <span className="sec-title">5대 체력 요인별 성취 및 레이더 분석</span>
            <span className="sec-en">PAPS 5-Factor Physical Fitness Achievement</span>
          </div>

          <div className="tri-wrap">
            <div className="tri-left-box">
              <div className="tri-svg-box">
                {renderPapsRadarSVG(evaluations, uidBase)}
              </div>
              <div className="tri-caption">
                도형의 <b>모양</b>은 5대 체력 요인의 균형을, <b>크기</b>는 <span style={{ whiteSpace: 'nowrap' }}>전반적인 발달 정도를</span> 보여줍니다. (20점 만점)
              </div>
            </div>

            <div className="tri-legend">
              {evaluations.map((ev, i) => {
                const pct = Math.min(100, Math.max(0, (ev.score / 20) * 100));
                const color = FACTOR_THEME_COLORS[ev.factor] || '#C7972A';
                return (
                  <div key={i} className="legend-row">
                    <span className="legend-dot" style={{ background: color }} />
                    <span className="legend-name truncate">{ev.factor}</span>
                    <span className="legend-bar-track">
                      <span className="legend-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </span>
                    <span className="legend-record truncate">
                      {ev.value > 0 ? `${ev.value} ${ev.unit}` : '-'}
                    </span>
                    <span className="legend-pct">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          ev.grade <= 2
                            ? 'text-blue-700 bg-blue-50'
                            : ev.grade === 3
                            ? 'text-slate-700 bg-slate-100'
                            : 'text-amber-800 bg-amber-50'
                        }`}
                      >
                        {ev.grade > 0 ? `${ev.grade}등급` : '-'}
                      </span>
                      <span className="ml-1 text-[10px] font-semibold text-slate-500">
                        ({ev.score}점)
                      </span>
                    </span>
                  </div>
                );
              })}
              <div className="comment-box">
                <span className="font-bold text-[#A87618] mr-1">[종합 체력 총평]</span>
                {report.overallComment}
              </div>
            </div>
          </div>

          {/* 최고 성취 역량 격려 문구 및 주석 */}
          <div className="skill-chart-foot">
            <p className="scf-gray">
              교육부 학생건강체력평가(PAPS) 기준에 따라 5대 체력 요인 및 체질량지수를 정밀 진단했습니다.
            </p>
            <p className="scf-ink">
              <strong>[최고 성취 역량 격려]</strong> {report.strengthPraise}
            </p>
          </div>
        </div>

        {/* 4. 섹션 2: 맞춤형 체력 인증 및 처방 (KIS OFFICIAL CERTIFICATION) */}
        <div className="section cert-section-wrap" data-section="cert">
          <div className="section-head">
            <span className="sec-no">2</span>
            <span className="sec-title">맞춤형 체력 인증 및 처방</span>
            <span className="sec-en" style={{ textTransform: 'none' }}>KIS Physical Fitness Certification</span>
          </div>

          <div className="cert-official-wrap">
            {/* 배경 워터마크 SVG */}
            <svg
              width="220"
              height="220"
              viewBox="0 0 220 220"
              className="cert-watermark"
              aria-hidden="true"
            >
              <circle cx="110" cy="110" r="95" fill="none" stroke="#A87618" strokeWidth="3" />
              <circle cx="110" cy="110" r="78" fill="none" stroke="#A87618" strokeWidth="1.5" />
              <g stroke="#A87618" strokeWidth="2">
                <line x1="110" y1="15" x2="110" y2="32" />
                <line x1="110" y1="188" x2="110" y2="205" />
                <line x1="15" y1="110" x2="32" y2="110" />
                <line x1="188" y1="110" x2="205" y2="110" />
              </g>
            </svg>

            <div className="cert-official-label">KIS OFFICIAL CERTIFICATION</div>

            <div className="cert-official-grid">
              {/* 카드 1: 종합 체력 등급 PAPS 인증 */}
              <div className={`cert-card-official ${isCertified ? 'achieved' : ''}`}>
                {isCertified && renderCertStampSVG(uidBase)}
                <div className="cco-head">
                  <span>🏆</span> <span>종합 체력 등급<span className="cco-sub">_PAPS</span></span>
                </div>
                <div className="cco-value">
                  {finalGrade} <small>/ {totalScore}점(100점)</small>
                </div>
                <div className="cco-note">
                  {isCertified ? (
                    <>
                      <span className="cco-line">PAPS 종합 {finalGrade} 달성</span>
                      <span className="cco-line">우수 건강 체력을 공식 인증함.</span>
                    </>
                  ) : (
                    <span className="cco-line">꾸준한 운동으로 우수 체력에 도전해 보아요!</span>
                  )}
                </div>
              </div>

              {/* 카드 2: 우수 역량 심화 스포츠 */}
              <div className="cert-card-official">
                <div className="cco-head">
                  <span>✨</span> <span>우수 역량<span className="cco-sub">_심화 스포츠</span></span>
                </div>
                <div className="cco-value truncate">
                  {topFactor?.factor || '체력 증진'} <small>심화</small>
                </div>
                <div className="cco-note">
                  <span className="cco-line">{report.advancedSportsGuide}</span>
                </div>
              </div>

              {/* 카드 3: 취약 요인 맞춤 처방 */}
              <div className="cert-card-official">
                <div className="cco-head">
                  <span>💪</span> <span>취약 요인<span className="cco-sub">_맞춤 처방</span></span>
                </div>
                <div className="cco-value truncate">
                  {lowFactor?.factor || '균형 관리'} <small>보완</small>
                </div>
                <div className="cco-note">
                  <span className="cco-line">{report.playfulImprovementGuide}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 섹션 3: 체형 분석 및 건강 생활 습관 가이드 (Library-wrap 스타일) */}
        <div className="section" data-section="library">
          <div className="section-head">
            <span className="sec-no">3</span>
            <span className="sec-title">체형 분석 및 건강 생활 습관 가이드</span>
            <span className="sec-en">Body Composition &amp; Healthy Lifestyle Guide</span>
          </div>

          <div className="library-wrap library-wrap-full">
            <div className="lib-left">
              <span className="lib-icon">🏃</span>
              <div>
                <div className="lib-value">
                  {bmiValue > 0 ? bmiValue : '-'}<small>kg/㎡</small>
                </div>
                <div className="lib-label">
                  <span className="mr-1">✦</span> 체질량지수 (BMI)
                </div>
              </div>
            </div>

            <div className="lib-right">
              <div className="lib-compare-row">
                <span className="lib-compare-label">체형 구간</span>
                <div className="lib-compare-track">
                  {/* 4구간 트랙 */}
                  <div className="h-full flex w-full rounded-[4px] overflow-hidden">
                    <span className="h-full bg-sky-400" style={{ width: '25%' }} title="저체중" />
                    <span className="h-full bg-emerald-500" style={{ width: '35%' }} title="표준" />
                    <span className="h-full bg-amber-500" style={{ width: '20%' }} title="과체중" />
                    <span className="h-full bg-rose-500" style={{ width: '20%' }} title="비만" />
                  </div>
                  {/* 내 BMI 마커 */}
                  {bmiMarkerPct !== null && (
                    <div
                      className="absolute top-[-3px] bottom-[-3px] w-2 bg-slate-900 border-2 border-white rounded-full shadow-sm transform -translate-x-1/2"
                      style={{ left: `${bmiMarkerPct}%` }}
                      title={`내 BMI: ${bmiValue}`}
                    />
                  )}
                </div>
                <span className="lib-compare-num font-bold">{bmiStatusText}</span>
              </div>

              <div className="lib-legend">
                <span><i style={{ background: '#38BDF8' }} />저체중 (&lt;18.5)</span>
                <span><i style={{ background: '#22C55E' }} />표준 (18.5~23)</span>
                <span><i style={{ background: '#F97316' }} />과체중 (23~25)</span>
                <span><i style={{ background: '#EF4444' }} />비만 (25 이상)</span>
              </div>

              <div className="lib-note">{report.bmiHealthGuide}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. 하단 푸터 (GloNaCal 시그니처 슬로건 & 장식선 - 샘플 양식 1:1 통일) */}
      <div className="doc-end">
        <div className="doc-end-band" />
        <div className="doc-end-slogan">
          <span className="gl-glo">Glo</span>
          <span className="gl-na">Na</span>
          <span className="gl-cal">Cal</span> 미래인재를 키우는 행복한 학교
        </div>
      </div>
    </div>
  );
}

