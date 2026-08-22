'use client';

import React, { useRef, useState } from 'react';
import { ApprovalDoc } from '@/lib/types';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileCheck } from 'lucide-react';
import { exportA4PagesToPdf } from '@/lib/pdf-export';

type ParentNotificationModalProps = {
  doc: ApprovalDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ParentNotificationModal({ doc, open, onOpenChange }: ParentNotificationModalProps) {
  const printSheetRef = useRef<HTMLDivElement>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  if (!doc) return null;

  const data = doc.parentFormData || {};
  const studentName = data.studentName || '';

  // 학년, 반, 번호 파싱
  let grade = '', studentClass = '', number = '';
  if (data.gradeClassNumber) {
    const parts = data.gradeClassNumber.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
    if (parts.length >= 3) {
      grade = parts[0];
      studentClass = parts[1];
      number = parts[2];
    } else {
      grade = data.gradeClassNumber;
    }
  }

  // 기간 파싱
  const tripPeriod = data.tripPeriod || { startDate: '', endDate: '', totalDays: 1 };
  const startDateStr = tripPeriod.startDate || '';
  const endDateStr = tripPeriod.endDate || '';
  const totalDays = tripPeriod.totalDays || 1;

  let startYear = '', startMonth = '', startDay = '';
  if (startDateStr) {
    const parts = startDateStr.split('-');
    if (parts.length === 3) {
      startYear = parts[0];
      startMonth = String(parseInt(parts[1], 10));
      startDay = String(parseInt(parts[2], 10));
    }
  }

  let endYear = '', endMonth = '', endDay = '';
  if (endDateStr) {
    const parts = endDateStr.split('-');
    if (parts.length === 3) {
      endYear = parts[0];
      endMonth = String(parseInt(parts[1], 10));
      endDay = String(parseInt(parts[2], 10));
    }
  }

  // 승인일 또는 완료일
  const approvedDate = doc.completedAt 
    ? new Date(doc.completedAt) 
    : doc.createdAt 
    ? new Date(doc.createdAt) 
    : new Date();
  const approvedYear = format(approvedDate, 'yyyy');
  const approvedMonth = format(approvedDate, 'MM');
  const approvedDay = format(approvedDate, 'dd');

  // PDF 다운로드 핸들러
  const handleDownloadPdf = async () => {
    if (!printSheetRef.current) return;
    setIsPdfGenerating(true);
    try {
      const fileName = `교외체험학습_통보서_${studentName || '학생'}.pdf`;
      await exportA4PagesToPdf([printSheetRef.current], fileName);
    } catch (e) {
      console.error("Failed to generate notification PDF:", e);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 pr-6">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            「학교장허가 교외체험학습」 통보서
          </DialogTitle>
          <Button 
            variant="default"
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer"
          >
            {isPdfGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isPdfGenerating ? 'PDF 생성 중...' : '통보서 PDF 다운로드'}
          </Button>
        </DialogHeader>

        {/* ── 화면 렌더링 및 PDF 캡처 대상 시트 (A4 규격) ── */}
        <div className="py-4 overflow-x-auto flex justify-center bg-slate-100 rounded-lg p-2">
          <div 
            ref={printSheetRef}
            className="a4-print-sheet bg-white text-black font-serif shadow-xl mx-auto"
            style={{
              width: '210mm',
              minHeight: '297mm',
              height: '297mm',
              maxHeight: '297mm',
              padding: '25mm 20mm 25mm 20mm',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: '"Batang", "Nanum Myeongjo", "Apple SD Gothic Neo", "Malgun Gothic", serif',
            }}
          >
            {/* 상단 표제 */}
            <div className="text-center pt-4 mb-8">
              <h1 className="text-[26pt] font-extrabold tracking-[0.7em] leading-tight">
                통 &nbsp; 보 &nbsp; 서
              </h1>
            </div>

            {/* 테두리 본문 박스 */}
            <div className="border-2 border-black p-8 sm:p-10 my-auto text-center flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-[17pt] font-bold mb-10 tracking-wide">
                  「학교장허가 교외체험학습」 통보서
                </h2>

                <div className="text-left text-[11.5pt] leading-loose space-y-6 max-w-lg mx-auto mb-10 font-medium">
                  <div className="flex items-center">
                    <span className="w-20 font-bold">학&nbsp;&nbsp;&nbsp;&nbsp;생 :</span>
                    <span className="font-bold border-b border-black px-3 py-0.5 mr-2 min-w-[100px] text-center">{studentName}</span>
                    <span>( {grade}학년 &nbsp;{studentClass}반 &nbsp;{number}번 )</span>
                  </div>

                  <div className="flex items-center flex-wrap">
                    <span className="w-20 font-bold">기&nbsp;&nbsp;&nbsp;&nbsp;간 :</span>
                    <span className="font-medium">
                      {startYear}년 {startMonth}월 {startDay}일 ~ {endYear && endYear !== startYear ? `${endYear}년 ` : ''}{endMonth}월 {endDay}일 ( <b>{totalDays}</b>일간 )
                    </span>
                  </div>

                  <div className="pt-4 text-[12pt] font-bold text-center">
                    위와 같이 교외체험학습을 승인 및 통보합니다.
                  </div>
                </div>
              </div>

              <div>
                <div className="text-center mb-6 text-[11.5pt] font-bold">
                  {approvedYear} 년 &nbsp;&nbsp; {approvedMonth} 월 &nbsp;&nbsp; {approvedDay} 일
                </div>

                <div className="text-center font-extrabold text-[16pt] tracking-wider mb-2">
                  호치민시한국국제학교장 <span className="text-[11pt] font-normal tracking-normal text-slate-700">(직인생략)</span>
                </div>
              </div>
            </div>

            {/* 하단 기관명 */}
            <div className="text-center text-[9.5pt] text-slate-500 pt-4">
              호치민시한국국제학교 &nbsp; KOREAN INTERNATIONAL SCHOOL HCMC
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
