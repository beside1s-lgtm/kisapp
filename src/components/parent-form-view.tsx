'use client';

import React from 'react';
import { ApprovalDoc, ParentFormData } from '@/lib/types';
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
};

export function ParentFormView({ doc, teacherMode, teacherData, onTeacherDataChange, approverSignatures }: ParentFormViewProps) {
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

  // 승인자 목록 매핑 (직책 1줄 고정, 깔끔한 4칸 담임, 부장, 교감, 교장)
  const renderApprovers = () => {
    const slots = ['담임', '부장', '교감', '교장'];
    return (
      <table className="border-collapse border border-black w-[240px] text-[8.5pt] ml-auto shrink-0 not-w-full" style={{ width: '240px' }}>
        <tbody>
          <tr>
            <th rowSpan={2} className="border border-black bg-slate-50/60 w-[24px] text-center font-bold px-0.5 text-[8pt] leading-tight">결<br/>재</th>
            {slots.map((role, idx) => (
              <th key={idx} className="border border-black bg-slate-50/60 text-center font-bold py-1 px-1 text-[8.5pt] whitespace-nowrap">{role}</th>
            ))}
          </tr>
          <tr className="h-[52px]">
            {slots.map((role, idx) => {
              const approver = doc.approvers?.find(a => a.role === role);
              const signature = approver?.signature || (approver ? approverSignatures?.[approver.email.toLowerCase()] : undefined);
              return (
                <td key={idx} className="border border-black text-center align-middle relative p-0.5 w-[54px]">
                  {approver && approver.status === 'approved' && signature && (
                    <>
                      {approver.type === 'final' && <span className="absolute top-0 right-0 text-[7pt] text-red-600 font-bold bg-white/95 px-0.5 z-10 leading-none">전결</span>}
                      <img src={signature} className="absolute inset-0 w-full h-full object-contain mix-blend-multiply p-0.5" alt="sig" />
                    </>
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

  const parentName = doc.requesterName || "설정에서 학부모 이름을 등록해주세요";
  const parentSignature = doc.requesterSignature;
  const tripTypes = ['가족동반여행', '친·인척 방문', '답사·견학 활동', '체험활동', '기타'];

  // ─────────────── <서식 2> 교외체험학습 결과보고서 (A4 1페이지 독립 서식) ───────────────
  const renderReportPage = (isPage2: boolean = false) => (
    <div 
      className={`a4-print-sheet bg-white mx-auto text-black font-serif text-[10pt] shadow-2xl ${isPage2 ? 'mt-8' : ''}`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        height: '297mm',
        maxHeight: '297mm',
        padding: '15mm 15mm 15mm 15mm',
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
        <div className="flex justify-between items-start mb-2.5">
          <div className="flex-1 pr-2 pt-0.5">
            <div className="mb-0.5 text-[9pt] text-slate-700 text-left">{'<서식 2>'}</div>
            <div className="text-center pr-2">
              <h1 className="text-[17pt] font-extrabold tracking-tight whitespace-nowrap leading-snug">
                「학교장허가 교외체험학습」 결과보고서
              </h1>
              <p className="text-red-600 font-bold text-[8.5pt] mt-0.5 text-center">
                (체험학습 실시 후 7일 이내 제출)
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {renderApprovers()}
          </div>
        </div>

        <table className="w-full border-collapse border border-black leading-tight text-center text-[9.5pt]">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <tbody>
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">성 명</th>
              <td className="border border-black font-bold text-center whitespace-nowrap px-1">{data.studentName}</td>
              <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">학 년 &nbsp; 반 &nbsp; 번</th>
              <td className="border border-black text-center whitespace-nowrap px-1 font-medium">{grade ? `${grade}학년 ${studentClass}반 ${number}번` : data.gradeClassNumber}</td>
              <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">휴대폰</th>
              <td className="border border-black text-center whitespace-nowrap px-1 font-medium">{data.phone}</td>
            </tr>
            <tr style={{ height: '40px' }}>
              <th className="border border-black bg-slate-50/60 font-bold leading-tight text-[9pt] whitespace-nowrap">교외체험학습<br/>기간</th>
              <td colSpan={3} className="border border-black text-left px-3 text-[9pt]">
                {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, &nbsp; 총 ( <b>{data.tripPeriod?.totalDays}</b> ) 일간
              </td>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] whitespace-nowrap">학습형태</th>
              <td className="border border-black text-[9pt]">{data.tripType}</td>
            </tr>
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] whitespace-nowrap">교외체험학습<br/>장소</th>
              <td colSpan={5} className="border border-black text-left px-3 text-[9pt]">{data.destination}</td>
            </tr>
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] whitespace-nowrap">제 목</th>
              <td colSpan={5} className="border border-black text-left px-3 font-bold text-[9pt]">{reportTitle}</td>
            </tr>
            {/* 결과보고서 내용 영역 (높이 450px로 꽉 차게 확장) */}
            <tr style={{ height: '450px' }}>
              <th className="border border-black bg-slate-50/60 leading-tight text-[9pt] font-bold break-keep" style={{ wordBreak: 'keep-all' }}>
                교외<br/>체험학습<br/>결과
              </th>
              <td colSpan={5} className="border border-black p-3 text-left align-top whitespace-pre-wrap text-[9pt] leading-relaxed break-keep" style={{ wordBreak: 'keep-all' }}>
                <p className="text-gray-400 text-xs mb-1.5 select-none print:hidden font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</p>
                {reportContent || <span className="text-gray-400 font-sans">(작성된 결과보고서 내용)</span>}
              </td>
            </tr>
            {/* 제출 서약 및 서명 영역 */}
            <tr style={{ height: '160px' }}>
              <td colSpan={6} className="border border-black py-4 px-3 relative">
                <div className="text-center font-bold text-[10.5pt] mb-2">
                  위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                </div>
                <div className="text-center font-bold mb-3 text-[9.5pt]">
                  {reportSubmittedAt ? format(new Date(reportSubmittedAt), 'yyyy 년 MM 월 dd 일') : format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div className="flex justify-end pr-12 items-center mb-2.5 text-[9.5pt]">
                  <span className="font-bold mr-2">보호자 : </span>
                  <span className="min-w-[80px] text-center font-bold mr-2 text-blue-800">{parentName}</span>
                  <span className="relative inline-block text-center w-8 ml-1">
                    <span className="font-medium">(인)</span>
                    {parentSignature && (
                      <img 
                        src={parentSignature} 
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                        alt="sig" 
                      />
                    )}
                  </span>
                </div>
                <div className="text-center font-black text-[14pt] tracking-widest mt-1">
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="text-[7.5pt] leading-relaxed space-y-0.5 mt-2 text-gray-700 shrink-0">
        <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
        <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
        <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
      </div>
    </div>
  );

  // ─────────────── <서식 1> 교외체험학습 신청서 (A4 1페이지 독립 서식) ───────────────
  const renderApplicationPage = (hasPage2: boolean = false) => (
    <div 
      className={`a4-print-sheet bg-white mx-auto text-black font-serif text-[10pt] shadow-2xl ${hasPage2 ? 'mb-8' : ''}`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        height: '297mm',
        maxHeight: '297mm',
        padding: '15mm 15mm 15mm 15mm',
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
        <div className="flex justify-between items-start mb-2.5">
          <div className="flex-1 pr-2 pt-0.5">
            <div className="mb-0.5 text-[9pt] text-slate-700 text-left">{'<서식 1>'}</div>
            <div className="text-center pr-2">
              <h1 className="text-[17pt] font-extrabold tracking-tight whitespace-nowrap leading-snug">
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

        {/* 본문 테이블 (성명 10%, 학년반번 20%, 휴대폰 12%/26% 완벽 정렬) */}
        <table className="w-full border-collapse border border-black leading-tight text-center text-[9.5pt]">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <tbody>
            {/* 1. 성명 / 학년 반 번 / 휴대폰 (깔끔한 1줄 가로 표기) */}
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">성 명</th>
              <td className="border border-black font-bold text-center whitespace-nowrap px-1">{data.studentName}</td>
              <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">학 년 &nbsp; 반 &nbsp; 번</th>
              <td className="border border-black text-center whitespace-nowrap px-1 font-medium">{grade ? `${grade}학년 ${studentClass}반 ${number}번` : data.gradeClassNumber}</td>
              <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">휴대폰</th>
              <td className="border border-black text-center whitespace-nowrap px-1 font-medium">{data.phone}</td>
            </tr>

            {/* 2. 본교 출석인정기간 / 신청 기간 */}
            <tr style={{ height: '40px' }}>
              <th rowSpan={2} className="border border-black bg-slate-50/60 text-red-600 font-bold text-[8pt] leading-tight px-1 break-keep text-center" style={{ wordBreak: 'keep-all' }}>
                본교 출석인정기간<br/>
                <span className="text-[7pt] font-semibold text-red-500">(휴일 제외, 학기당 7일,<br/>연간 14일)</span>
              </th>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center whitespace-nowrap">신청 기간</th>
              <td colSpan={4} className="border border-black text-left px-3 text-[9pt]">
                {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, &nbsp; 총 ( <b>{data.tripPeriod?.totalDays}</b> ) 일간
              </td>
            </tr>

            {/* 3. 연간 누적 일수 */}
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold leading-tight text-[8.5pt] text-center px-1 break-keep" style={{ wordBreak: 'keep-all' }}>
                연간 체험학습<br/>누적 일수
              </th>
              <td colSpan={4} className="border border-black text-left px-3 text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>
                기존 사용 일수 및 금번 신청 일수 포함 총 ( {data.cumulativeDays ?? 0} + {data.tripPeriod?.totalDays ?? 0} = <b>{(data.cumulativeDays ?? 0) + (data.tripPeriod?.totalDays ?? 0)}</b> ) 일
              </td>
            </tr>

            {/* 4. 학습형태 */}
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center whitespace-nowrap">학습형태</th>
              <td colSpan={5} className="border border-black text-left px-3 text-[8.5pt] break-keep" style={{ wordBreak: 'keep-all' }}>
                {tripTypes.map(t => (
                  <span key={t} className="inline-block mr-3">
                    ◦ {t}( {data.tripType === t ? 'O' : ' '} )
                  </span>
                ))}
              </td>
            </tr>

            {/* 5. 방문 장소 */}
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center whitespace-nowrap">방문 장소</th>
              <td colSpan={5} className="border border-black text-left px-3 text-[9pt]">{data.destination}</td>
            </tr>

            {/* 6. 보호자(인솔자)명 / 관계 / 휴대폰 */}
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center leading-tight whitespace-nowrap">
                보호자<br/>(인솔자)명
              </th>
              <td className="border border-black font-bold text-center px-1 text-[9pt] whitespace-nowrap">{data.companionName}</td>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center whitespace-nowrap">관계</th>
              <td className="border border-black text-center px-1 text-[9pt] whitespace-nowrap">{data.companionRelation}</td>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center whitespace-nowrap">휴대폰</th>
              <td className="border border-black text-center px-1 text-[9pt] whitespace-nowrap">{data.phone}</td>
            </tr>

            {/* 7. 목적 */}
            <tr style={{ height: '36px' }}>
              <th className="border border-black bg-slate-50/60 font-bold text-[9pt] text-center whitespace-nowrap">목 적</th>
              <td colSpan={5} className="border border-black text-left px-3 text-[9pt]">{data.purpose}</td>
            </tr>

            {/* 8. 계획 (높이 340px로 꽉 차게 확장) */}
            <tr style={{ height: '340px' }}>
              <th className="border border-black bg-slate-50/60 leading-tight text-[9pt] font-bold text-center break-keep" style={{ wordBreak: 'keep-all' }}>
                교외체험학습<br/>계획<br/>
                <span className="text-[8pt] font-normal text-slate-500">(일정, 기대<br/>효과 등)</span>
              </th>
              <td colSpan={5} className="border border-black p-3 text-left align-top whitespace-pre-wrap text-[9pt] leading-relaxed break-keep" style={{ wordBreak: 'keep-all' }}>
                {data.detailedPlan}
              </td>
            </tr>

            {/* 9. 신청 서약 & 서명 */}
            <tr style={{ height: '160px' }}>
              <td colSpan={6} className="border border-black py-4 px-3 relative">
                <div className="text-center font-bold text-[10.5pt] mb-2">
                  위와 같이 「학교장허가 교외체험학습」을 신청합니다.
                </div>
                <div className="text-center font-bold mb-3 text-[9.5pt]">
                  {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div className="flex justify-end pr-12 items-center mb-2.5 text-[9.5pt]">
                  <span className="font-bold mr-2">보호자 : </span>
                  <span className="min-w-[80px] text-center font-bold mr-2 text-blue-800">{parentName}</span>
                  <span className="relative inline-block text-center w-8 ml-1">
                    <span className="font-medium">(인)</span>
                    {parentSignature && (
                      <img 
                        src={parentSignature} 
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 max-w-none object-contain mix-blend-multiply pointer-events-none z-10" 
                        alt="sig" 
                      />
                    )}
                  </span>
                </div>
                <div className="text-center font-black text-[14pt] tracking-widest mt-1">
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="text-[7.5pt] leading-relaxed space-y-0.5 mt-2 text-gray-700 shrink-0">
        <p>※ 보호자가 신청서를 제출하였다 하여 체험학습이 허가된 것이 아니며 담임교사로부터 반드시 최종 허가 여부 통보를 받은 후 실시해야 함.</p>
        <p>※ 신청서 제출 기한은 체험학습 실시 7일 이전, 보고서 제출 기한은 체험학습 종료 후 7일 이내</p>
        <p>※ 체험학습 신청서는 교육적인 내용으로 구체적이고 자세하게 기록해야 함.</p>
      </div>
    </div>
  );

  return (
    <div className="parent-form-view-wrapper w-full font-serif text-black">
      {isAbsence ? (
        /* ─────────────── <서식 3> 결석계 ─────────────── */
        <div 
          className="a4-print-sheet bg-white mx-auto text-black font-serif text-[10pt] shadow-2xl"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '14mm 15mm 14mm 15mm',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: '"Batang", "Nanum Myeongjo", "Apple SD Gothic Neo", "Malgun Gothic", serif',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            {/* 상단 표제 & 제목 & 결재란 */}
            <div className="flex justify-between items-start mb-2.5">
              <div className="flex-1 pr-2 pt-0.5">
                <div className="mb-0.5 text-[9.5pt] text-slate-700 text-left font-serif">{'<서식 3>'}</div>
                <div className="text-center pr-2">
                  <h1 className="text-[20pt] font-extrabold tracking-[0.4em] leading-tight">
                    결 석 계
                  </h1>
                  <p className="text-red-600 font-bold text-[8.5pt] mt-0.5 text-center">
                    (결석한 날부터 5일 이내 제출)
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {renderApprovers()}
              </div>
            </div>

            {/* 본문 테이블 1 (결석계) */}
            <table className="w-full border-collapse border border-black leading-normal text-[9.5pt]">
              <tbody>
                <tr style={{ height: '36px' }}>
                  <th className="border border-black bg-slate-50/60 w-[110px] font-bold text-center whitespace-nowrap">소 속</th>
                  <td className="border border-black px-4 font-medium text-left">
                    호치민시한국국제학교 &nbsp;&nbsp;&nbsp; {grade} 학년 &nbsp;( &nbsp;{studentClass}&nbsp; )반 &nbsp;( &nbsp;{number}&nbsp; )번
                  </td>
                </tr>
                <tr style={{ height: '36px' }}>
                  <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">학 생 명</th>
                  <td className="border border-black px-4 font-bold text-left">{data.studentName}</td>
                </tr>
                <tr style={{ height: '40px' }}>
                  <td colSpan={2} className="border border-black px-4 text-center text-[10pt] font-medium">
                    위 학생은 다음과 같은 사유로 결석하였기에 결석계를 제출합니다.
                  </td>
                </tr>
                <tr style={{ height: '36px' }}>
                  <th className="border border-black bg-slate-50/60 font-bold text-center whitespace-nowrap">결석기간</th>
                  <td className="border border-black px-4 text-left">
                    {data.absencePeriod?.startDate} 부터 &nbsp;&nbsp; {data.absencePeriod?.endDate} 까지 &nbsp; ( <b>{data.absencePeriod?.totalDays}</b> 일간)
                  </td>
                </tr>
                {/* 결석사유 */}
                <tr style={{ height: '150px' }}>
                  <th className="border border-black bg-slate-50/60 font-bold text-center align-middle whitespace-nowrap">결석사유</th>
                  <td className="border border-black p-3.5 whitespace-pre-wrap align-top text-left leading-relaxed text-[9.5pt]">{data.absenceReason}</td>
                </tr>
                {/* 서약 & 날짜 & 서명 영역 */}
                <tr style={{ height: '115px' }}>
                  <td colSpan={2} className="border border-black p-3.5 relative">
                    <div className="text-center mb-3 text-[10pt] font-bold">
                      {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                    </div>
                    <div className="flex flex-col items-end pr-10 space-y-2 text-[9.5pt]">
                      <div className="flex items-center">
                        <span className="w-[54px] inline-flex justify-between font-medium">
                          <span>학</span><span>생</span>
                        </span>
                        <span className="w-[18px] text-center font-medium">:</span>
                        <span className="w-[90px] text-center font-bold text-black">{data.studentName}</span>
                        <span className="w-[36px] inline-block invisible">(인)</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-[54px] inline-flex justify-between font-medium">
                          <span>학</span><span>부</span><span>모</span>
                        </span>
                        <span className="w-[18px] text-center font-medium">:</span>
                        <span className="w-[90px] text-center font-bold text-blue-800">{parentName}</span>
                        <span className="w-[36px] inline-block relative text-center">
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
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 확인서 부제목 (여유 있는 중간 간격 확보) */}
            <div className="text-center my-3.5">
              <h2 className="text-[14.5pt] font-extrabold tracking-[0.4em]">확 인 서</h2>
            </div>

            {/* 본문 테이블 2 (확인서) */}
            <table className="w-full border-collapse border border-black leading-normal text-[9.5pt]">
              <tbody>
                {/* 구분 2줄 텍스트 */}
                <tr style={{ height: '48px' }}>
                  <th className="border border-black bg-slate-50/60 w-[110px] font-bold text-center whitespace-nowrap">구 분</th>
                  <td className="border border-black px-4 py-1.5 text-center leading-normal text-[9pt]">
                    {teacherMode ? (
                      <div className="flex gap-4 justify-center items-center h-full">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '병결'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '병결' })} /> 병결</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '미인정'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '미인정' })} /> 미인정</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '기타'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '기타' })} /> 기타</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '출석인정'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '출석인정' })} /> 출석인정</label>
                      </div>
                    ) : (
                      <div className="space-y-1">
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
                <tr style={{ height: '200px' }}>
                  <td colSpan={2} className="border border-black p-4 align-top text-left">
                    <div className="text-center mb-3 font-bold text-[10.5pt]">위 제출 내용이 사실과 다름없음을 확인함.</div>
                    <div className="space-y-2 text-[9.5pt] leading-relaxed">
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
                          <div className="flex items-center gap-2 pt-1">
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
                      <div className="text-center mt-7 text-[10.5pt] font-medium">
                        {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : isReport ? (
        /* ─────────────── <서식 2> 교외체험학습 결과보고서 (단독 문서 열람) ─────────────── */
        renderReportPage(false)
      ) : (
        /* ─────────────── <서식 1> 교외체험학습 신청서 (결과보고서 제출시 2페이지 연동 인쇄) ─────────────── */
        <>
          {renderApplicationPage(hasReport)}
          {hasReport && renderReportPage(true)}
        </>
      )}
    </div>
  );
}
