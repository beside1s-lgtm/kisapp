'use client';

import React from 'react';
import { ApprovalDoc, ParentFormData } from '@/lib/types';
import { format } from 'date-fns';

type ParentDocumentPrintProps = {
  doc: ApprovalDoc;
  teacherConfirmData?: {
    absenceType?: '병결' | '미인정' | '기타' | '출석인정';
    confirmMethod?: '전화/문자' | '학부모 내교' | '가정방문' | '기타';
    confirmDate?: string;
  };
  approverSignatures?: Record<string, string>;
};

export const ParentDocumentPrint = React.forwardRef<HTMLDivElement, ParentDocumentPrintProps>(
  ({ doc, teacherConfirmData, approverSignatures = {} }, ref) => {
    const data = (doc.parentFormData || {}) as ParentFormData;
    if (!data || Object.keys(data).length === 0) {
      return <div ref={ref}>데이터가 없습니다.</div>;
    }

    const isAbsence = data.type === 'absence';
    const isReport = data.type === 'field-trip-report';

    // 보고서 내용 추출 (다양한 저장 형태 모두 완벽 대응)
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

    // 4칸 직책 결재란
    const renderApprovers = () => {
      const slots = ['담임', '부장', '교감', '교장'];
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

      return (
        <table style={{ borderCollapse: 'collapse', border: '1px solid #000', width: '240px', fontSize: '8.5pt', marginLeft: 'auto' }}>
          <tbody>
            <tr>
              <th rowSpan={2} style={{ border: '1px solid #000', backgroundColor: '#f8fafc', width: '24px', textAlign: 'center', fontWeight: 'bold', padding: '2px', fontSize: '8pt', lineHeight: 1.1 }}>
                결<br/>재
              </th>
              {slots.map((role, idx) => {
                const matched = matchApprover(role);
                const headerTitle = matched?.role && matched.role.length <= 4 ? matched.role : role;
                return (
                  <th key={idx} style={{ border: '1px solid #000', backgroundColor: '#f8fafc', textAlign: 'center', fontWeight: 'bold', padding: '3px 2px', fontSize: '8.5pt', whiteSpace: 'nowrap' }}>
                    {headerTitle}
                  </th>
                );
              })}
            </tr>
            <tr style={{ height: '50px' }}>
              {slots.map((role, idx) => {
                const approver = matchApprover(role);
                const approverEmail = approver?.email?.trim().toLowerCase();
                const signature = approver?.signature || (approverEmail && approverSignatures ? approverSignatures[approverEmail] : undefined);
                return (
                  <td key={idx} style={{ border: '1px solid #000', textAlign: 'center', verticalAlign: 'middle', position: 'relative', padding: '2px', width: '54px' }}>
                    {approver && approver.status === 'approved' && (
                      signature ? (
                        <>
                          {approver.type === 'final' && (
                            <span style={{ position: 'absolute', top: 0, right: 0, fontSize: '7pt', color: '#dc2626', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.95)', padding: '0 2px', zIndex: 10, lineHeight: 1 }}>
                              전결
                            </span>
                          )}
                          <img src={signature} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply', padding: '2px' }} alt="sig" />
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          {approver.type === 'final' && (
                            <span style={{ position: 'absolute', top: 0, right: 0, fontSize: '7pt', color: '#dc2626', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.95)', padding: '0 2px', zIndex: 10, lineHeight: 1 }}>
                              전결
                            </span>
                          )}
                          <span style={{ fontWeight: 'bold', fontSize: '8pt', color: '#1e293b', lineHeight: 1.1 }}>{approver.name || approver.approverName || '승인'}</span>
                          <span style={{ fontSize: '7pt', color: '#64748b', fontWeight: 'normal' }}>(서명)</span>
                        </div>
                      )
                    )}
                    {approver && approver.status === 'rejected' && (
                      <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '8pt' }}>반려</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      );
    };

    const parentName = doc.requesterName || "학부모";
    const parentSignature = doc.requesterSignature;
    const tripTypes = ['가족동반여행', '친·인척 방문', '답사·견학 활동', '체험활동', '기타'];

    // ─────────────── <서식 1> 교외체험학습 신청서 (A4 1장 고정 틀) ───────────────
    const renderApplicationPage = (isMultiPage: boolean) => (
      <div
        className="print-page-wrapper"
        style={{
          width: '210mm',
          height: '297mm',
          padding: '15mm 15mm 15mm 15mm',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          fontFamily: 'Batang, Noto Serif KR, serif',
          color: '#000000',
          margin: '0 auto',
          position: 'relative',
          display: 'block',
          ...(isMultiPage ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}),
        }}
      >
        {/* 상단 표제 & 결재란 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1, paddingRight: '8px', paddingTop: '2px' }}>
            <div style={{ fontSize: '9pt', color: '#334155', textAlign: 'left', marginBottom: '2px' }}>{'<서식 1>'}</div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '17pt', fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1.2, margin: 0 }}>
                「학교장허가 교외체험학습」 신청서
              </h1>
              <p style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '8.5pt', marginTop: '3px', marginBottom: 0, textAlign: 'center' }}>
                (체험학습 실시 7일전 제출)
              </p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            {renderApprovers()}
          </div>
        </div>

        {/* 본문 테이블 (A4 페이지를 꽉 채우는 216mm 높이 규격) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '9.5pt', textAlign: 'center', lineHeight: 1.2 }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <tbody>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>성 명</th>
              <td style={{ border: '1px solid #000', fontWeight: 'bold', whiteSpace: 'nowrap', padding: '0 4px' }}>{data.studentName}</td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>학 년 &nbsp; 반 &nbsp; 번</th>
              <td style={{ border: '1px solid #000', whiteSpace: 'nowrap', padding: '0 4px', fontWeight: 500 }}>{grade ? `${grade}학년 ${studentClass}반 ${number}번` : data.gradeClassNumber}</td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>휴대폰</th>
              <td style={{ border: '1px solid #000', whiteSpace: 'nowrap', padding: '0 4px', fontWeight: 500 }}>{data.phone}</td>
            </tr>
            <tr style={{ height: '42px' }}>
              <th rowSpan={2} style={{ border: '1px solid #000', backgroundColor: '#f8fafc', color: '#dc2626', fontWeight: 'bold', fontSize: '8pt', lineHeight: 1.15, padding: '2px', wordBreak: 'keep-all' }}>
                본교 출석인정기간<br/>
                <span style={{ fontSize: '7pt', fontWeight: 600, color: '#ef4444' }}>(휴일 제외, 학기당 7일,<br/>연간 14일)</span>
              </th>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>신청 기간</th>
              <td colSpan={4} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '9pt' }}>
                {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, &nbsp; 총 ( <b>{data.tripPeriod?.totalDays}</b> ) 일간
              </td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '8.5pt', lineHeight: 1.15, padding: '2px', wordBreak: 'keep-all' }}>
                연간 체험학습<br/>누적 일수
              </th>
              <td colSpan={4} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '9pt', wordBreak: 'keep-all' }}>
                기존 사용 일수 및 금번 신청 일수 포함 총 ( {data.cumulativeDays ?? 0} + {data.tripPeriod?.totalDays ?? 0} = <b>{(data.cumulativeDays ?? 0) + (data.tripPeriod?.totalDays ?? 0)}</b> ) 일
              </td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>학습형태</th>
              <td colSpan={5} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '8.5pt', wordBreak: 'keep-all' }}>
                {tripTypes.map(t => (
                  <span key={t} style={{ display: 'inline-block', marginRight: '12px' }}>
                    ◦ {t}( {data.tripType === t ? 'O' : ' '} )
                  </span>
                ))}
              </td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>방문 장소</th>
              <td colSpan={5} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '9pt' }}>{data.destination}</td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                보호자<br/>(인솔자)명
              </th>
              <td style={{ border: '1px solid #000', fontWeight: 'bold', padding: '0 4px', fontSize: '9pt', whiteSpace: 'nowrap' }}>{data.companionName}</td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>관계</th>
              <td style={{ border: '1px solid #000', padding: '0 4px', fontSize: '9pt', whiteSpace: 'nowrap' }}>{data.companionRelation}</td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>휴대폰</th>
              <td style={{ border: '1px solid #000', padding: '0 4px', fontSize: '9pt', whiteSpace: 'nowrap' }}>{data.phone}</td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>목 적</th>
              <td colSpan={5} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '9pt' }}>{data.purpose}</td>
            </tr>
            {/* 계획 영역 (365px 높이로 페이지를 가득 채움) */}
            <tr style={{ height: '365px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', padding: '6px 2px', lineHeight: 1.25, fontSize: '9pt', fontWeight: 'bold', wordBreak: 'keep-all' }}>
                교외체험학습<br/>계획<br/>
                <span style={{ fontSize: '8pt', fontWeight: 'normal', color: '#64748b' }}>(일정, 기대<br/>효과 등)</span>
              </th>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '10px', textAlign: 'left', verticalAlign: 'top', whiteSpace: 'pre-wrap', fontSize: '9pt', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                {data.detailedPlan}
              </td>
            </tr>
            {/* 서약 및 서명 영역 (160px 높이) */}
            <tr style={{ height: '160px' }}>
              <td colSpan={6} style={{ border: '1px solid #000', padding: '16px 10px', position: 'relative' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10.5pt', marginBottom: '8px' }}>
                  위와 같이 「학교장허가 교외체험학습」을 신청합니다.
                </div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '14px', fontSize: '9.5pt' }}>
                  {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '48px', marginBottom: '12px', fontSize: '9.5pt' }}>
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>보호자 : </span>
                  <span style={{ minWidth: '80px', textAlign: 'center', fontWeight: 'bold', marginRight: '8px', color: '#1e3a8a' }}>{parentName}</span>
                  <span style={{ position: 'relative', display: 'inline-block', textAlign: 'center', width: '32px', marginLeft: '4px' }}>
                    <span style={{ fontWeight: 500 }}>(인)</span>
                    {parentSignature && (
                      <img 
                        src={parentSignature} 
                        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '56px', height: '56px', maxWidth: 'none', objectFit: 'contain', mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 10 }} 
                        alt="sig" 
                      />
                    )}
                  </span>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '14pt', letterSpacing: '0.2em', marginTop: '6px' }}>
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 하단 바닥글 유의사항 (표 바로 아래 6mm 간격) */}
        <div style={{ fontSize: '7.5pt', lineHeight: 1.4, marginTop: '6px', color: '#374151' }}>
          <p style={{ margin: '1px 0' }}>※ 보호자가 신청서를 제출하였다 하여 체험학습이 허가된 것이 아니며 담임교사로부터 반드시 최종 허가 여부 통보를 받은 후 실시해야 함.</p>
          <p style={{ margin: '1px 0' }}>※ 신청서 제출 기한은 체험학습 실시 7일 이전, 보고서 제출 기한은 체험학습 종료 후 7일 이내</p>
          <p style={{ margin: '1px 0' }}>※ 체험학습 신청서는 교육적인 내용으로 구체적이고 자세하게 기록해야 함.</p>
        </div>
      </div>
    );

    // ─────────────── <서식 2> 교외체험학습 결과보고서 (A4 1장 고정 틀) ───────────────
    const renderReportPage = () => (
      <div
        className="print-page-wrapper"
        style={{
          width: '210mm',
          height: '297mm',
          padding: '15mm 15mm 15mm 15mm',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          fontFamily: 'Batang, Noto Serif KR, serif',
          color: '#000000',
          margin: '0 auto',
          position: 'relative',
          display: 'block',
        }}
      >
        {/* 상단 표제 & 결재란 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1, paddingRight: '8px', paddingTop: '2px' }}>
            <div style={{ fontSize: '9pt', color: '#334155', textAlign: 'left', marginBottom: '2px' }}>{'<서식 2>'}</div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '17pt', fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1.2, margin: 0 }}>
                「학교장허가 교외체험학습」 결과보고서
              </h1>
              <p style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '8.5pt', marginTop: '3px', marginBottom: 0, textAlign: 'center' }}>
                (체험학습 실시 후 7일 이내 제출)
              </p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            {renderApprovers()}
          </div>
        </div>

        {/* 본문 테이블 (A4 페이지를 꽉 채우는 217mm 높이 규격) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '9.5pt', textAlign: 'center', lineHeight: 1.2 }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <tbody>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>성 명</th>
              <td style={{ border: '1px solid #000', fontWeight: 'bold', whiteSpace: 'nowrap', padding: '0 4px' }}>{data.studentName}</td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>학 년 &nbsp; 반 &nbsp; 번</th>
              <td style={{ border: '1px solid #000', whiteSpace: 'nowrap', padding: '0 4px', fontWeight: 500 }}>{grade ? `${grade}학년 ${studentClass}반 ${number}번` : data.gradeClassNumber}</td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap' }}>휴대폰</th>
              <td style={{ border: '1px solid #000', whiteSpace: 'nowrap', padding: '0 4px', fontWeight: 500 }}>{data.phone}</td>
            </tr>
            <tr style={{ height: '42px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', lineHeight: 1.15, whiteSpace: 'nowrap' }}>교외체험학습<br/>기간</th>
              <td colSpan={3} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '9pt' }}>
                {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, &nbsp; 총 ( <b>{data.tripPeriod?.totalDays}</b> ) 일간
              </td>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>학습형태</th>
              <td style={{ border: '1px solid #000', padding: '0 4px', fontSize: '9pt' }}>{data.tripType}</td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>교외체험학습<br/>장소</th>
              <td colSpan={5} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontSize: '9pt' }}>{data.destination}</td>
            </tr>
            <tr style={{ height: '38px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', fontSize: '9pt', whiteSpace: 'nowrap' }}>제 목</th>
              <td colSpan={5} style={{ border: '1px solid #000', textAlign: 'left', padding: '0 10px', fontWeight: 'bold', fontSize: '9pt' }}>{reportTitle}</td>
            </tr>
            {/* 결과보고서 내용 영역 (490px 높이로 페이지를 가득 채움) */}
            <tr style={{ height: '490px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', padding: '6px 2px', lineHeight: 1.25, fontSize: '9pt', fontWeight: 'bold', wordBreak: 'keep-all' }}>
                교외<br/>체험학습<br/>결과
              </th>
              <td colSpan={5} style={{ border: '1px solid #000', padding: '12px', textAlign: 'left', verticalAlign: 'top', whiteSpace: 'pre-wrap', fontSize: '9pt', lineHeight: 1.65, wordBreak: 'keep-all' }}>
                {reportContent || <span style={{ color: '#9ca3af' }}>(작성된 결과보고서 내용)</span>}
              </td>
            </tr>
            {/* 보고서 제출 서약 및 서명 영역 (160px 높이) */}
            <tr style={{ height: '160px' }}>
              <td colSpan={6} style={{ border: '1px solid #000', padding: '16px 10px', position: 'relative' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10.5pt', marginBottom: '8px' }}>
                  위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                </div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '14px', fontSize: '9.5pt' }}>
                  {reportSubmittedAt ? format(new Date(reportSubmittedAt), 'yyyy 년 MM 월 dd 일') : format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '48px', marginBottom: '12px', fontSize: '9.5pt' }}>
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>보호자 : </span>
                  <span style={{ minWidth: '80px', textAlign: 'center', fontWeight: 'bold', marginRight: '8px', color: '#1e3a8a' }}>{parentName}</span>
                  <span style={{ position: 'relative', display: 'inline-block', textAlign: 'center', width: '32px', marginLeft: '4px' }}>
                    <span style={{ fontWeight: 500 }}>(인)</span>
                    {parentSignature && (
                      <img 
                        src={parentSignature} 
                        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '56px', height: '56px', maxWidth: 'none', objectFit: 'contain', mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 10 }} 
                        alt="sig" 
                      />
                    )}
                  </span>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '14pt', letterSpacing: '0.2em', marginTop: '6px' }}>
                  호치민시한국국제학교장 귀하
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 하단 바닥글 유의사항 (표 바로 아래 6mm 간격) */}
        <div style={{ fontSize: '7.5pt', lineHeight: 1.4, marginTop: '6px', color: '#374151' }}>
          <p style={{ margin: '1px 0' }}>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
          <p style={{ margin: '1px 0' }}>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
          <p style={{ margin: '1px 0' }}>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
        </div>
      </div>
    );

    // ─────────────── <서식 3> 결석계 (A4 1장 고정 틀) ───────────────
    const renderAbsencePage = () => (
      <div
        className="print-page-wrapper"
        style={{
          width: '210mm',
          height: '297mm',
          padding: '15mm 15mm 15mm 15mm',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          fontFamily: 'Batang, Noto Serif KR, serif',
          color: '#000000',
          margin: '0 auto',
          position: 'relative',
          display: 'block',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1, paddingRight: '8px', paddingTop: '2px' }}>
            <div style={{ fontSize: '9pt', color: '#334155', textAlign: 'left', marginBottom: '2px' }}>{'<서식 3>'}</div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '20pt', fontWeight: 900, letterSpacing: '0.4em', lineHeight: 1.2, margin: 0 }}>
                결 석 계
              </h1>
              <p style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '8.5pt', marginTop: '3px', marginBottom: 0, textAlign: 'center' }}>
                (결석한 날부터 5일 이내 제출)
              </p>
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            {renderApprovers()}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', lineHeight: 1.4, marginBottom: '10px', fontSize: '9.5pt' }}>
          <tbody>
            <tr style={{ height: '36px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', width: '100px', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>소 속</th>
              <td style={{ border: '1px solid #000', padding: '0 12px' }}>
                호치민시한국국제학교 &nbsp;&nbsp;&nbsp; {grade} 학년 &nbsp;( &nbsp;{studentClass}&nbsp; )반 &nbsp;( &nbsp;{number}&nbsp; )번
              </td>
            </tr>
            <tr style={{ height: '36px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>학 생 명</th>
              <td style={{ border: '1px solid #000', padding: '0 12px', fontWeight: 'bold' }}>{data.studentName}</td>
            </tr>
            <tr style={{ height: '46px' }}>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '0 12px', textAlign: 'center', fontSize: '10.5pt' }}>
                위 학생은 다음과 같은 사유로 결석하였기에 결석계를 제출합니다.
              </td>
            </tr>
            <tr style={{ height: '36px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>결석기간</th>
              <td style={{ border: '1px solid #000', padding: '0 12px' }}>
                {data.absencePeriod?.startDate} 부터 &nbsp;&nbsp; {data.absencePeriod?.endDate} 까지 &nbsp; ( <b>{data.absencePeriod?.totalDays}</b> 일간)
              </td>
            </tr>
            <tr style={{ height: '140px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>결석사유</th>
              <td style={{ border: '1px solid #000', padding: '10px 12px', whiteSpace: 'pre-wrap', verticalAlign: 'top', lineHeight: 1.6 }}>{data.absenceReason}</td>
            </tr>
            <tr style={{ height: '140px' }}>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '16px 12px', position: 'relative' }}>
                <div style={{ textAlign: 'center', marginBottom: '14px', fontSize: '10pt' }}>
                  {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: '48px', gap: '8px', fontSize: '10pt' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 500 }}>학 생 :</span>
                    <span style={{ minWidth: '80px', textAlign: 'center', fontWeight: 'bold', marginRight: '8px' }}>{data.studentName}</span>
                    <span style={{ display: 'inline-block', textAlign: 'center', width: '32px', color: 'transparent', userSelect: 'none' }}>(인)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 500 }}>학부모 :</span>
                    <span style={{ minWidth: '80px', textAlign: 'center', fontWeight: 'bold', marginRight: '8px', color: '#1e3a8a' }}>{parentName}</span>
                    <span style={{ position: 'relative', display: 'inline-block', textAlign: 'center', width: '32px', marginLeft: '4px' }}>
                      <span style={{ fontWeight: 500 }}>(인)</span>
                      {parentSignature && (
                        <img 
                          src={parentSignature} 
                          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '56px', height: '56px', maxWidth: 'none', objectFit: 'contain', mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 10 }} 
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

        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '12pt', fontWeight: 'bold', letterSpacing: '0.4em', margin: 0 }}>확 인 서</h2>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', lineHeight: 1.4, fontSize: '9.5pt' }}>
          <tbody>
            <tr style={{ height: '36px' }}>
              <th style={{ border: '1px solid #000', backgroundColor: '#f8fafc', width: '100px', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>구 분</th>
              <td style={{ border: '1px solid #000', padding: '0 12px', textAlign: 'center', fontSize: '9pt' }}>
                병결 [ {data.absenceType === '병결' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;
                미인정 결석 [ {data.absenceType === '미인정' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;
                기타결 [ {data.absenceType === '기타' ? 'O' : ' '} ]<br/>
                출석인정(경조사, 법정전염병, 생리결석, 비자) [ {data.absenceType === '출석인정' ? 'O' : ' '} ]
              </td>
            </tr>
            <tr style={{ height: '140px' }}>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '14px 12px', verticalAlign: 'top' }}>
                <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 500, fontSize: '10pt' }}>위 제출 내용이 사실과 다름없음을 확인함.</div>
                <div style={{ fontSize: '9pt', lineHeight: 1.8 }}>
                  <p style={{ margin: '2px 0' }}>1. 확인방법: 전화/문자({data.teacherConfirmMethod === '전화/문자' ? 'O' : ' '}), 학부모 내교({data.teacherConfirmMethod === '학부모 내교' ? 'O' : ' '}), 가정방문({data.teacherConfirmMethod === '가정방문' ? 'O' : ' '}), 기타({data.teacherConfirmMethod === '기타' ? 'O' : ' '})</p>
                  <p style={{ margin: '2px 0' }}>2. 확인내용: 결석 사유와 동일함을 확인합니다.</p>
                  <p style={{ margin: '2px 0' }}>3. 확인일시: {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}</p>
                </div>
                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10pt' }}>
                  {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );

    return (
      <div ref={ref} className="parent-document-print-root" style={{ width: '210mm', backgroundColor: '#ffffff', margin: '0 auto', display: 'block' }}>
        {isAbsence ? (
          renderAbsencePage()
        ) : isReport ? (
          renderReportPage()
        ) : (
          <>
            {renderApplicationPage(hasReport)}
            {hasReport && renderReportPage()}
          </>
        )}
      </div>
    );
  }
);

ParentDocumentPrint.displayName = 'ParentDocumentPrint';
