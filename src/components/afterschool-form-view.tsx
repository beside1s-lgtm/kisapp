import { ApprovalDoc } from "@/lib/types";
import { format } from "date-fns";

type AfterschoolFormViewProps = {
  doc: ApprovalDoc;
  approverSignatures?: Record<string, string>;
};

export function AfterschoolFormView({ doc, approverSignatures }: AfterschoolFormViewProps) {
  const data = doc.afterschoolCourseData;
  if (!data) return <div className="p-4 text-center text-gray-500">데이터가 없습니다.</div>;

  const submitDate = doc.createdAt ? new Date(doc.createdAt) : new Date();

  // 결재선 렌더링
  const renderApprovers = () => {
    const slots = ['부장', '교감', '교장'];
    return (
      <table className="border-collapse border border-black w-[220px] text-[9.5pt] ml-auto">
        <tbody>
          <tr>
            <th rowSpan={2} className="border border-black bg-slate-50 w-[35px] text-center font-bold">결<br/>재</th>
            {slots.map((role, idx) => (
              <th key={idx} className="border border-black bg-slate-50 text-center font-bold py-0.5 px-1">{role}</th>
            ))}
          </tr>
          <tr className="h-[50px]">
            {slots.map((role, idx) => {
              const approver = doc.approvers?.find(a => a.role?.includes(role));
              const signature = approver?.signature || (approver ? approverSignatures?.[approver.email.toLowerCase()] : undefined);
              return (
                <td key={idx} className="border border-black text-center align-middle relative">
                  {approver && approver.status === 'approved' && signature && (
                    <>
                      {approver.type === 'final' && <span className="absolute top-0 right-0 text-[7.5pt] text-red-600 font-bold bg-white/80 px-0.5 z-10">전결</span>}
                      <img src={signature} className="absolute inset-0 w-full h-full object-contain mix-blend-multiply p-0.5" alt="sig" />
                    </>
                  )}
                  {approver && approver.status === 'rejected' && <span className="text-red-500 font-bold text-xs">반려</span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div className="bg-white p-6 print:p-0 w-[170mm] mx-auto text-black font-serif text-[10.5pt] print:text-[9.5pt] print:w-[170mm] print:mx-auto print:block">
      
      {/* 상단 결재란 */}
      <div className="flex justify-end mb-2 print:mb-1.5">
        {renderApprovers()}
      </div>

      {/* 헤더 및 문서 제목 */}
      <div className="text-center mb-6 print:mb-4 space-y-1">
        <h1 className="text-2xl print:text-xl font-bold tracking-wider">「방과후 학교」 강좌 등록 신청서</h1>
        <p className="text-xs text-gray-500 font-sans">호치민시한국국제학교 방과후학교운영규정 기준</p>
      </div>

      {/* 주요 데이터 테이블 */}
      <table className="w-full border-collapse border border-black leading-relaxed mb-4 text-[10pt] print:text-[9pt]">
        <tbody>
          <tr>
            <th className="border border-black bg-slate-50 py-2 w-[120px] font-bold text-center">강 좌 명</th>
            <td colSpan={3} className="border border-black px-3 py-2 font-bold text-base text-blue-900">
              {data.courseName}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">운영 요일</th>
            <td className="border border-black px-3 py-2">
              주 {data.days?.length || 0}회 ({data.days?.join(', ') || '미정'})
            </td>
            <th className="border border-black bg-slate-50 py-2 w-[110px] font-bold text-center">총 차 시</th>
            <td className="border border-black px-3 py-2">
              {data.totalSessions} 차시
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">차시당 수강료</th>
            <td className="border border-black px-3 py-2">
              {data.feePerSession?.toLocaleString()} 원 (고정)
            </td>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">총 수 강 료</th>
            <td className="border border-black px-3 py-2 font-bold text-blue-800">
              {data.totalFee?.toLocaleString()} 원
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">폐강 기준 인원</th>
            <td className="border border-black px-3 py-2">
              <span className="text-red-700 font-bold">{data.minCapacity} 명</span> 미만 자동 폐강
            </td>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">모집 정원</th>
            <td className="border border-black px-3 py-2 font-bold">
              {data.maxCapacity} 명
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">주 강 사</th>
            <td colSpan={3} className="border border-black px-3 py-2">
              <span className="font-bold">{data.mainTeacherName}</span> ({data.mainTeacherEmail})
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50 py-2 font-bold text-center">예비/보조 강사</th>
            <td colSpan={3} className="border border-black px-3 py-2">
              {data.assistantTeachers && data.assistantTeachers.length > 0 ? (
                <div className="space-y-0.5">
                  {data.assistantTeachers.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="font-bold">{t.name}</span>
                      <span className="text-xs text-gray-600">({t.role} - {t.email})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">해당 없음 (정원 기준 20명 미만 또는 미지정)</span>
              )}
            </td>
          </tr>
          {data.description && (
            <tr>
              <th className="border border-black bg-slate-50 py-2 font-bold text-center align-top">강좌 개요</th>
              <td colSpan={3} className="border border-black px-3 py-2.5 whitespace-pre-wrap leading-normal">
                {data.description}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 하단 서명 문구 */}
      <div className="border border-black p-4 text-center my-6 relative space-y-3">
        <p className="font-bold text-[11pt]">
          위와 같이 방과후 학교 강좌 개설 및 등록을 신청합니다.
        </p>
        <p className="text-sm">
          {format(submitDate, 'yyyy 년 MM 월 dd 일')}
        </p>
        <div className="flex justify-end pr-8 items-center gap-2 text-sm">
          <span>신청 교사 (주강사) :</span>
          <span className="font-bold text-blue-900">{data.mainTeacherName}</span>
          <span>(인)</span>
          {doc.requesterSignature && (
            <img src={doc.requesterSignature} className="w-12 h-12 object-contain mix-blend-multiply ml-1" alt="sig" />
          )}
        </div>
      </div>

      <div className="text-center font-black text-xl tracking-widest mt-6">
        호치민시한국국제학교장 귀하
      </div>
    </div>
  );
}
