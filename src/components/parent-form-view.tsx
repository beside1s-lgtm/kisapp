'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ApprovalDoc, ParentFormData, DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS, FieldTripBlackoutPeriod } from '@/lib/types';
import { format } from 'date-fns';

type ParentFormViewProps = {
  doc: ApprovalDoc;
  teacherMode?: boolean;
  teacherData?: {
    absenceType?: '병결' | '미인정' | '기타' | '출석인정';
    confirmMethod?: '전화/문자' | '학부모 내교' | '가정방문' | '기타';
    confirmDate?: string;
  };
  onTeacherDataChange?: (data: any) => void;
  approverSignatures?: Record<string, string>;
  isParentPortal?: boolean;
};

export function ParentFormView({ doc, teacherMode, teacherData, onTeacherDataChange, approverSignatures, isParentPortal = true }: ParentFormViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const targetWidth = 794; // 210mm in px at 96DPI
      if (containerWidth > 0 && containerWidth < targetWidth) {
        // 모바일 화면 좌우 4px 여백을 두고 정확히 축소
        const availableWidth = Math.max(containerWidth - 8, 280);
        const newScale = Math.min(1, availableWidth / targetWidth);
        setScale(newScale);
      } else {
        setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const data = (doc.parentFormData || {}) as ParentFormData;
  if (!data || Object.keys(data).length === 0) return <div>데이터가 없습니다.</div>;

  const isAbsence = data.type === 'absence';
  const isReport = data.type === 'field-trip-report';

  // 보고서 내용 추출 (다양한 저장 형태 모두 대응)
  let reportTitle = 
    data.reportTitle || 
    (doc as any).reportTitle || 
    (doc as any).parentFormData?.reportTitle || 
    '교외체험학습 결과보고서';

  let reportContent = 
    data.reportContent || 
    (doc as any).reportContent || 
    (doc as any).parentFormData?.reportContent || 
    '';

  let reportSubmittedAt = 
    data.reportSubmittedAt || 
    (doc as any).reportSubmittedAt || 
    (doc as any).parentFormData?.reportSubmittedAt || 
    '';

  // doc.content HTML에 포함된 결과보고서 추출 (fallback)
  if (!reportContent && doc.content && doc.content.includes('결과보고서')) {
    const match = doc.content.match(/교외체험학습 결과[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (match && match[1]) {
      reportContent = match[1].replace(/<[^>]*>/g, ' ').trim();
    }
  }

  const isReportSubmitted = Boolean(
    data.reportSubmitted || 
    (doc as any).reportSubmitted || 
    (doc as any).parentFormData?.reportSubmitted || 
    reportContent ||
    (doc.content && doc.content.includes('결과보고서'))
  );

  const hasReport = !isAbsence && !isReport && (isReportSubmitted || Boolean(reportContent));
  const submitDate = doc.createdAt ? new Date(doc.createdAt) : new Date();
  
  // 학년, 반, 번호 파싱 (형식: "5-1-15" 또는 "5학년 1반 15번")
  let grade = '', studentClass = '', number = '';
  if (data.gradeClassNumber) {
    const parts = data.gradeClassNumber.replace(/[^0-9-]/g, '-').split('-').filter(Boolean);
    if (parts.length >= 3) {
      grade = parts[0];
      studentClass = parts[1];
      number = parts[2];
    } else {
      grade = data.gradeClassNumber; // fallback
    }
  }

  // 결재자 역할 매칭 함수 (컴포넌트 전역)
  const matchApprover = (targetRole: string) => {
    return doc.approvers?.find(a => {
      if (!a.role) return false;
      const cleanRole = a.role.trim();
      if (cleanRole === targetRole) return true;
      if (targetRole === '부장') {
        return cleanRole.includes('부장') || cleanRole === '교무부장' || cleanRole === '학년부장' || cleanRole === '연구부장' || cleanRole === '학생부장' || cleanRole === '부장교사';
      }
      if (targetRole === '담임') {
        return cleanRole.includes('담임') || cleanRole.toLowerCase().includes('homeroom');
      }
      if (targetRole === '교감') {
        return cleanRole.includes('교감') || cleanRole.toLowerCase().includes('vice') || cleanRole.toLowerCase().includes('vp');
      }
      if (targetRole === '교장') {
        return (cleanRole.includes('교장') && !cleanRole.includes('교감')) || cleanRole.toLowerCase().includes('principal');
      }
      return cleanRole.includes(targetRole);
    });
  };

  // 승인자 목록 매핑 (직책 1줄 고정, 깔끔한 4칸 담임, 부장, 교감, 교장)
  const renderApprovers = () => {
    const slots = ['담임', '부장', '교감', '교장'];

    return (
      <table 
        className="w-[230px] text-[8.5pt] ml-auto shrink-0 not-w-full" 
        style={{ 
          width: '230px', 
          borderCollapse: 'collapse', 
          border: '1px solid #000000',
          tableLayout: 'fixed'
        }}
      >
        <tbody>
          <tr style={{ height: '22px' }}>
            <th 
              rowSpan={2} 
              className="text-center font-bold px-0.5 text-[8pt] leading-tight"
              style={{ width: '22px', border: '1px solid #000000', backgroundColor: '#f8fafc', verticalAlign: 'middle' }}
            >
              결<br/>재
            </th>
            {slots.map((role, idx) => (
              <th 
                key={idx} 
                className="text-center font-bold py-0.5 px-0.5 text-[8.5pt] whitespace-nowrap"
                style={{ width: '52px', border: '1px solid #000000', backgroundColor: '#f8fafc', verticalAlign: 'middle' }}
              >
                {role}
              </th>
            ))}
          </tr>
          <tr style={{ height: '46px' }}>
            {slots.map((role, idx) => {
              const approver = matchApprover(role);
              const approverEmail = approver?.email?.trim().toLowerCase();
              const signature = approver?.signature || (approverEmail ? approverSignatures?.[approverEmail] : undefined);
              return (
                <td 
                  key={idx} 
                  className="text-center align-middle relative p-0.5"
                  style={{ width: '52px', height: '46px', border: '1px solid #000000', verticalAlign: 'middle' }}
                >
                  {approver && approver.status === 'approved' && (
                    signature ? (
                      <>
                        {approver.type === 'final' && <span className="absolute top-0 right-0 text-[6.5pt] text-red-600 font-bold bg-white/95 px-0.5 z-10 leading-none">전결</span>}
                        <img src={signature} className="absolute inset-0 w-full h-full object-contain mix-blend-multiply p-0.5" alt="sig" />
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        {approver.type === 'final' && <span className="absolute top-0 right-0 text-[6.5pt] text-red-600 font-bold bg-white/95 px-0.5 z-10 leading-none">전결</span>}
                        <span className="font-bold text-[8pt] text-slate-800 leading-tight">{approver.name || approver.approverName || '승인'}</span>
                        <span className="text-[6.5pt] text-slate-500 font-normal">(서명)</span>
                      </div>
                    )
                  )}
                  {approver && approver.status === 'rejected' && <span className="text-red-500 font-bold text-[8pt]">반려</span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    );
  };

  // 결재 완료 시 학부모 출력물/조회 화면에만 날인되는 교감 원본대조필 직인
  const renderCertifiedCopyStamp = () => {
    // 1. 결재가 완료된 문서(approved)가 아니면 날인하지 않음
    // 2. 학교 보관용 원본(교직원 결재/문서함, isParentPortal === false)에는 날인하지 않음 (학부모 출력물/포털 전용)
    if (doc.status !== 'approved' || !isParentPortal) return null;

    const vpApprover = matchApprover('교감') || doc.approvers?.find(a => a.role?.includes('교감'));
    const vpEmail = vpApprover?.email?.trim().toLowerCase();
    const vpSignature = vpApprover?.signature || (vpEmail ? approverSignatures?.[vpEmail] : undefined);
    const vpName = vpApprover?.name || vpApprover?.approverName || '교감';

    return (
      <div className="flex flex-col items-end select-none shrink-0 pointer-events-none z-20">
        <div className="relative w-[220px] h-[46px]">
          <img 
            src="/images/original_copy_stamp.png" 
            alt="원본대조필" 
            className="w-full h-full object-contain mix-blend-multiply" 
          />
          {/* 직인 우측 네모 칸(약 52px x 46px)에 교감 선생님 직인/서명 날인 - 상단 결재란(48px~50px)과 1:1 동일 크기 */}
          <div className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[48px] h-[44px] flex items-center justify-center">
            {vpSignature ? (
              <img 
                src={vpSignature} 
                alt="교감 직인" 
                className="w-[42px] h-[42px] object-contain mix-blend-multiply" 
              />
            ) : (
              <span className="text-[9pt] font-bold text-red-700 font-serif leading-none tracking-tighter">
                {vpName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const parentName = doc.requesterName || "설정에서 학부모 이름을 등록해주세요";
  const parentSignature = doc.requesterSignature;
  const tripTypes = ['가족동반여행', '친·인척 방문', '답사·견학 활동', '체험활동', '기타'];

  // ─────────────── <서식 2> 교외체험학습 결과보고서 (A4 1페이지 독립 서식) ───────────────
  const renderReportPage = (isPage2: boolean = false) => (
    <div 
      className={`a4-print-sheet bg-white mx-auto text-black font-serif text-[10pt] shadow-2xl relative ${isPage2 ? 'mt-8' : ''}`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        height: '297mm',
        maxHeight: '297mm',
        padding: '10mm 15mm 10mm 15mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        fontFamily: '"Batang", "Nanum Myeongjo", "Apple SD Gothic Neo", "Malgun Gothic", serif',
        ...(isPage2 ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}),
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 pr-2 pt-0.5">
            <div className="mb-0.5 text-[8.5pt] text-slate-700 text-left">{'<서식 2>'}</div>
            <div className="text-center pr-2">
              <h1 className="text-[16pt] font-extrabold tracking-tight whitespace-nowrap leading-tight">
                「학교장허가 교외체험학습」 결과보고서
              </h1>
              <p className="text-red-600 font-bold text-[8pt] mt-0.5 text-center">
                (체험학습 실시 후 7일 이내 제출)
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {renderApprovers()}
          </div>
        </div>

        {/* 본문 테이블 */}
        <table 
          className="w-full text-center text-[9pt]"
          style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <tbody>
            <tr style={{ height: '34px' }}>
              <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">성 명</div>
              </th>
              <td className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.studentName}</div>
              </td>
              <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">학 년 &nbsp; 반 &nbsp; 번</div>
              </th>
              <td className="text-center whitespace-nowrap font-medium text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{grade ? `${grade}학년 ${studentClass}반 ${number}번` : data.gradeClassNumber}</div>
              </td>
              <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">휴대폰</div>
              </th>
              <td className="text-center whitespace-nowrap font-medium text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.phone}</div>
              </td>
            </tr>
            <tr style={{ height: '34px' }}>
              <th className="font-bold leading-tight text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">교외체험학습<br/>기간</div>
              </th>
              <td colSpan={3} className="text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-start h-full min-h-[34px] leading-tight">
                  {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, &nbsp; 총 ( <b>{data.tripPeriod?.totalDays}</b> ) 일간
                </div>
              </td>
              <th className="font-bold text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">학습형태</div>
              </th>
              <td className="text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.tripType}</div>
              </td>
            </tr>
            <tr style={{ height: '32px' }}>
              <th className="font-bold text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[32px] leading-tight">교외체험학습<br/>장소</div>
              </th>
              <td colSpan={5} className="text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-start h-full min-h-[32px] leading-tight">{data.destination}</div>
              </td>
            </tr>
            <tr style={{ height: '32px' }}>
              <th className="font-bold text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[32px] leading-tight">제 목</div>
              </th>
              <td colSpan={5} className="text-left font-bold text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-start h-full min-h-[32px] leading-tight">{reportTitle}</div>
              </td>
            </tr>
            {/* 결과보고서 내용 영역 (370px) */}
            <tr style={{ height: '370px' }}>
              <th className="leading-snug text-[8.5pt] font-bold text-center break-keep" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '2mm 4px', verticalAlign: 'middle', wordBreak: 'keep-all' }}>
                교외<br/>체험학습<br/>결과
              </th>
              <td colSpan={5} className="text-left align-top whitespace-pre-wrap text-[8.5pt] leading-relaxed break-keep" style={{ border: '1px solid #000000', padding: '12px 14px', verticalAlign: 'top', wordBreak: 'keep-all' }}>
                <p className="text-gray-400 text-xs mb-1 select-none print:hidden font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</p>
                {reportContent || <span className="text-gray-400 font-sans">(작성된 결과보고서 내용)</span>}
              </td>
            </tr>
            {/* 제출 서약 및 서명 영역 */}
            <tr style={{ height: '110px' }}>
              <td colSpan={6} className="relative text-center" style={{ border: '1px solid #000000', padding: '10px 14px', verticalAlign: 'middle' }}>
                <div className="text-center font-bold text-[10pt] mb-1.5">
                  위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                </div>
                <div className="text-center font-bold mb-2 text-[9pt]">
                  {reportSubmittedAt ? format(new Date(reportSubmittedAt), 'yyyy 년 MM 월 dd 일') : format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div className="flex justify-end pr-8 items-center mb-1.5 text-[9pt] whitespace-nowrap">
                  <div className="inline-flex items-center whitespace-nowrap">
                    <span className="font-bold mr-1.5 whitespace-nowrap">보호자 :</span>
                    <span className="min-w-[70px] text-center font-bold mr-2 text-blue-800 whitespace-nowrap">{parentName}</span>
                    <span className="relative inline-block text-center w-8 ml-1 whitespace-nowrap">
                      <span className="font-medium">(인)</span>
                      {parentSignature && (
                        <img 
                          src={parentSignature} 
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                          alt="sig" 
                        />
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-center font-black text-[13pt] tracking-widest mt-1">
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* 본문 표와 하단 안내문구 영역 */}
      <div 
        className="flex justify-between items-end shrink-0" 
        style={{ marginTop: '6mm', paddingTop: '2px', borderTop: '1px solid transparent' }}
      >
        <div className="text-[7.5pt] leading-tight space-y-0.5 text-gray-700 max-w-[480px]">
          <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
          <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
          <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
        </div>
        {/* 결재 완료 시 교감 원본대조필 날인 */}
        {renderCertifiedCopyStamp()}
      </div>
    </div>
  );

  // ─────────────── <서식 1> 교외체험학습 신청서 (A4 1페이지 독립 서식) ───────────────
  const renderApplicationPage = (hasPage2: boolean = false) => (
    <div 
      className={`a4-print-sheet bg-white mx-auto text-black font-serif text-[10pt] shadow-2xl relative ${hasPage2 ? 'mb-8' : ''}`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        height: '297mm',
        maxHeight: '297mm',
        padding: '10mm 15mm 10mm 15mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        fontFamily: '"Batang", "Nanum Myeongjo", "Apple SD Gothic Neo", "Malgun Gothic", serif',
        ...(hasPage2 ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}),
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        {/* 상단 제목 & 결재란 (제목과 부제 중앙 정렬) */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 pr-2 pt-0.5">
            <div className="mb-0.5 text-[8.5pt] text-slate-700 text-left">{'<서식 1>'}</div>
            <div className="text-center pr-2">
              <h1 className="text-[16pt] font-extrabold tracking-tight whitespace-nowrap leading-tight">
                「학교장허가 교외체험학습」 신청서
              </h1>
              <p className="text-red-600 font-bold text-[8.5pt] mt-0.5 text-center">
                (체험학습 실시 7일전 제출)
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {renderApprovers()}
          </div>
        </div>

        {/* 본문 테이블 */}
        <table 
          className="w-full text-center text-[9pt]" 
          style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <tbody>
            {/* 1. 성명 / 학년 반 번 / 휴대폰 */}
            <tr style={{ height: '34px' }}>
              <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">성 명</div>
              </th>
              <td className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.studentName}</div>
              </td>
              <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">학 년 &nbsp; 반 &nbsp; 번</div>
              </th>
              <td className="text-center whitespace-nowrap font-medium text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{grade ? `${grade}학년 ${studentClass}반 ${number}번` : data.gradeClassNumber}</div>
              </td>
              <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">휴대폰</div>
              </th>
              <td className="text-center whitespace-nowrap font-medium text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.phone}</div>
              </td>
            </tr>

            {/* 2. 본교 출석인정기간 (rowSpan 3) / 신청 기간 */}
            <tr style={{ height: '34px' }}>
              <th rowSpan={3} className="text-red-600 font-bold text-[8pt] break-keep text-center" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '4px', verticalAlign: 'middle', wordBreak: 'keep-all' }}>
                <div className="flex flex-col items-center justify-center h-full leading-tight">
                  <span>본교 출석인정기간</span>
                  <span className="text-[7pt] font-semibold text-red-500 block mt-1">(휴일 제외, 학기당 7일,<br/>연간 14일)</span>
                </div>
              </th>
              <th className="font-bold text-[8.5pt] text-center whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">신청 기간</div>
              </th>
              <td colSpan={4} className="text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-start h-full min-h-[34px] leading-tight">
                  {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, &nbsp; 총 ( <b>{data.tripPeriod?.totalDays}</b> ) 일간
                </div>
              </td>
            </tr>

            {/* 3. 연간 누적 일수 */}
            <tr style={{ height: '34px' }}>
              <th className="font-bold text-[8pt] text-center break-keep" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle', wordBreak: 'keep-all' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">연간 체험학습<br/>누적 일수</div>
              </th>
              <td colSpan={4} className="text-left text-[8.5pt] break-keep" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle', wordBreak: 'keep-all' }}>
                <div className="flex items-center justify-start h-full min-h-[34px] leading-tight">
                  기존 사용 일수 및 금번 신청 일수 포함 총 ( {data.cumulativeDays ?? 0} + {data.tripPeriod?.totalDays ?? 0} = <b>{(data.cumulativeDays ?? 0) + (data.tripPeriod?.totalDays ?? 0)}</b> ) 일
                </div>
              </td>
            </tr>

            {/* 4. 불인정 기간 및 사유 안내 테이블 (외곽 2mm 여백 및 Flex 수직 중앙 정렬) */}
            <tr>
              <td colSpan={5} className="bg-white text-left" style={{ border: '1px solid #000000', padding: '2mm', verticalAlign: 'middle' }}>
                <div className="text-[7.5pt] font-bold text-gray-800 flex items-center justify-between" style={{ padding: '0 2mm', marginBottom: '2mm' }}>
                  <span>※ 허용 일수 초과 시, 초과 일수는 [미인정결석] 처리됨.</span>
                  <span className="text-red-600 font-bold">※ 체험학습 신청 불가 기간</span>
                </div>
                <table className="w-full text-center text-[7.5pt]" style={{ width: '100%', margin: '0', borderCollapse: 'collapse', border: '1px solid #000000' }}>
                  <thead>
                    <tr style={{ height: '22px', backgroundColor: '#f8fafc' }}>
                      <th className="font-bold w-[46%]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                        <div className="flex items-center justify-center h-full min-h-[22px] leading-tight">체험학습 불인정 기간</div>
                      </th>
                      <th className="font-bold w-[54%]" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                        <div className="flex items-center justify-center h-full min-h-[22px] leading-tight">사 유</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS).map((bp, i) => (
                      <tr key={bp.id || i} style={{ height: '22px' }}>
                        <td className="font-mono text-[7.5pt] whitespace-nowrap text-center" style={{ border: '1px solid #000000', padding: '0 6px', verticalAlign: 'middle' }}>
                          <div className="flex items-center justify-center h-full min-h-[22px] leading-tight">
                            {bp.startDate.replace(/-/g, '.')} ~ {bp.endDate.replace(/-/g, '.')}
                          </div>
                        </td>
                        <td className="text-left text-[7.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', padding: '0 8px', verticalAlign: 'middle' }}>
                          <div className="flex items-center justify-start h-full min-h-[22px] leading-tight">
                            {bp.reason}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* 5. 학습형태 */}
            <tr style={{ height: '32px' }}>
              <th className="font-bold text-[8.5pt] text-center whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[32px] leading-tight">학습형태</div>
              </th>
              <td colSpan={5} className="text-left text-[8.5pt] break-keep" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle', wordBreak: 'keep-all' }}>
                <div className="flex items-center justify-start h-full min-h-[32px] leading-tight flex-wrap">
                  {tripTypes.map(t => (
                    <span key={t} className="inline-block mr-3">
                      ◦ {t}( {data.tripType === t ? 'O' : ' '} )
                    </span>
                  ))}
                </div>
              </td>
            </tr>

            {/* 6. 방문 장소 */}
            <tr style={{ height: '32px' }}>
              <th className="font-bold text-[8.5pt] text-center whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[32px] leading-tight">방문 장소</div>
              </th>
              <td colSpan={5} className="text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-start h-full min-h-[32px] leading-tight">{data.destination}</div>
              </td>
            </tr>

            {/* 7. 보호자(인솔자)명 / 관계 / 휴대폰 */}
            <tr style={{ height: '34px' }}>
              <th className="font-bold text-[8pt] text-center leading-tight whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 2px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">보호자<br/>(인솔자)명</div>
              </th>
              <td className="font-bold text-center text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.companionName}</div>
              </td>
              <th className="font-bold text-[8.5pt] text-center whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 2px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">관계</div>
              </th>
              <td className="text-center text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.companionRelation}</div>
              </td>
              <th className="font-bold text-[8.5pt] text-center whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 2px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">휴대폰</div>
              </th>
              <td className="text-center text-[8.5pt] whitespace-nowrap" style={{ border: '1px solid #000000', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">{data.phone}</div>
              </td>
            </tr>

            {/* 8. 목적 */}
            <tr style={{ height: '32px' }}>
              <th className="font-bold text-[8.5pt] text-center whitespace-nowrap" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-center h-full min-h-[32px] leading-tight">목 적</div>
              </th>
              <td colSpan={5} className="text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                <div className="flex items-center justify-start h-full min-h-[32px] leading-tight">{data.purpose}</div>
              </td>
            </tr>

            {/* 9. 계획 (2cm 축소하여 170px로 최적화) */}
            <tr style={{ height: '170px' }}>
              <th className="leading-snug text-[8.5pt] font-bold text-center break-keep" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '2mm 4px', verticalAlign: 'middle', wordBreak: 'keep-all' }}>
                교외체험학습<br/>계획<br/>
                <span className="text-[7.5pt] font-normal text-slate-500 leading-tight block mt-0.5">(일정, 기대<br/>효과 등)</span>
              </th>
              <td colSpan={5} className="text-left align-top whitespace-pre-wrap text-[8.5pt] leading-relaxed break-keep" style={{ border: '1px solid #000000', padding: '10px 12px', verticalAlign: 'top', wordBreak: 'keep-all' }}>
                {data.detailedPlan}
              </td>
            </tr>

            {/* 10. 신청 서약 & 서명 (안정적인 110px 높이) */}
            <tr style={{ height: '110px' }}>
              <td colSpan={6} className="relative text-center" style={{ border: '1px solid #000000', padding: '10px 14px', verticalAlign: 'middle' }}>
                <div className="text-center font-bold text-[10pt] mb-1.5">
                  위와 같이 「학교장허가 교외체험학습」을 신청합니다.
                </div>
                <div className="text-center font-bold mb-2 text-[9pt]">
                  {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div className="flex justify-end pr-8 items-center mb-1.5 text-[9pt] whitespace-nowrap">
                  <div className="inline-flex items-center whitespace-nowrap">
                    <span className="font-bold mr-1.5 whitespace-nowrap">보호자 :</span>
                    <span className="min-w-[70px] text-center font-bold mr-2 text-blue-800 whitespace-nowrap">{parentName}</span>
                    <span className="relative inline-block text-center w-8 ml-1 whitespace-nowrap">
                      <span className="font-medium">(인)</span>
                      {parentSignature && (
                        <img 
                          src={parentSignature} 
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                          alt="sig" 
                        />
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-center font-black text-[13pt] tracking-widest mt-1">
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* 본문 표와 하단 안내문구 영역 (여백 6mm로 안전하게 A4 1페이지 내 수용) */}
      <div 
        className="flex justify-between items-end shrink-0"
        style={{ marginTop: '6mm', paddingTop: '2px', borderTop: '1px solid transparent' }}
      >
        <div className="text-[7.5pt] leading-tight space-y-0.5 text-gray-700 max-w-[480px]">
          <p>※ 보호자가 신청서를 제출하였다 하여 체험학습이 허가된 것이 아니며 담임교사로부터 반드시 최종 허가 여부 통보를 받은 후 실시해야 함.</p>
          <p>※ 신청서 제출 기한은 체험학습 실시 7일 이전, 보고서 제출 기한은 체험학습 종료 후 7일 이내</p>
          <p>※ 체험학습 신청서는 교육적인 내용으로 구체적이고 자세하게 기록해야 함.</p>
        </div>
        {/* 결재 완료 시 교감 원본대조필 날인 */}
        {renderCertifiedCopyStamp()}
      </div>
    </div>
  );

  // ─────────────── <서식 3> 결석계 (A4 1페이지 독립 서식) ───────────────
  const renderAbsencePage = () => (
    <div 
      className="a4-print-sheet bg-white mx-auto text-black font-serif text-[10pt] shadow-2xl relative"
      style={{
        width: '210mm',
        minHeight: '297mm',
        height: '297mm',
        maxHeight: '297mm',
        padding: '10mm 15mm 10mm 15mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        fontFamily: '"Batang", "Nanum Myeongjo", "Apple SD Gothic Neo", "Malgun Gothic", serif',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        {/* 상단 표제 & 제목 & 결재란 */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 pr-2 pt-0.5">
                <div className="mb-0.5 text-[8.5pt] text-slate-700 text-left font-serif">{'<서식 3>'}</div>
                <div className="text-center pr-2">
                  <h1 className="text-[18pt] font-extrabold tracking-[0.4em] leading-tight">
                    결 석 계
                  </h1>
                  <p className="text-red-600 font-bold text-[8pt] mt-0.5 text-center">
                    (결석한 날부터 5일 이내 제출)
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {renderApprovers()}
              </div>
            </div>

            {/* 본문 테이블 1 (결석계) */}
            <table 
              className="w-full text-[9pt]"
              style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '120px' }} />
                <col style={{ width: 'auto' }} />
              </colgroup>
              <tbody>
                <tr style={{ height: '34px' }}>
                  <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">소 속</div>
                  </th>
                  <td className="font-medium text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-start h-full min-h-[34px] leading-tight">
                      호치민시한국국제학교 &nbsp;&nbsp;&nbsp; {grade} 학년 &nbsp;( &nbsp;{studentClass}&nbsp; )반 &nbsp;( &nbsp;{number}&nbsp; )번
                    </div>
                  </td>
                </tr>
                <tr style={{ height: '34px' }}>
                  <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">학 생 명</div>
                  </th>
                  <td className="font-bold text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-start h-full min-h-[34px] leading-tight">{data.studentName}</div>
                  </td>
                </tr>
                <tr style={{ height: '34px' }}>
                  <td colSpan={2} className="text-center text-[9pt] font-medium" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">
                      위 학생은 다음과 같은 사유로 결석하였기에 결석계를 제출합니다.
                    </div>
                  </td>
                </tr>
                <tr style={{ height: '34px' }}>
                  <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '0 4px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center h-full min-h-[34px] leading-tight">결석기간</div>
                  </th>
                  <td className="text-left text-[8.5pt]" style={{ border: '1px solid #000000', padding: '0 10px', verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-start h-full min-h-[34px] leading-tight">
                      {data.absencePeriod?.startDate} 부터 &nbsp;&nbsp; {data.absencePeriod?.endDate} 까지 &nbsp; ( <b>{data.absencePeriod?.totalDays}</b> 일간)
                    </div>
                  </td>
                </tr>
                {/* 결석사유 */}
                <tr style={{ height: '120px' }}>
                  <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '2mm 4px', verticalAlign: 'middle' }}>결석사유</th>
                  <td className="whitespace-pre-wrap align-top text-left leading-relaxed text-[8.5pt]" style={{ border: '1px solid #000000', padding: '10px 12px', verticalAlign: 'top' }}>{data.absenceReason}</td>
                </tr>
                {/* 서약 & 날짜 & 서명 영역 */}
                <tr style={{ height: '95px' }}>
                  <td colSpan={2} className="relative text-center" style={{ border: '1px solid #000000', padding: '10px 14px', verticalAlign: 'middle' }}>
                    <div className="text-center mb-2 text-[9pt] font-bold">
                      {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                    </div>
                    <div className="flex flex-col items-end pr-8 space-y-1.5 text-[8.5pt]">
                      <div className="flex items-center">
                        <span className="w-[50px] inline-flex justify-between font-medium">
                          <span>학</span><span>생</span>
                        </span>
                        <span className="w-[14px] text-center font-medium">:</span>
                        <span className="w-[80px] text-center font-bold text-black">{data.studentName}</span>
                        <span className="w-[30px] inline-block invisible">(인)</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-[50px] inline-flex justify-between font-medium">
                          <span>학</span><span>부</span><span>모</span>
                        </span>
                        <span className="w-[14px] text-center font-medium">:</span>
                        <span className="w-[80px] text-center font-bold text-blue-800">{parentName}</span>
                        <span className="w-[30px] inline-block relative text-center">
                          <span className="font-medium">(인)</span>
                          {parentSignature && (
                            <img 
                              src={parentSignature} 
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                              alt="sig" 
                            />
                          )}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 확인서 부제목 (여유 있는 중간 간격 확보) */}
            <div className="text-center my-2.5">
              <h2 className="text-[13pt] font-extrabold tracking-[0.4em]">확 인 서</h2>
            </div>

            {/* 본문 테이블 2 (확인서) */}
            <table 
              className="w-full text-[9pt]"
              style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', tableLayout: 'fixed' }}
            >
              <colgroup>
                <col style={{ width: '120px' }} />
                <col style={{ width: 'auto' }} />
              </colgroup>
              <tbody>
                {/* 구분 */}
                <tr style={{ height: '38px' }}>
                  <th className="font-bold text-center whitespace-nowrap text-[8.5pt]" style={{ border: '1px solid #000000', backgroundColor: '#f8fafc', padding: '2mm 4px', verticalAlign: 'middle' }}>구 분</th>
                  <td className="text-center leading-normal text-[8pt]" style={{ border: '1px solid #000000', padding: '2mm 10px', verticalAlign: 'middle' }}>
                    {teacherMode ? (
                      <div className="flex gap-4 justify-center items-center h-full">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '병결'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '병결' })} /> 병결</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '미인정'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '미인정' })} /> 미인정</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '기타'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '기타' })} /> 기타</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '출석인정'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '출석인정' })} /> 출석인정</label>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div>
                          병결 [ {data.absenceType === '병결' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;&nbsp;
                          미인정 결석 [ {data.absenceType === '미인정' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;&nbsp;
                          기타결 [ {data.absenceType === '기타' ? 'O' : ' '} ]
                        </div>
                        <div>
                          출석인정(경조사, 법정전염병, 생리결석, 비자) [ {data.absenceType === '출석인정' ? 'O' : ' '} ]
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
                {/* 확인 내용 영역 */}
                <tr style={{ height: '150px' }}>
                  <td colSpan={2} className="align-top text-left" style={{ border: '1px solid #000000', padding: '12px 14px', verticalAlign: 'top' }}>
                    <div className="text-center mb-2 font-bold text-[9.5pt]">위 제출 내용이 사실과 다름없음을 확인함.</div>
                    <div className="space-y-1.5 text-[8.5pt] leading-relaxed">
                      {teacherMode ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span>1. 확인방법:</span>
                            <label className="flex items-center gap-1 cursor-pointer ml-2"><input type="radio" name="confirmMethod" checked={teacherData?.confirmMethod === '전화/문자'} onChange={() => onTeacherDataChange?.({ ...teacherData, confirmMethod: '전화/문자' })} /> 전화/문자</label>
                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="confirmMethod" checked={teacherData?.confirmMethod === '학부모 내교'} onChange={() => onTeacherDataChange?.({ ...teacherData, confirmMethod: '학부모 내교' })} /> 학부모 내교</label>
                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="confirmMethod" checked={teacherData?.confirmMethod === '가정방문'} onChange={() => onTeacherDataChange?.({ ...teacherData, confirmMethod: '가정방문' })} /> 가정방문</label>
                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="confirmMethod" checked={teacherData?.confirmMethod === '기타'} onChange={() => onTeacherDataChange?.({ ...teacherData, confirmMethod: '기타' })} /> 기타</label>
                          </div>
                          <p>2. 확인내용: 결석 사유와 동일함을 확인합니다.</p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span>3. 확인일시:</span>
                            <input type="date" className="border px-2 py-0.5 rounded text-xs" value={teacherData?.confirmDate || ''} onChange={(e) => onTeacherDataChange?.({ ...teacherData, confirmDate: e.target.value })} />
                          </div>
                        </>
                      ) : (
                        <>
                          <p>1. 확인방법: 전화/문자({data.teacherConfirmMethod === '전화/문자' ? 'O' : ' '}), 학부모 내교({data.teacherConfirmMethod === '학부모 내교' ? 'O' : ' '}), 가정방문({data.teacherConfirmMethod === '가정방문' ? 'O' : ' '}), 기타({data.teacherConfirmMethod === '기타' ? 'O' : ' '})</p>
                          <p>2. 확인내용: 결석 사유와 동일함을 확인합니다.</p>
                          <p>3. 확인일시: {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}</p>
                        </>
                      )}
                    </div>
                    {!teacherMode && (
                      <div className="text-center mt-5 text-[9.5pt] font-medium">
                        {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div 
            className="flex justify-end items-end shrink-0" 
            style={{ marginTop: '6mm', paddingTop: '2px', borderTop: '1px solid transparent' }}
          >
            {/* 결재 완료 시 교감 원본대조필 날인 */}
            {renderCertifiedCopyStamp()}
          </div>
        </div>
  );

  // 모바일 화면 축소(Scale-to-fit)를 지원하는 래퍼
  const wrapWithScale = (content: React.ReactNode, key?: string | number) => {
    const isScaled = scale < 1;
    // A4 높이 약 1123px (297mm)
    const scaledHeight = Math.ceil(1123 * scale);

    return (
      <div 
        key={key} 
        className="w-full flex justify-center overflow-visible my-1 sm:my-3 print:my-0 print:block"
        style={isScaled ? { height: `${scaledHeight}px` } : undefined}
      >
        <div 
          style={isScaled ? {
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: '210mm',
            minWidth: '210mm',
            marginBottom: 0
          } : undefined}
          className="print:transform-none shrink-0"
        >
          {content}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="parent-form-view-wrapper w-full font-serif text-black overflow-x-hidden print:overflow-visible">
      {isAbsence ? (
        /* ─────────────── <서식 3> 결석계 ─────────────── */
        wrapWithScale(renderAbsencePage(), 'absence-page')
      ) : isReport ? (
        /* ─────────────── <서식 2> 교외체험학습 결과보고서 (단독 문서 열람) ─────────────── */
        wrapWithScale(renderReportPage(false), 'report-single-page')
      ) : (
        /* ─────────────── <서식 1> 교외체험학습 신청서 (결과보고서 제출시 2페이지 연동 인쇄) ─────────────── */
        <>
          {wrapWithScale(renderApplicationPage(hasReport), 'app-page')}
          {hasReport && wrapWithScale(renderReportPage(true), 'report-page')}
        </>
      )}
    </div>
  );
}
