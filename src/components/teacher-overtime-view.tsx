import { ApprovalDoc } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function TeacherOvertimeView({ doc }: { doc: ApprovalDoc }) {
  const data = doc.teacherOvertimeData;
  if (!data) return null;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm mt-4 text-sm print:border-none print:shadow-none print:mt-0 print:text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="py-3 px-4 font-bold text-center border-r border-gray-300 whitespace-nowrap w-[100px]">일자</th>
            <th className="py-3 px-4 font-bold text-center border-r border-gray-300 whitespace-nowrap w-[100px]">시간</th>
            <th className="py-3 px-4 font-bold text-center border-r border-gray-300 whitespace-nowrap w-[80px]">총합</th>
            <th className="py-3 px-4 font-bold text-center border-r border-gray-300 w-full">사유</th>
            <th className="py-3 px-4 font-bold text-center border-r border-gray-300 whitespace-nowrap w-[120px]">신청 상태</th>
            <th className="py-3 px-4 font-bold text-center whitespace-nowrap w-[200px]">결재자 (서명)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50 transition-colors">
            {/* 일자 */}
            <td className="py-4 px-4 text-center border-r border-gray-300 font-medium">
              {data.date}
            </td>
            
            {/* 시간 */}
            <td className="py-4 px-4 text-center border-r border-gray-300">
              <div className="flex flex-col gap-1 items-center justify-center">
                <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm w-full">
                  {data.startTime}
                </span>
                <span className="text-gray-400 text-[10px]">▼</span>
                <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-sm w-full">
                  {data.endTime}
                </span>
              </div>
            </td>
            
            {/* 총합 */}
            <td className="py-4 px-4 text-center border-r border-gray-300 font-bold text-indigo-700">
              {data.totalHours}시간
            </td>

            {/* 사유 (전체 너비 점유) */}
            <td className="py-4 px-4 text-left border-r border-gray-300">
              <p className="whitespace-pre-wrap leading-relaxed text-gray-700 break-words">{data.reason}</p>
            </td>

            {/* 신청 상태 */}
            <td className="py-4 px-4 text-center border-r border-gray-300">
              <Badge 
                variant={doc.status === 'approved' ? 'default' : doc.status === 'rejected' ? 'destructive' : 'secondary'}
                className="font-medium px-3 py-1 text-sm"
              >
                {doc.status === 'approved' ? '결재 완료' : doc.status === 'rejected' ? '반려됨' : '결재 진행중'}
              </Badge>
            </td>

            {/* 결재자 서명 (가로 배열) */}
            <td className="py-4 px-4 text-center align-middle">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {doc.approvers.map((ap, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 border border-gray-200 rounded-md p-2 bg-gray-50 w-20">
                    <span className="text-[10px] font-bold text-gray-500">{ap.role}</span>
                    <span className="text-xs font-semibold">{ap.approverName || ap.name}</span>
                    <div className="h-10 w-10 flex items-center justify-center relative mt-1">
                      <span className="text-gray-300 text-[10px] absolute font-serif">(인)</span>
                      {ap.signature && ap.status === 'approved' ? (
                        <img src={ap.signature} className="absolute inset-0 w-full h-full object-contain mix-blend-multiply z-10" alt="sig" />
                      ) : ap.status === 'rejected' ? (
                        <span className="text-red-500 font-bold text-xs absolute z-10">반려</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
