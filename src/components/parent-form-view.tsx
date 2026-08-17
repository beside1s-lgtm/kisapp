import React from 'react';
import { ApprovalDoc, ParentFormData, Approver } from '@/lib/types';
import { format } from 'date-fns';

type ParentFormViewProps = {
  doc: ApprovalDoc;
  teacherMode?: boolean;
  teacherData?: {
    absenceType: string;
    confirmMethod: string;
    confirmDate: string;
  };
  onTeacherDataChange?: (data: any) => void;
  approverSignatures?: Record<string, string>;
};

export function ParentFormView({ doc, teacherMode, teacherData, onTeacherDataChange, approverSignatures }: ParentFormViewProps) {
  const data = doc.parentFormData as ParentFormData;
  if (!data) return <div>데이터가 없습니다.</div>;

  const isAbsence = data.type === 'absence';
  const isReport = data.type === 'field-trip-report';
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

  // 승인자 목록 매핑
  const renderApprovers = () => {
    // 4칸(담임, 부장, 교감, 교장)을 기본으로 맞춤
    const slots = ['담임', '부장', '교감', '교장'];
    return (
      <table className="border-collapse border border-black w-[295px] text-[9.5pt] ml-auto not-w-full" style={{ width: '295px' }}>
        <tbody>
          <tr>
            <th rowSpan={2} className="border border-black bg-white w-[35px] text-center font-bold">결<br/>재</th>
            {slots.map((role, idx) => (
              <th key={idx} className="border border-black bg-white text-center font-bold py-1 px-1">{role}</th>
            ))}
          </tr>
          <tr className="h-[65px] print:h-[65px]">
            {slots.map((role, idx) => {
              const approver = doc.approvers?.find(a => a.role === role);
              const signature = approver?.signature || (approver ? approverSignatures?.[approver.email.toLowerCase()] : undefined);
              return (
                <td key={idx} className="border border-black text-center align-middle relative">
                  {approver && approver.status === 'approved' && signature && (
                    <>
                      {approver.type === 'final' && <span className="absolute top-0 right-0 text-[8pt] text-red-600 font-bold bg-white/80 px-0.5 z-10">전결</span>}
                      <img src={signature} className="absolute inset-0 w-full h-full object-contain mix-blend-multiply p-0.5" alt="sig" />
                    </>
                  )}
                  {approver && approver.status === 'rejected' && <span className="text-red-500 font-bold">반려</span>}
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
  
  const tripTypes = ['가족동반여행', '친인척 방문', '답사·견학 활동', '체험활동', '기타'];

  return (
    <>

      {isAbsence ? (
        <div className="bg-white p-6 print:p-0 w-[170mm] mx-auto text-black font-serif text-[10.5pt] print:text-[9.5pt] print:w-[170mm] print:mx-auto print:block">
          <div className="flex justify-end mb-1 print:mb-0.5">
            {renderApprovers()}
          </div>
        
        <div className="text-center mb-3 print:mb-2 space-y-0.5">
          <h1 className="text-3xl print:text-2xl font-bold tracking-[0.5em] mb-0.5">결 석 계</h1>
          <p className="text-xs print:text-[10px]">(결석한 날부터 5일 이내 제출)</p>
        </div>

        <table className="w-full border-collapse border border-black leading-relaxed mb-6 print:mb-5">
          <tbody>
            <tr>
              <th className="border border-black bg-white py-4 print:py-3.5 w-[100px] print:w-[80px] font-bold text-center">소 속</th>
              <td className="border border-black px-3 py-4 print:py-3.5">
                호치민시한국국제학교 &nbsp;&nbsp;&nbsp; {grade} 학년 &nbsp;( &nbsp;{studentClass}&nbsp; )반 &nbsp;( &nbsp;{number}&nbsp; )번
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-white py-4 print:py-3.5 font-bold text-center">학 생 명</th>
              <td className="border border-black px-3 py-4 print:py-3.5 font-bold">{data.studentName}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-3 py-8 print:py-6 text-center text-[11pt] print:text-[10pt]">
                위 학생은 다음과 같은 사유로 결석하였기에 결석계를 제출합니다.
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-white py-4 print:py-3.5 font-bold text-center">결석기간</th>
              <td className="border border-black px-3 py-4 print:py-3.5">
                {data.absencePeriod?.startDate} 부터 &nbsp;&nbsp; {data.absencePeriod?.endDate} 까지 &nbsp; ( {data.absencePeriod?.totalDays} 일간)
              </td>
            </tr>
            <tr style={{ height: '120px' }}>
              <th className="border border-black bg-white py-4 print:py-3 font-bold text-center align-middle">결석사유</th>
              <td className="border border-black px-3 py-4 print:py-3 whitespace-pre-wrap align-top">{data.absenceReason}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-3 py-10 print:py-8 relative">
                <div className="text-center mb-6 print:mb-4 text-[10pt] print:text-[9.5pt]">
                  {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                </div>
                <div className="flex flex-col items-end pr-10 space-y-2.5 print:space-y-2 text-[10pt] print:text-[9.5pt]">
                  <div className="flex items-center gap-4">
                    <span>학 생 :</span>
                    <span className="w-[100px] text-center font-bold">{data.studentName}</span>
                  </div>
                  <div className="flex items-center gap-4 relative">
                    <span>학부모 :</span>
                    <span className="w-[100px] text-center font-bold text-sm text-blue-800">{parentName}</span>
                    <span className="ml-2">(인)</span>
                    {parentSignature && (
                      <img src={parentSignature} className="absolute -right-8 -top-4 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                    )}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-center mb-3 print:mb-2">
          <h2 className="text-lg font-bold tracking-[0.5em]">확 인 서</h2>
        </div>

        <table className="w-full border-collapse border border-black leading-relaxed">
          <tbody>
            <tr>
              <th className="border border-black bg-white py-4 print:py-3.5 w-[100px] print:w-[80px] font-bold text-center">구 분</th>
              <td className="border border-black px-3 py-4 print:py-3.5 text-center leading-snug text-[9.5pt] print:text-[9pt]">
                {teacherMode ? (
                  <div className="flex gap-4 justify-center items-center h-full">
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '병결'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '병결' })} /> 병결</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '미인정'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '미인정' })} /> 미인정</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '기타'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '기타' })} /> 기타</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="absenceType" checked={teacherData?.absenceType === '출석인정'} onChange={() => onTeacherDataChange?.({ ...teacherData, absenceType: '출석인정' })} /> 출석인정</label>
                  </div>
                ) : (
                  <>
                    병결 [ {data.absenceType === '병결' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;
                    미인정 결석 [ {data.absenceType === '미인정' ? 'O' : ' '} ] &nbsp;&nbsp;&nbsp;
                    기타결 [ {data.absenceType === '기타' ? 'O' : ' '} ]<br/>
                    출석인정(경조사, 법정전염병, 생리결석, 비자) [ {data.absenceType === '출석인정' ? 'O' : ' '} ]
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-3 py-8 print:py-6 align-top">
                <div className="text-center mb-5 print:mb-3 font-medium text-[10pt] print:text-[9.5pt]">위 제출 내용이 사실과 다름없음을 확인함.</div>
                <div className="space-y-2.5 print:space-y-2 text-[9.5pt] print:text-[9pt]">
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
                      <div className="h-[10px] print:h-[5px]"></div>
                      <div className="flex items-center gap-2">
                        <span>3. 확인일시:</span>
                        <input type="date" className="border px-2 py-0.5 rounded text-xs" value={teacherData?.confirmDate || ''} onChange={(e) => onTeacherDataChange?.({ ...teacherData, confirmDate: e.target.value })} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p>1. 확인방법: 전화/문자({data.teacherConfirmMethod === '전화/문자' ? 'O' : ' '}), 학부모 내교({data.teacherConfirmMethod === '학부모 내교' ? 'O' : ' '}), 가정방문({data.teacherConfirmMethod === '가정방문' ? 'O' : ' '}), 기타({data.teacherConfirmMethod === '기타' ? 'O' : ' '})</p>
                      <p>2. 확인내용: 결석 사유와 동일함을 확인합니다.</p>
                      <div className="h-[10px] print:h-[5px]"></div>
                      <p>3. 확인일시: {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}</p>
                    </>
                  )}
                </div>
                {!teacherMode && (
                  <div className="text-center mt-12 mb-3 text-[10pt] print:text-[9.5pt]">
                    {data.teacherConfirmDate ? format(new Date(data.teacherConfirmDate), 'yyyy 년 MM 월 dd 일') : '20   년   월   일'}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      ) : isReport ? (
        <div className="bg-white p-6 print:p-0 w-[170mm] mx-auto text-black font-serif text-[10.5pt] print:text-[9.5pt] print:w-[170mm] print:mx-auto print:block">
          <div className="mb-0.5 text-[9.5pt] print:text-[9pt]">{'<서식 2>'}</div>
        
          <div className="flex justify-between items-end mb-2 print:mb-1.5">
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold mb-0.5">「학교장허가 교외체험학습」 결과보고서</h1>
              <p className="text-red-600 font-bold text-[9.5pt] print:text-[9pt]">(체험학습 실시 후 7일 이내 제출)</p>
            </div>
            <div className="ml-2 shrink-0">
              {renderApprovers()}
            </div>
          </div>

          <table className="w-full border-collapse border border-black leading-tight mb-2 print:mb-1.5 text-center text-[9.5pt] print:text-[8.5pt]">
            <tbody>
              <tr>
                <th className="border border-black bg-white py-1.5 w-[120px] font-bold">성 명</th>
                <td className="border border-black py-1.5 font-bold">{data.studentName}</td>
                <th className="border border-black bg-white py-1.5 w-[120px] font-bold">학년 반 번</th>
                <td colSpan={3} className="border border-black py-1.5">{grade}학년 {studentClass}반 {number}번</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1.5 font-bold leading-tight">교외체험학습<br/>기간</th>
                <td colSpan={3} className="border border-black py-1.5 text-left px-4">
                  {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, 총 ( {data.tripPeriod?.totalDays} ) 일간
                </td>
                <th className="border border-black bg-white py-1.5 w-[100px] font-bold">학습형태</th>
                <td className="border border-black py-1.5">{data.tripType}</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1.5 font-bold">교외체험학습<br/>장소</th>
                <td colSpan={5} className="border border-black py-1.5 text-left px-4">{data.destination}</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1.5 font-bold">제 목</th>
                <td colSpan={5} className="border border-black py-1.5 text-left px-4 font-bold">{data.reportTitle}</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1 h-[260px] leading-tight text-[9pt] font-bold break-keep" style={{ wordBreak: 'keep-all' }}>교외<br/>체험학습<br/>결과</th>
                <td colSpan={5} className="border border-black py-2.5 text-left px-4 align-top whitespace-pre-wrap text-[9pt] print:text-[8pt] break-keep" style={{ wordBreak: 'keep-all' }}>
                  <p className="text-gray-400 text-xs mb-2 select-none print:hidden font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</p>
                  {data.reportContent}
                </td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black py-4 print:py-3.5 relative">
                  <div className="text-center font-bold text-[10.5pt] print:text-[9.5pt] mb-2">
                    위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                  </div>
                  <div className="text-center font-bold mb-2 text-[9.5pt] print:text-[9pt]">
                    {format(submitDate, 'yyyy 년 MM 월 dd 일')}
                  </div>
                  <div className="flex justify-end pr-10 items-center relative mb-2 text-[9.5pt] print:text-[9pt]">
                    <span className="font-bold mr-2">보호자 : </span>
                    <span className="w-[100px] text-center font-bold mr-1 text-blue-800">{parentName}</span>
                    <span>(인)</span>
                    {parentSignature && (
                      <img src={parentSignature} className="absolute -right-4 -top-6 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                    )}
                  </div>
                  <div className="text-center font-black text-[14pt] print:text-[12pt] tracking-widest mt-1">
                    호치민시한국국제학교장 귀하
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div className="text-[8pt] print:text-[7.5pt] leading-tight space-y-0.5 mt-1 text-gray-700">
            <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
            <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
            <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
          </div>
        </div>
      ) : (
      <div className="bg-white p-6 print:p-0 w-[170mm] mx-auto text-black font-serif text-[10.5pt] print:text-[9.5pt] print:w-[170mm] print:mx-auto print:block">
        <div className="mb-0.5 text-[9.5pt] print:text-[9pt]">{'<서식 1>'}</div>
      
      <div className="flex justify-between items-end mb-2 print:mb-1.5">
        <div className="text-center flex-1">
          <h1 className="text-2xl font-bold mb-0.5">「학교장허가 교외체험학습」 신청서</h1>
          <p className="text-red-600 font-bold text-[9.5pt] print:text-[9pt]">(체험학습 실시 7일전 제출)</p>
        </div>
        <div className="ml-2 shrink-0">
          {renderApprovers()}
        </div>
      </div>

      <table className="w-full border-collapse border border-black leading-tight mb-2 print:mb-1.5 text-center text-[9.5pt] print:text-[8.5pt]">
        <tbody>
          <tr>
            <th colSpan={2} className="border border-black bg-white py-1.5 w-[150px] font-bold">성 명</th>
            <td className="border border-black py-1.5 font-bold">{data.studentName}</td>
            <th className="border border-black bg-white py-1.5 w-[100px] font-bold">학년 반 번</th>
            <td className="border border-black py-1.5">{grade}학년 {studentClass}반 {number}번</td>
            <th className="border border-black bg-white py-1.5 w-[80px] font-bold">휴대폰</th>
            <td className="border border-black py-1.5">{data.phone}</td>
          </tr>
          <tr>
            <th rowSpan={2} className="border border-black bg-white py-1.5 text-red-600 font-bold text-[8pt] leading-snug w-[100px] break-keep" style={{ wordBreak: 'keep-all' }}>
              본교 출석인정기간<br/>(휴일 제외, 학기당 7일,<br/>연간 14일)
            </th>
            <th className="border border-black bg-white py-1.5 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>신청 기간</th>
            <td colSpan={5} className="border border-black py-1.5 text-left px-4 text-[9pt]">
              {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, 총 ( {data.tripPeriod?.totalDays} ) 일간
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-white py-1.5 font-bold leading-tight text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>연간 체험학습<br/>누적 일수</th>
            <td colSpan={5} className="border border-black py-1.5 text-left px-4 text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>
              기존 사용 일수 및 금번 신청 일수 포함 총 ( {data.cumulativeDays ?? 0} + {data.tripPeriod?.totalDays ?? 0} = {(data.cumulativeDays ?? 0) + (data.tripPeriod?.totalDays ?? 0)} ) 일
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-white py-1.5 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>학습형태</th>
            <td colSpan={6} className="border border-black py-1.5 text-left px-2 text-[8.5pt] break-keep" style={{ wordBreak: 'keep-all' }}>
              {tripTypes.map(t => (
                <span key={t} className="inline-block mr-3">
                  ◦ {t}( {data.tripType === t ? 'O' : ' '} )
                </span>
              ))}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-white py-1.5 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>방문 장소</th>
            <td colSpan={6} className="border border-black py-1.5 text-left px-4 text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>{data.destination}</td>
          </tr>
          <tr>
            <th className="border border-black bg-white py-1.5 font-bold leading-tight text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>보호자<br/>(인솔자)명</th>
            <td colSpan={2} className="border border-black py-1.5 font-bold text-[9pt]">{data.companionName}</td>
            <th className="border border-black bg-white py-1.5 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>관계</th>
            <td className="border border-black py-1.5 text-[9pt]">{data.companionRelation}</td>
            <th className="border border-black bg-white py-1.5 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>휴대폰</th>
            <td className="border border-black py-1.5 text-[9pt]">{data.phone}</td>
          </tr>
          <tr>
            <th className="border border-black bg-white py-1 font-bold text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>목 적</th>
            <td colSpan={6} className="border border-black py-1 text-left px-2 text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>{data.purpose}</td>
          </tr>
          <tr>
            <th className="border border-black bg-white py-1 h-[80px] print:h-[60px] leading-tight text-[9pt] font-bold break-keep" style={{ wordBreak: 'keep-all' }}>교외체험학습<br/>계획<br/>(일정, 기대<br/>효과 등)</th>
            <td colSpan={6} className="border border-black py-1 text-left px-2 align-top whitespace-pre-wrap text-[9pt] print:text-[8pt] break-keep" style={{ wordBreak: 'keep-all' }}>
              {data.detailedPlan}
            </td>
          </tr>
          <tr>
            <td colSpan={7} className="border border-black py-3 print:py-2.5 relative">
              <div className="text-center font-bold text-[10.5pt] print:text-[9.5pt] mb-2">
                위와 같이 「학교장허가 교외체험학습」을 신청합니다.
              </div>
              <div className="text-center font-bold mb-2 text-[9.5pt] print:text-[9pt]">
                {format(submitDate, 'yyyy 년 MM 월 dd 일')}
              </div>
              <div className="flex justify-end pr-10 items-center relative mb-2 text-[9.5pt] print:text-[9pt]">
                <span className="font-bold mr-2">보호자 : </span>
                <span className="w-[100px] text-center font-bold mr-1 text-blue-800">{parentName}</span>
                <span>(인)</span>
                {parentSignature && (
                  <img src={parentSignature} className="absolute -right-4 -top-6 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                )}
              </div>
              <div className="text-center font-black text-[14pt] print:text-[12pt] tracking-widest mt-1">
                호치민시한국국제학교장 귀하
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div className="text-[8pt] print:text-[7.5pt] leading-tight space-y-0.5 mt-1 text-gray-700">
        <p>※ 보호자가 신청서를 제출하였다 하여 체험학습이 허가된 것이 아니며 담임교사로부터 반드시 최종 허가 여부 통보를 받은 후 실시해야 함.</p>
        <p>※ 신청서 제출 기한은 체험학습 실시 7일 이전, 보고서 제출 기한은 체험학습 종료 후 7일 이내</p>
        <p>※ 체험학습 신청서는 교육적인 내용으로 구체적이고 자세하게 기록해야 함.</p>
      </div>

      {data.reportSubmitted && (
        <div 
          className="mt-8 pt-8 border-t-2 border-dashed border-black print:border-t-0 print:pt-0 print:mt-0 print:break-before-page font-serif text-[10.5pt] print:text-[9.5pt] w-full text-black"
          style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
        >
          <div className="mb-0.5 text-[9.5pt] print:text-[9pt] mt-6">{'<서식 2>'}</div>
        
          <div className="flex justify-between items-end mb-2 print:mb-1.5">
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold mb-0.5">「학교장허가 교외체험학습」 결과보고서</h1>
              <p className="text-red-600 font-bold text-[9.5pt] print:text-[9pt]">(체험학습 실시 후 7일 이내 제출)</p>
            </div>
            <div className="ml-2 shrink-0 invisible print:visible">
              {renderApprovers()}
            </div>
          </div>

          <table className="w-full border-collapse border border-black leading-tight mb-2 print:mb-1.5 text-center text-[9.5pt] print:text-[8.5pt]">
            <tbody>
              <tr>
                <th className="border border-black bg-white py-1.5 w-[120px] font-bold">성 명</th>
                <td className="border border-black py-1.5 font-bold">{data.studentName}</td>
                <th className="border border-black bg-white py-1.5 w-[120px] font-bold">학년 반 번</th>
                <td colSpan={3} className="border border-black py-1.5">{grade}학년 {studentClass}반 {number}번</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1.5 font-bold leading-tight">교외체험학습<br/>기간</th>
                <td colSpan={3} className="border border-black py-1.5 text-left px-4">
                  {data.tripPeriod?.startDate} ~ {data.tripPeriod?.endDate}, 총 ( {data.tripPeriod?.totalDays} ) 일간
                </td>
                <th className="border border-black bg-white py-1.5 w-[100px] font-bold">학습형태</th>
                <td className="border border-black py-1.5">{data.tripType}</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1.5 font-bold">교외체험학습<br/>장소</th>
                <td colSpan={5} className="border border-black py-1.5 text-left px-4">{data.destination}</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1.5 font-bold">제 목</th>
                <td colSpan={5} className="border border-black py-1.5 text-left px-4 font-bold">{data.reportTitle}</td>
              </tr>
              <tr>
                <th className="border border-black bg-white py-1 h-[210px] leading-tight text-[9pt] font-bold break-keep" style={{ wordBreak: 'keep-all' }}>교외<br/>체험학습<br/>결과</th>
                <td colSpan={5} className="border border-black py-2.5 text-left px-4 align-top whitespace-pre-wrap text-[9pt] print:text-[8pt] break-keep" style={{ wordBreak: 'keep-all' }}>
                  <p className="text-gray-400 text-xs mb-2 select-none print:hidden font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</p>
                  {data.reportContent}
                </td>
              </tr>
              <tr>
                <td colSpan={6} className="border border-black py-4 print:py-3.5 relative">
                  <div className="text-center font-bold text-[10.5pt] print:text-[9.5pt] mb-2">
                    위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
                  </div>
                  <div className="text-center font-bold mb-2 text-[9.5pt] print:text-[9pt]">
                    {data.reportSubmittedAt ? format(new Date(data.reportSubmittedAt), 'yyyy 년 MM 월 dd 일') : format(submitDate, 'yyyy 년 MM 월 dd 일')}
                  </div>
                  <div className="flex justify-end pr-10 items-center relative mb-2 text-[9.5pt] print:text-[9pt]">
                    <span className="font-bold mr-2">보호자 : </span>
                    <span className="w-[100px] text-center font-bold mr-1 text-blue-800">{parentName}</span>
                    <span>(인)</span>
                    {parentSignature && (
                      <img src={parentSignature} className="absolute -right-4 -top-6 w-14 h-14 object-contain mix-blend-multiply" alt="sig" />
                    )}
                  </div>
                  <div className="text-center font-black text-[14pt] print:text-[12pt] tracking-widest mt-1">
                    호치민시한국국제학교장 귀하
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div className="text-[8pt] print:text-[7.5pt] leading-tight space-y-0.5 mt-1 text-gray-700">
            <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
            <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
            <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
          </div>
        </div>
      )}
    </div>
    )}
    </>
  );
}
