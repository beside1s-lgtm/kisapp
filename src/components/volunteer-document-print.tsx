'use client';

import React from 'react';
import { ApprovalDoc, VolunteerFormData } from '@/lib/types';
import { format } from 'date-fns';

type VolunteerDocumentPrintProps = {
  doc: ApprovalDoc;
  approverSignatures?: Record<string, string>;
  viewMode?: 'plan' | 'report'; // 계획서 출력 vs 확인서 출력 강제 모드
};

export const VolunteerDocumentPrint = React.forwardRef<HTMLDivElement, VolunteerDocumentPrintProps>(
  ({ doc, approverSignatures = {}, viewMode }, ref) => {
    const vData = (doc.volunteerFormData || doc.parentFormData || {}) as any;
    if (!vData || Object.keys(vData).length === 0) {
      return <div ref={ref}>봉사활동 데이터가 없습니다.</div>;
    }

    const isGroup = vData.category === 'group' || vData.type === 'volunteer-group-plan' || vData.type === 'volunteer-group-report';
    const isReport = viewMode === 'report' || vData.reportSubmitted === true || vData.type === 'volunteer-report' || vData.type === 'volunteer-group-report';

    // 결재자 서명 자체 자동 로드
    const [loadedSignatures, setLoadedSignatures] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
      const approverList = doc.approvers || [];
      const emails = approverList.map((a: any) => a.email?.trim().toLowerCase()).filter(Boolean);
      if (emails.length === 0) return;

      import('@/lib/services/userService').then(({ getUserProfileByEmail }) => {
        Promise.all(emails.map(e => getUserProfileByEmail(e))).then(profiles => {
          const sigs: Record<string, string> = {};
          profiles.forEach(p => {
            if (p?.signature && p.email) {
              sigs[p.email.trim().toLowerCase()] = p.signature;
            }
          });
          setLoadedSignatures(sigs);
        }).catch(err => console.error('[VolunteerPrint] Signature load error:', err));
      });
    }, [doc]);

    // 결재자 매핑: [업무 담당(양유정)] -> [담당 부장(최선미)] -> [교감(신선영 전결)]
    const approvers = doc.approvers || [];
    const managerApprover = approvers.find((a: any) => 
      a.role?.includes('담당') || a.role?.includes('업무') || a.email?.toLowerCase().includes('yjng05')
    ) || approvers[0];

    const deptHeadApprover = approvers.find((a: any) => 
      a.role?.includes('부장') || a.email?.toLowerCase().includes('choisunmee')
    ) || (approvers.length >= 2 ? approvers[1] : undefined);

    const vpApprover = approvers.find((a: any) => 
      a.role?.includes('교감') || a.type === 'final' || a.email?.toLowerCase().includes('shinedu')
    ) || (approvers.length >= 3 ? approvers[2] : undefined);

    // 날짜 포맷팅 헬퍼
    const period = vData.period || {};
    const startDateStr = period.startDate || '';
    const endDateStr = period.endDate || '';
    const totalDays = period.totalDays || 1;
    const totalHours = period.totalHours || 1;

    const startYear = startDateStr ? startDateStr.substring(0, 4) : '';
    const startMonth = startDateStr ? String(parseInt(startDateStr.substring(5, 7), 10)) : '';
    const startDay = startDateStr ? String(parseInt(startDateStr.substring(8, 10), 10)) : '';

    const endYear = endDateStr ? endDateStr.substring(0, 4) : '';
    const endMonth = endDateStr ? String(parseInt(endDateStr.substring(5, 7), 10)) : '';
    const endDay = endDateStr ? String(parseInt(endDateStr.substring(8, 10), 10)) : '';

    const submittedDateStr = vData.submittedDate || (doc.createdAt ? format(new Date(doc.createdAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    const subYear = submittedDateStr.substring(0, 4);
    const subMonth = String(parseInt(submittedDateStr.substring(5, 7), 10));
    const subDay = String(parseInt(submittedDateStr.substring(8, 10), 10));

    // 단체 학생 목록 (최대 20개 슬롯 그리드)
    const students = vData.groupStudents || [];

    // 기안문 HTML 오염 방지 및 본문 정제 헬퍼
    const formatVolunteerContent = (rawContent: string) => {
      if (!rawContent) return '';
      // 기안문 HTML 태그가 오염되어 들어간 경우 순수 텍스트만 추출하여 정리
      if (rawContent.includes('<p') || rawContent.includes('<table') || rawContent.includes('<br')) {
        const text = rawContent
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '')
          .replace(/<\/p>/gi, '\n')
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();
        return text || rawContent;
      }
      return rawContent;
    };

    // 결재란 결재 도장(직인/서명) 렌더러
    const renderApprovalSeal = (approver: any, defaultRole: string, defaultName: string) => {
      const name = approver?.name || defaultName;
      const email = approver?.email?.toLowerCase();
      const sigUrl = approver?.signature || (email && approverSignatures[email]) || (email && loadedSignatures[email]) || approver?.stamp;
      const isApproved = approver?.status === 'approved' || (doc.status === 'approved' && approver);

      // 1. 등록된 서명 또는 직인 이미지가 있는 경우 최우선 표출
      if (sigUrl) {
        return (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <img 
              src={sigUrl} 
              alt={`${name} 서명`} 
              style={{ maxHeight: '38px', maxWidth: '52px', objectFit: 'contain' }} 
            />
          </div>
        );
      }

      // 2. 승인 완료되었으나 이미지가 없는 경우: 한국 공문서 표준 원형 결재 도장(스탬프) 날인
      if (isApproved) {
        const displayName = name.length > 3 ? name.substring(0, 3) : name;
        return (
          <div className="flex items-center justify-center h-full w-full">
            <div 
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1.5px solid #dc2626',
                color: '#dc2626',
                backgroundColor: 'rgba(254, 242, 242, 0.4)',
                transform: 'rotate(-6deg)',
                lineHeight: '1.05',
                boxShadow: 'inset 0 0 0 1px rgba(220, 38, 38, 0.15)',
              }}
            >
              <span style={{ fontSize: '9.5px', fontWeight: 'bold' }}>{displayName}</span>
              <span style={{ fontSize: '7.5px', letterSpacing: '0.5px' }}>[인]</span>
            </div>
          </div>
        );
      }

      // 3. 미승인 대기 상태: 결재자 이름 표출
      return (
        <span style={{ color: '#64748b', fontSize: '9.5px', fontWeight: '500' }}>
          {name}
        </span>
      );
    };

    return (
      <div
        ref={ref}
        className="volunteer-print-container bg-white text-black text-left w-full mx-auto"
        style={{
          fontFamily: "'Batang', 'Times New Roman', serif",
          width: '210mm',
          minHeight: '297mm',
          padding: '10mm 15mm 10mm 15mm',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .volunteer-print-container {
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                padding: 10mm 15mm 10mm 15mm !important;
                box-sizing: border-box !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                overflow: hidden !important;
              }
            }
          `
        }} />

        {/* ────────────────────────────────────────────────────────── */}
        {/* 서식 1: 개인 봉사활동 계획서                                 */}
        {/* ────────────────────────────────────────────────────────── */}
        {!isGroup && !isReport && (
          <div className="flex flex-col justify-between" style={{ minHeight: '275mm', height: '100%' }}>
            <div>
              <div className="flex justify-between items-start mb-1.5">
                <div className="text-xs text-blue-700 font-bold">&lt;서식1&gt;</div>
                
                {/* 상단 3인 결재란 */}
                <table style={{ borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '10px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid black', width: '60px', padding: '2px', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>업무 담당</td>
                      <td style={{ border: '1px solid black', width: '60px', padding: '2px', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>담당 부장</td>
                      <td style={{ border: '1px solid black', width: '60px', padding: '2px', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>교감(전결)</td>
                    </tr>
                    <tr style={{ height: '44px' }}>
                      <td style={{ border: '1px solid black', verticalAlign: 'middle', position: 'relative' }}>
                        {renderApprovalSeal(managerApprover, '업무 담당', '양유정')}
                      </td>
                      <td style={{ border: '1px solid black', verticalAlign: 'middle', position: 'relative' }}>
                        {renderApprovalSeal(deptHeadApprover, '담당 부장', '최선미')}
                      </td>
                      <td style={{ border: '1px solid black', verticalAlign: 'middle', position: 'relative' }}>
                        {renderApprovalSeal(vpApprover, '교감', '신선영')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h1 className="text-center font-bold text-2xl mb-4 tracking-wider">
                봉사활동 계획서(초등)
              </h1>

              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11.5px' }}>
                <tbody>
                  <tr>
                    <th rowSpan={2} style={{ border: '1px solid black', width: '85px', padding: '6px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>인적 사항</th>
                    <th style={{ border: '1px solid black', width: '65px', padding: '6px', textAlign: 'center', backgroundColor: '#f8fafc' }}>학 교</th>
                    <td style={{ border: '1px solid black', padding: '6px' }}>호치민시한국국제학교</td>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid black', padding: '6px', textAlign: 'center', backgroundColor: '#f8fafc' }}>학 생</th>
                    <td style={{ border: '1px solid black', padding: '6px' }}>
                      ({vData.grade || ''})학년 ({vData.classNum || ''})반 ({vData.studentNum || ''})번 &nbsp;&nbsp;&nbsp; 이름: <b>{vData.studentName || ''}</b>
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '8px 6px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>활동 기간</th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '8px 6px' }}>
                      <div className="mb-1 text-[12px]">
                        {startYear}년 {startMonth}월 {startDay}일 ({period.startDayOfWeek || ''})요일 ~ {endYear}년 {endMonth}월 {endDay}일 ({period.endDayOfWeek || ''})요일 ({totalDays})일간
                      </div>
                      <div className="text-[10.5px] text-red-600 font-bold mb-1">
                        ※ 2026년 12월 24일 봉사활동 계획서 제출 마감
                      </div>
                      <div className="mb-1 text-[12px]">
                        봉사활동 계획 시간: 총 ( <b>{totalHours}</b> )시간
                      </div>
                      <div className="text-[10.5px] text-red-600">
                        ※ 휴일, 공휴일 8시간 이내 인정 (학기 중 등교 시간은 미인정)
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '7px 6px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>대상 기관</th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '7px 6px', fontSize: '12px' }}>
                      {vData.institution || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '7px 6px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>활동 장소</th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '7px 6px', fontSize: '12px' }}>
                      {vData.location || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '8px 6px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold', height: '210px' }}>활동 내용</th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '10px', verticalAlign: 'top', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px' }}>
                      {formatVolunteerContent(vData.content || '')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 하단 서명부 및 학교장 직인 */}
            <div className="pb-1">
              <div className="text-center text-sm">
                <p className="mb-3 text-[13px]">위와 같이 봉사활동을 실시하고자 계획서를 제출합니다.</p>
                <p className="mb-4 font-bold text-[15px]">20{subYear.slice(2)} 년 &nbsp;&nbsp; {subMonth} 월 &nbsp;&nbsp; {subDay} 일</p>

                <div className="flex justify-end gap-10 pr-10 text-[12.5px]">
                  <div className="flex items-center gap-2">
                    <span>학생 성명:</span>
                    <span className="font-bold inline-block min-w-[65px] text-left">{vData.studentName || ''}</span>
                    {vData.studentSignature ? (
                      <img src={vData.studentSignature} alt="서명" className="h-7 w-16 object-contain" />
                    ) : (
                      <span>(서명)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>학부모 성명:</span>
                    <span className="font-bold inline-block min-w-[65px] text-left">{vData.parentName || (doc as any).parentName || ''}</span>
                    {vData.parentSignature ? (
                      <img src={vData.parentSignature} alt="서명" className="h-7 w-16 object-contain" />
                    ) : (
                      <span>(서명)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-[10.5px] text-red-600 leading-normal pl-1">
                ※ 봉사활동 실시 7일 전까지 계획서 제출, 봉사활동 실시 이후 7일 내 확인서 제출 시 학교생활기록부에 등재
              </div>

              <div className="mt-5 text-center text-xl font-bold tracking-widest">
                호치민시한국국제학교장 귀하
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* 서식 2: 개인 봉사활동 확인서 (국영문 병기)                      */}
        {/* ────────────────────────────────────────────────────────── */}
        {!isGroup && isReport && (
          <div className="flex flex-col justify-between" style={{ minHeight: '275mm', height: '100%' }}>
            <div>
              <div className="text-xs text-blue-700 font-bold mb-1">&lt;서식2&gt;</div>
              <h1 className="text-center font-bold text-2xl mb-1 tracking-wider">
                봉사활동 확인서(초등)
              </h1>
              <h2 className="text-center font-bold text-sm mb-2.5 tracking-wide text-neutral-700">
                Certificate of Volunteer Work
              </h2>

              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <th rowSpan={2} style={{ border: '1px solid black', width: '95px', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      인적 사항<br /><span className="text-[9.5px] font-normal">(Personal Info)</span>
                    </th>
                    <th style={{ border: '1px solid black', width: '65px', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      학 교
                    </th>
                    <td style={{ border: '1px solid black', padding: '5px' }}>
                      호치민시한국국제학교<br />
                      <span className="text-[9.5px] text-muted-foreground">KOREAN INTERNATIONAL SCHOOL, HCMC</span>
                    </td>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      학 생
                    </th>
                    <td style={{ border: '1px solid black', padding: '5px' }}>
                      <div>({vData.grade || ''})학년 ({vData.classNum || ''})반 ({vData.studentNum || ''})번 &nbsp;&nbsp; 이름: <b>{vData.studentName || ''}</b></div>
                      <div className="text-[9.5px] text-muted-foreground">
                        Grade: {vData.grade || ''} &nbsp;&nbsp; Class: {vData.classNum || ''} &nbsp;&nbsp; Name: {vData.nameEn || vData.studentName || ''}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '6px 5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      활동 기간<br /><span className="text-[9.5px] font-normal">(Period)</span>
                    </th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '6px 5px' }}>
                      <div className="flex justify-between items-center text-[11px] mb-0.5">
                        <div>◎ {startYear}년 {startMonth}월 {startDay}일 ~ {endYear}년 {endMonth}월 {endDay}일</div>
                        <div className="font-bold">({totalDays}) 일간</div>
                      </div>
                      <div className="flex justify-between items-center text-[11px] mb-0.5">
                        <div>◎ {period.startTime || '09:00'} ~ {period.endTime || '13:00'}</div>
                        <div className="font-bold">({totalHours}) 시간</div>
                      </div>
                      <div className="text-[10px] text-red-600 font-bold">
                        ※ 봉사활동 실적은 시간 단위로 기록 권장 &nbsp;&nbsp;|&nbsp;&nbsp; ※ 2026년 12월 31일 봉사활동 확인서 제출 마감
                      </div>
                      <div className="flex justify-between items-center text-[9.5px] text-muted-foreground mt-0.5 border-t pt-0.5">
                        <div>◎ Day: {startMonth}/{startDay} ~ {endMonth}/{endDay} &nbsp;&nbsp; ◎ Time: ({period.startTime || '09:00'}) ~ ({period.endTime || '13:00'})</div>
                        <div>({totalDays}) day(s) &nbsp; ({totalHours}) hour(s)</div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      대상 기관<br /><span className="text-[9px] font-normal">(Institution)</span>
                    </th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '5px' }}>
                      {vData.institution || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      활동 장소<br /><span className="text-[9px] font-normal">(Location)</span>
                    </th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '5px' }}>
                      {vData.location || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold', height: '125px' }}>
                      활동 내용<br />및 활동사진<br /><span className="text-[9px] font-normal">(Details & photos)</span>
                    </th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '6px', verticalAlign: 'top' }}>
                      <div className="whitespace-pre-wrap text-[10.5px] mb-1.5 leading-relaxed">{formatVolunteerContent(vData.content || '')}</div>
                      {vData.activityPhotos && vData.activityPhotos.length > 0 && (
                        <div className="flex gap-2 mt-1">
                          {vData.activityPhotos.slice(0, 2).map((img: string, idx: number) => (
                            <img key={idx} src={img} alt={`사진 ${idx+1}`} className="h-18 w-28 object-cover border rounded" />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold', height: '85px' }}>
                      활동소감<br /><span className="text-[9px] font-normal">(Impression)</span>
                    </th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '6px', verticalAlign: 'top', whiteSpace: 'pre-wrap', fontSize: '10.5px', lineHeight: '1.4' }}>
                      {vData.impression || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '6px 5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      확인 기관<br /><span className="text-[9px] font-normal">(Confirmation)</span>
                    </th>
                    <td colSpan={2} style={{ border: '1px solid black', padding: '6px 5px' }}>
                      <div className="grid grid-cols-2 gap-2 text-[10.5px] mb-1">
                        <div>◎ 기관명 (Name of institution): <b>{vData.confirmationInstitution?.name || vData.institution || ''}</b></div>
                        <div>◎ 연락처 (Phone number): <b>{vData.confirmationInstitution?.phone || ''}</b></div>
                      </div>
                      <div className="flex justify-between items-center text-[10.5px] mt-1 pt-1 border-t">
                        <div>◎ 확인자 (Name of person in charge): <b>{vData.confirmationInstitution?.personInCharge || ''}</b></div>
                        <div className="flex items-center gap-2">
                          <span>(Sign):</span>
                          {vData.confirmationInstitution?.signImageUrl ? (
                            <img src={vData.confirmationInstitution.signImageUrl} alt="직인/서명" className="h-7 w-18 object-contain" />
                          ) : (
                            <span className="inline-block w-18 border-b border-dotted"></span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pb-1">
              <div className="text-center text-xl font-bold tracking-widest">
                호치민시한국국제학교장 귀하
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* 서식 3: 단체 봉사활동 계획서 (학생 명단 20명 슬롯)               */}
        {/* ────────────────────────────────────────────────────────── */}
        {isGroup && !isReport && (
          <div className="flex flex-col justify-between" style={{ minHeight: '275mm', height: '100%' }}>
            <div>
              <div className="flex justify-between items-start mb-1.5">
                <div className="text-[11px] text-blue-700 font-bold italic">&lt;서식3&gt; 담당 선생님께서 파일 제출도 함께 부탁드립니다.</div>
                
                {/* 상단 3인 결재란 */}
                <table style={{ borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '10px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid black', width: '58px', padding: '2px', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>업무 담당</td>
                      <td style={{ border: '1px solid black', width: '58px', padding: '2px', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>담당 부장</td>
                      <td style={{ border: '1px solid black', width: '58px', padding: '2px', backgroundColor: '#f9fafb', fontWeight: 'bold' }}>교감(전결)</td>
                    </tr>
                    <tr style={{ height: '44px' }}>
                      <td style={{ border: '1px solid black', verticalAlign: 'middle' }}>
                        {renderApprovalSeal(managerApprover, '업무 담당', '양유정')}
                      </td>
                      <td style={{ border: '1px solid black', verticalAlign: 'middle' }}>
                        {renderApprovalSeal(deptHeadApprover, '담당 부장', '최선미')}
                      </td>
                      <td style={{ border: '1px solid black', verticalAlign: 'middle' }}>
                        {renderApprovalSeal(vpApprover, '교감', '신선영')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h1 className="text-center font-bold text-2xl mb-2.5 tracking-wider">
                봉사활동 계획서(초등단체)
              </h1>

              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '10.5px' }}>
                <tbody>
                  <tr>
                    <th style={{ border: '1px solid black', width: '70px', padding: '4px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>학 교</th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '4px', fontSize: '11px' }}>
                      호치민시한국국제학교 &nbsp;<span className="text-[9.5px] text-muted-foreground">KOREAN INTERNATIONAL SCHOOL, HCMC</span>
                    </td>
                  </tr>

                  {/* 20명 학생 명단 그리드 (좌 10명, 우 10명) */}
                  <tr>
                    <th rowSpan={11} style={{ border: '1px solid black', width: '70px', padding: '3px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      학 생<br />명 단
                    </th>
                    <th style={{ border: '1px solid black', width: '32px', height: '22px', textAlign: 'center', backgroundColor: '#f8fafc' }}>순번</th>
                    <th style={{ border: '1px solid black', width: '36px', textAlign: 'center', backgroundColor: '#f8fafc' }}>학년</th>
                    <th style={{ border: '1px solid black', width: '30px', textAlign: 'center', backgroundColor: '#f8fafc' }}>반</th>
                    <th style={{ border: '1px solid black', width: '34px', textAlign: 'center', backgroundColor: '#f8fafc' }}>번호</th>
                    <th style={{ border: '1px solid black', width: '75px', textAlign: 'center', backgroundColor: '#f8fafc' }}>이름</th>
                    <th style={{ border: '1px solid black', width: '32px', textAlign: 'center', backgroundColor: '#f8fafc' }}>순번</th>
                    <th style={{ border: '1px solid black', width: '36px', textAlign: 'center', backgroundColor: '#f8fafc' }}>학년</th>
                    <th style={{ border: '1px solid black', width: '30px', textAlign: 'center', backgroundColor: '#f8fafc' }}>반</th>
                    <th style={{ border: '1px solid black', width: '34px', textAlign: 'center', backgroundColor: '#f8fafc' }}>번호</th>
                    <th style={{ border: '1px solid black', width: '75px', textAlign: 'center', backgroundColor: '#f8fafc' }}>이름</th>
                  </tr>

                  {Array.from({ length: 10 }).map((_, i) => {
                    const sLeft = students[i];
                    const sRight = students[i + 10];
                    return (
                      <tr key={i} style={{ height: '22px', textAlign: 'center', fontSize: '10.5px' }}>
                        <td style={{ border: '1px solid black' }}>{i + 1}</td>
                        <td style={{ border: '1px solid black' }}>{sLeft?.grade || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sLeft?.classNum || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sLeft?.studentNum || ''}</td>
                        <td style={{ border: '1px solid black', fontWeight: sLeft ? 'bold' : 'normal' }}>{sLeft?.name || ''}</td>

                        <td style={{ border: '1px solid black' }}>{i + 11}</td>
                        <td style={{ border: '1px solid black' }}>{sRight?.grade || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sRight?.classNum || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sRight?.studentNum || ''}</td>
                        <td style={{ border: '1px solid black', fontWeight: sRight ? 'bold' : 'normal' }}>{sRight?.name || ''}</td>
                      </tr>
                    );
                  })}

                  <tr>
                    <th style={{ border: '1px solid black', padding: '6px 5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>활동 기간</th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '6px 5px' }}>
                      <div className="mb-0.5 text-[11px]">
                        {startYear}년 {startMonth}월 {startDay}일 ({period.startDayOfWeek || ''})요일 ~ {endYear}년 {endMonth}월 {endDay}일 ({period.endDayOfWeek || ''})요일 ({totalDays})일간
                      </div>
                      <div className="text-[10px] text-red-600 font-bold mb-0.5">
                        ※ 2026년 12월 24일 봉사활동 계획서 제출 마감
                      </div>
                      <div className="mb-0.5 text-[11px]">
                        봉사활동 계획 시간: 총 ( <b>{totalHours}</b> )시간
                      </div>
                      <div className="text-[10px] text-red-600">
                        ※ 휴일, 공휴일 8시간 이내 인정 (학기 중 등교 시간은 미인정)
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>대상 기관</th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '5px', fontSize: '11px' }}>
                      {vData.institution || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>활동 장소</th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '5px', fontSize: '11px' }}>
                      {vData.location || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '6px 5px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold', height: '150px' }}>활동 내용</th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '8px', verticalAlign: 'top', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '11px' }}>
                      {formatVolunteerContent(vData.content || '')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 하단 서명부 및 학교장 직인 (신청 교사/신청자 서명) */}
            <div className="pb-1">
              <div className="text-center text-sm">
                <p className="mb-2 text-[12.5px]">위와 같이 봉사활동을 실시하고자 계획서를 제출합니다.</p>
                <p className="mb-2.5 font-bold text-[14px]">20{subYear.slice(2)} 년 &nbsp;&nbsp; {subMonth} 월 &nbsp;&nbsp; {subDay} 일</p>

                <div className="flex justify-end pr-8 text-[12.5px]">
                  <div className="flex items-center gap-2">
                    <span>신청자 성명:</span>
                    <span className="font-bold inline-block min-w-[75px] text-left">{vData.leaderTeacherName || doc.requesterName || ''}</span>
                    {vData.teacherSignature || doc.requesterSignature ? (
                      <img src={vData.teacherSignature || doc.requesterSignature} alt="서명" className="h-7 w-16 object-contain" />
                    ) : (
                      <span>(서명)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 text-[10px] text-red-600 leading-normal pl-1">
                ※ 봉사활동 실시 7일 전까지 계획서 제출, 봉사활동 실시 이후 7일 내 확인서 제출 시 학교생활기록부에 등재
              </div>

              <div className="mt-3.5 text-center text-xl font-bold tracking-widest">
                호치민시한국국제학교장 귀하
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* 서식 4: 단체 봉사활동 확인서 (국영문 병기, 명단 20명 슬롯)        */}
        {/* ────────────────────────────────────────────────────────── */}
        {isGroup && isReport && (
          <div className="flex flex-col justify-between" style={{ minHeight: '275mm', height: '100%' }}>
            <div>
              <div className="text-[11px] text-blue-700 font-bold italic mb-1">&lt;서식4&gt; 담당 선생님께서 파일 제출도 함께 부탁드립니다.</div>
              <h1 className="text-center font-bold text-xl mb-0.5 tracking-wider">
                봉사활동 확인서(초등단체)
              </h1>
              <h2 className="text-center font-bold text-sm mb-2 tracking-wide text-neutral-700">
                Certificate of Volunteer Work
              </h2>

              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '10px' }}>
                <tbody>
                  <tr>
                    <th style={{ border: '1px solid black', width: '70px', padding: '3px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>학 교</th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '3px' }}>
                      호치민시한국국제학교 &nbsp;<span className="text-[9.5px] text-muted-foreground">KOREAN INTERNATIONAL SCHOOL, HCMC</span>
                    </td>
                  </tr>

                  {/* 20명 학생 명단 그리드 (좌 10명, 우 10명) */}
                  <tr>
                    <th rowSpan={11} style={{ border: '1px solid black', width: '70px', padding: '3px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      학 생<br />명 단
                    </th>
                    <th style={{ border: '1px solid black', width: '32px', height: '20px', textAlign: 'center', backgroundColor: '#f8fafc' }}>순번</th>
                    <th style={{ border: '1px solid black', width: '36px', textAlign: 'center', backgroundColor: '#f8fafc' }}>학년</th>
                    <th style={{ border: '1px solid black', width: '30px', textAlign: 'center', backgroundColor: '#f8fafc' }}>반</th>
                    <th style={{ border: '1px solid black', width: '34px', textAlign: 'center', backgroundColor: '#f8fafc' }}>번호</th>
                    <th style={{ border: '1px solid black', width: '75px', textAlign: 'center', backgroundColor: '#f8fafc' }}>이름</th>
                    <th style={{ border: '1px solid black', width: '32px', textAlign: 'center', backgroundColor: '#f8fafc' }}>순번</th>
                    <th style={{ border: '1px solid black', width: '36px', textAlign: 'center', backgroundColor: '#f8fafc' }}>학년</th>
                    <th style={{ border: '1px solid black', width: '30px', textAlign: 'center', backgroundColor: '#f8fafc' }}>반</th>
                    <th style={{ border: '1px solid black', width: '34px', textAlign: 'center', backgroundColor: '#f8fafc' }}>번호</th>
                    <th style={{ border: '1px solid black', width: '75px', textAlign: 'center', backgroundColor: '#f8fafc' }}>이름</th>
                  </tr>

                  {Array.from({ length: 10 }).map((_, i) => {
                    const sLeft = students[i];
                    const sRight = students[i + 10];
                    return (
                      <tr key={i} style={{ height: '20px', textAlign: 'center', fontSize: '10px' }}>
                        <td style={{ border: '1px solid black' }}>{i + 1}</td>
                        <td style={{ border: '1px solid black' }}>{sLeft?.grade || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sLeft?.classNum || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sLeft?.studentNum || ''}</td>
                        <td style={{ border: '1px solid black', fontWeight: sLeft ? 'bold' : 'normal' }}>{sLeft?.name || ''}</td>

                        <td style={{ border: '1px solid black' }}>{i + 11}</td>
                        <td style={{ border: '1px solid black' }}>{sRight?.grade || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sRight?.classNum || ''}</td>
                        <td style={{ border: '1px solid black' }}>{sRight?.studentNum || ''}</td>
                        <td style={{ border: '1px solid black', fontWeight: sRight ? 'bold' : 'normal' }}>{sRight?.name || ''}</td>
                      </tr>
                    );
                  })}

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px 4px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      활동 기간<br /><span className="text-[8.5px] font-normal">(Period)</span>
                    </th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '5px 4px' }}>
                      <div className="flex justify-between items-center text-[10px]">
                        <div>◎ {startYear}년 {startMonth}월 {startDay}일 ~ {endYear}년 {endMonth}월 {endDay}일 &nbsp;&nbsp; ◎ {period.startTime || '09:00'} ~ {period.endTime || '13:00'}</div>
                        <div className="font-bold">({totalDays}) 일간 &nbsp; ({totalHours}) 시간</div>
                      </div>
                      <div className="text-[9px] text-red-600 font-bold mt-0.5">
                        ※ 봉사활동 실적은 시간 단위로 기록 권장 &nbsp;&nbsp;|&nbsp;&nbsp; ※ 2026년 12월 31일 봉사활동 확인서 제출 마감
                      </div>
                      <div className="flex justify-between items-center text-[8.5px] text-muted-foreground mt-0.5 border-t pt-0.5">
                        <div>◎ Day: {startMonth}/{startDay} ~ {endMonth}/{endDay} &nbsp;&nbsp; ◎ Time: ({period.startTime || '09:00'}) ~ ({period.endTime || '13:00'})</div>
                        <div>({totalDays}) day(s) &nbsp; ({totalHours}) hour(s)</div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '4px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      대상 기관<br /><span className="text-[8px] font-normal">(Name)</span>
                    </th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '4px' }}>
                      {vData.institution || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '4px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      활동 장소<br /><span className="text-[8px] font-normal">(Location)</span>
                    </th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '4px' }}>
                      {vData.location || ''}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px 4px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold', height: '110px' }}>
                      활동 내용<br />및 활동사진
                    </th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '5px', verticalAlign: 'top' }}>
                      <div className="whitespace-pre-wrap text-[10px] mb-1 leading-snug">{formatVolunteerContent(vData.content || '')}</div>
                      {vData.activityPhotos && vData.activityPhotos.length > 0 && (
                        <div className="flex gap-2">
                          {vData.activityPhotos.slice(0, 2).map((img: string, idx: number) => (
                            <img key={idx} src={img} alt={`사진 ${idx+1}`} className="h-16 w-24 object-cover border rounded" />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th style={{ border: '1px solid black', padding: '5px 4px', textAlign: 'center', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      확인 기관<br /><span className="text-[8px] font-normal">(Confirmation)</span>
                    </th>
                    <td colSpan={10} style={{ border: '1px solid black', padding: '5px 4px' }}>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>◎ 기관명: <b>{vData.confirmationInstitution?.name || vData.institution || ''}</b></div>
                        <div>◎ 연락처: <b>{vData.confirmationInstitution?.phone || ''}</b></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mt-1 pt-0.5 border-t">
                        <div>◎ 확인자: <b>{vData.confirmationInstitution?.personInCharge || ''}</b></div>
                        <div className="flex items-center gap-2">
                          <span>(Sign):</span>
                          {vData.confirmationInstitution?.signImageUrl ? (
                            <img src={vData.confirmationInstitution.signImageUrl} alt="직인/서명" className="h-6 w-14 object-contain" />
                          ) : (
                            <span className="inline-block w-14 border-b border-dotted"></span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pb-1">
              <div className="text-center text-xl font-bold tracking-widest">
                호치민시한국국제학교장 귀하
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

VolunteerDocumentPrint.displayName = 'VolunteerDocumentPrint';
