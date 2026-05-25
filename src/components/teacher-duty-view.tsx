import { ApprovalDoc } from "@/lib/types";
import { format } from "date-fns";

type TeacherDutyViewProps = {
  doc: ApprovalDoc;
};

export function TeacherDutyView({ doc }: TeacherDutyViewProps) {
  const data = doc.teacherDutyData;
  if (!data) return <div className="p-4 text-center text-gray-500">데이터가 없습니다.</div>;

  const plan = data.studyAbroadPlan;
  const gubun = data.detailType || data.subType || data.mainType;
  const startStr = `${data.startDate} ${data.startTime || '08:30'}`;
  const endStr = `${data.endDate} ${data.endTime || '16:30'}`;
  const isTravel = data.mainType === '출장' && data.travelItems && data.travelItems.length > 0;
  
  // Format total days
  let duration = `${data.totalDays}일`;
  if (data.totalDays < 1 && data.startTime && data.endTime) {
    const s = data.startTime.split(':');
    const e = data.endTime.split(':');
    const sMin = parseInt(s[0]) * 60 + parseInt(s[1]);
    const eMin = parseInt(e[0]) * 60 + parseInt(e[1]);
    const diffMin = eMin - sMin;
    if (diffMin > 0) {
       const h = Math.floor(diffMin / 60);
       const m = diffMin % 60;
       duration = `0D ${h}H ${m}M`;
    }
  } else if (Number.isInteger(data.totalDays)) {
    duration = `${data.totalDays}D 0H 0M`;
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '결재중';
      case 'approved': return '승인(완결)';
      case 'rejected': return '반려';
      case 'recalled': return '기안취소(완결)';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-600 font-bold';
      case 'approved': return 'text-emerald-600 font-bold';
      case 'rejected': return 'text-rose-600 font-bold';
      case 'recalled': return 'text-gray-500 font-bold';
      default: return 'text-gray-600 font-bold';
    }
  };

  const planPeriodText = data.startDate && data.endDate 
    ? `${data.startDate.replace(/-/g, '.')} - ${data.endDate.replace(/-/g, '.')} (${data.totalDays || 0})일간`
    : '';

  const getCatMark = (cat: string) => {
    return plan?.category === cat ? 'O' : ' ';
  };

  return (
    <div className="w-full bg-white text-gray-800 p-6 rounded-xl text-sm shadow-sm border border-gray-100 font-sans overflow-x-auto print:bg-white print:text-black print:p-0 print:shadow-none print:border-none print:overflow-visible">
      
      {/* 1. 일반 복무 상세 테이블 (출장이 아닐 때 또는 복수 출장 데이터가 없을 때) */}
      {!isTravel && (
        <div className={plan ? 'print:hidden' : ''}>
          <h2 className="text-lg font-bold mb-4 text-gray-900 print:text-black flex items-center gap-2">
            📋 복무/출장 기안 상세
          </h2>
          <div className="min-w-full overflow-hidden border border-gray-200 rounded-xl print:border-black bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 print:bg-gray-100 print:text-black print:border-black">
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">구분</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">시작</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">종료</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">신청시간</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">목적지</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap w-full print:border-black">사유</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">신청상태</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">결재자</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black">사후</th>
                  <th className="p-3 text-center whitespace-nowrap">삭제여부</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50/50 transition-colors print:bg-white print:text-black">
                  <td className="p-3 text-center border-r border-gray-200 whitespace-nowrap underline cursor-pointer print:border-black font-semibold text-primary">{gubun}</td>
                  <td className="p-3 text-center border-r border-gray-200 text-xs whitespace-nowrap print:border-black text-gray-600">{startStr}</td>
                  <td className="p-3 text-center border-r border-gray-200 text-xs whitespace-nowrap print:border-black text-gray-600">{endStr}</td>
                  <td className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black font-medium">{duration}</td>
                  <td className="p-3 text-center border-r border-gray-200 whitespace-nowrap max-w-[150px] truncate print:border-black text-gray-700">{data.destination || '-'}</td>
                  <td className="p-3 text-left border-r border-gray-200 break-words print:border-black">
                    <div className="text-gray-800">{data.reason}</div>
                    {data.mainType === '출장' && (data.noExpensesPaid || data.useCompanyVehicle) && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {data.noExpensesPaid && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 print:bg-white print:text-black print:border-black">
                            여비 부지급
                          </span>
                        )}
                        {data.useCompanyVehicle && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 print:bg-white print:text-black print:border-black">
                            관용차량 이용
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black ${getStatusColor(doc.status)}`}>{getStatusText(doc.status)}</td>
                  <td className="p-3 text-center border-r border-gray-200 font-bold whitespace-nowrap print:border-black text-gray-800">{doc.requesterName}</td>
                  <td className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black text-gray-600">사전</td>
                  <td className="p-3 text-center whitespace-nowrap text-gray-500">N</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1-2. 복수 출장 상세 테이블 (출장이고 복수 출장 데이터가 있을 때) */}
      {isTravel && (
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-900 print:text-black flex items-center gap-2">
            💼 복수 출장 기안 상세
          </h2>
          <div className="min-w-full overflow-hidden border border-gray-200 rounded-xl print:border-black bg-white shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 print:bg-gray-100 print:text-black print:border-black">
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black w-[15%]">일자</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black w-[10%]">출장 구분</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black w-[15%]">목적지</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black w-[20%]">동행자</th>
                  <th className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black w-[15%]">여비 / 차량</th>
                  <th className="p-3 text-center whitespace-nowrap w-[25%]">사유</th>
                </tr>
              </thead>
              <tbody>
                {data.travelItems!.map((item, idx) => {
                  const dateObj = new Date(item.date);
                  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
                  const dayOfWeek = weekDays[dateObj.getDay()];
                  const formattedDate = `${item.date} (${dayOfWeek})`;

                  return (
                    <tr key={idx} className="border-b border-gray-200 last:border-0 hover:bg-gray-50/50 transition-colors print:bg-white print:text-black print:border-black">
                      <td className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black font-medium text-gray-900">{formattedDate}</td>
                      <td className="p-3 text-center border-r border-gray-200 whitespace-nowrap print:border-black text-gray-700">{item.subType}</td>
                      <td className="p-3 text-center border-r border-gray-200 print:border-black break-all text-gray-800">{item.destination}</td>
                      <td className="p-3 text-center border-r border-gray-200 print:border-black">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {item.travelers?.map(t => (
                            <span key={t.email} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 print:bg-gray-100 print:text-black print:border-gray-300">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center border-r border-gray-200 print:border-black">
                        <div className="flex flex-col gap-1.5 items-center justify-center">
                          {item.noExpensesPaid && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 print:bg-rose-50 print:text-rose-700 print:border-rose-200">
                              여비 부지급
                            </span>
                          )}
                          {item.useCompanyVehicle && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 print:bg-blue-50 print:text-blue-700 print:border-blue-200">
                              관용차량 이용
                            </span>
                          )}
                          {!item.noExpensesPaid && !item.useCompanyVehicle && <span className="text-gray-400 print:text-black">-</span>}
                        </div>
                      </td>
                      <td className="p-3 text-left break-all text-gray-700">{item.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. 국외자율연수 계획서 (존재 시 렌더링, 인쇄 최적화) */}
      {plan && (
        <div className="mt-0 md:mt-6 bg-white text-black p-4 md:p-8 rounded-lg border border-gray-300 shadow-md print:border-0 print:shadow-none print:p-0 print:mt-0">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 border-b-2 border-black pb-2 inline-block px-4">
              국외자율연수를 위한 공무외국외여행 계획서
            </h1>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-2 border-black border-collapse text-left table-fixed">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <tbody>
                {/* 1행: 인적사항 */}
                <tr className="border-b border-black">
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center w-[10%] whitespace-nowrap">소 속</td>
                  <td className="p-3 border-r border-black text-center w-[22%]">{plan.affiliation}</td>
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center w-[10%]">직 위<br/>(급)</td>
                  <td className="p-3 border-r border-black text-center w-[10%]">{plan.position}</td>
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center w-[10%]">성 명</td>
                  <td className="p-3 border-r border-black w-[16%]">
                    <div className="flex items-center justify-center gap-x-3 whitespace-nowrap min-h-[24px]">
                      <span>{plan.name}</span>
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <span className="text-xs text-gray-500 font-normal">(인)</span>
                        {doc.requesterSignature && (
                          <img 
                            src={doc.requesterSignature} 
                            className="absolute w-10 h-10 max-w-none object-contain mix-blend-multiply left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
                            alt="stamp" 
                          />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center w-[10%]">과 목</td>
                  <td className="p-3 text-center w-[12%]">{plan.subject}</td>
                </tr>

                {/* 2행: 목적(배경) */}
                <tr className="border-b border-black">
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center whitespace-nowrap">목적<br/>(배경)</td>
                  <td className="p-3 whitespace-pre-wrap leading-relaxed break-keep" colSpan={7}>{plan.purpose}</td>
                </tr>

                {/* 3행: 기간 */}
                <tr className="border-b border-black">
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center whitespace-nowrap">기 간</td>
                  <td className="p-3 font-semibold text-center text-base" colSpan={7}>{planPeriodText}</td>
                </tr>

                {/* 4행: 연수 구분 */}
                <tr className="border-b border-black">
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center whitespace-nowrap">연수 구분</td>
                  <td className="p-3 break-keep" colSpan={7}>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 font-medium">
                      <span>• 교직단체가 주관하는 연수 ( {getCatMark('교직단체가 주관하는 연수')} )</span>
                      <span>• 해외 교육기관의 초청 ( {getCatMark('해외 교육기관의 초청')} )</span>
                      <span>• 개인의 학습자료 수집 ( {getCatMark('개인의 학습자료 수집')} )</span>
                      <span>• 기타 ( {plan.category === '기타' ? `O - ${plan.categoryEtcDetail || ''}` : ' '} )</span>
                    </div>
                  </td>
                </tr>

                {/* 5행: 세부 일정 안내 헤더 */}
                <tr className="border-b border-black bg-gray-50">
                  <td className="p-2.5 font-bold text-center" colSpan={8}>연수 세부 일정</td>
                </tr>

                {/* 세부 일정 행 (독립 비율 테이블을 colSpan={8} td 내부에 fixed layout으로 구현) */}
                <tr className="border-b border-black">
                  <td colSpan={8} className="p-0 border-0">
                    <table className="w-full table-fixed text-xs border-collapse text-left border-0">
                      <thead>
                        <tr className="border-b border-black bg-gray-100 font-bold text-center text-xs">
                          <th className="p-2 border-r border-black w-[10%] text-center">월 일</th>
                          <th className="p-2 border-r border-black w-[16%] text-center">출발지</th>
                          <th className="p-2 border-r border-black w-[16%] text-center">도착지</th>
                          <th className="p-2 border-r border-black w-[16%] text-center">연수기관명<br/>(방문기관)</th>
                          <th className="p-2 text-center w-[42%]">연수 내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.schedules?.map((sch, idx) => (
                          <tr key={idx} className="border-b border-black last:border-b-0 hover:bg-gray-50 transition-colors">
                            <td className="p-2 border-r border-black text-center font-medium whitespace-nowrap">{sch.date}</td>
                            <td className="p-2 border-r border-black text-center">{sch.departure || '-'}</td>
                            <td className="p-2 border-r border-black text-center">{sch.destination || '-'}</td>
                            <td className="p-2 border-r border-black font-semibold break-keep text-center">{sch.institution}</td>
                            <td className="p-2 whitespace-pre-wrap leading-relaxed break-keep">{sch.content}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>

                {/* 6행: 연수 효과 */}
                <tr>
                  <td className="p-3 bg-gray-50 border-r border-black font-bold text-center whitespace-nowrap">연수 효과</td>
                  <td className="p-3 whitespace-pre-wrap leading-relaxed break-keep" colSpan={7}>{plan.effects}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* 3. 결재 진행 상황 */}
      <div className={`mt-8 bg-gray-50 border border-gray-200 p-5 rounded-xl flex items-center justify-between flex-wrap gap-4 ${plan ? 'print:hidden' : ''}`}>
         <div className="font-bold text-gray-700">결재 진행 상황</div>
         <div className="flex gap-3 flex-wrap">
             {doc.approvers.map((ap, idx) => (
                <div key={idx} className="flex flex-col items-center border border-gray-200 p-3 rounded-lg bg-white min-w-[110px] shadow-sm">
                   <span className="text-[11px] text-gray-500 font-semibold">{ap.role}</span>
                   <span className="font-bold text-gray-800 my-1">{ap.approverName || ap.name}</span>
                   <span className={`text-xs font-bold ${
                      ap.status === 'approved' ? 'text-emerald-600' :
                      ap.status === 'rejected' ? 'text-rose-600' : 'text-amber-500'
                   }`}>
                      {ap.status === 'approved' ? '승인' : ap.status === 'rejected' ? '반려' : '대기중'}
                   </span>
                </div>
             ))}
         </div>
      </div>
    </div>
  );
}
