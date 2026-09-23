'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { ApprovalDoc } from '@/lib/types';

export function DesktopFieldTripReportForm({
  originalApplyDoc,
  watch,
  errors,
  setValue,
  watchFieldTripStartDate,
  watchFieldTripEndDate,
  watchFieldTripTotalDays,
  profile,
  submitDate,
}: {
  originalApplyDoc: ApprovalDoc | null;
  watch: any;
  errors: any;
  setValue: any;
  watchFieldTripStartDate: string;
  watchFieldTripEndDate: string;
  watchFieldTripTotalDays: number;
  profile: any;
  submitDate: Date;
}) {
  return (
    <div className="font-serif text-[10pt] text-black">
      {originalApplyDoc && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center gap-4 mb-6 print:hidden">
          <div>
            <h5 className="font-bold text-slate-800 text-sm">연동된 체험학습 신청서 정보</h5>
            <p className="text-xs text-muted-foreground mt-0.5">
              {originalApplyDoc.docNo} ({originalApplyDoc.parentFormData?.tripPeriod?.startDate} ~ {originalApplyDoc.parentFormData?.tripPeriod?.endDate})
            </p>
          </div>
          <Badge className="bg-green-600 text-white border-none font-bold">연동 완료</Badge>
        </div>
      )}

      <div className="mb-1 text-[9.5pt]">{'<서식 2>'}</div>
      <div className="text-center mb-5 space-y-1">
        <h1 className="text-xl md:text-2xl font-bold whitespace-nowrap leading-snug">「학교장허가 교외체험학습」 결과보고서</h1>
        <p className="text-red-600 font-bold text-xs">(체험학습 실시 후 7일 이내 제출)</p>
      </div>

      <div className="overflow-x-auto -mx-1 sm:mx-0">
      <table className="w-full border-collapse border border-black leading-tight mb-4 text-center text-xs md:text-sm min-w-[500px]">
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">성 명</th>
            <td className="border border-black py-2.5 px-1 font-bold text-center whitespace-nowrap">
              <input
                value={watch('studentName') || ''}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                placeholder="학생명"
                readOnly
              />
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">학 년 &nbsp; 반 &nbsp; 번</th>
            <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
              <input
                value={watch('gradeClassNumber') || ''}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                placeholder="예: 4-4-2"
                readOnly
              />
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">휴대폰</th>
            <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
              <input
                value={watch('phone') || ''}
                onChange={(e) => setValue('phone', e.target.value, { shouldValidate: true })}
                className="w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center"
                placeholder="보호자 연락처"
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight whitespace-nowrap">교외체험학습<br/>기간</th>
            <td colSpan={3} className="border border-black py-2.5 text-left px-3 text-xs">
              <input type="date" value={watchFieldTripStartDate || ''} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 opacity-60 font-sans" readOnly /> ~ &nbsp;
              <input type="date" value={watchFieldTripEndDate || ''} className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 opacity-60 font-sans" readOnly /> &nbsp;
              총 ( <input type="number" min="1" value={watchFieldTripTotalDays || 1} className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none mr-1 opacity-60 font-bold font-sans" readOnly /> ) 일간
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">학습형태</th>
            <td className="border border-black py-2.5 px-1">
              <select
                value={watch('tripType')}
                disabled
                className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent opacity-60 cursor-not-allowed text-xs"
              >
                <option value="가족동반여행">가족동반여행</option>
                <option value="친인척 방문">친인척 방문</option>
                <option value="답사·견학 활동">답사·견학 활동</option>
                <option value="체험활동">체험활동</option>
                <option value="기타">기타</option>
              </select>
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">교외체험학습<br/>장소</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3">
              <input
                value={watch('destination') || ''}
                className="w-full bg-transparent border-none focus:outline-none opacity-60"
                readOnly
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">제 목</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3">
              <input
                value={watch('reportTitle') || ''}
                onChange={(e) => setValue('reportTitle', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold ${(errors as any).reportTitle ? 'border-destructive' : ''}`}
                placeholder="보고서 제목을 입력해주세요."
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 h-[280px] leading-tight text-[9.5pt] font-bold">교외<br/>체험학습<br/>결과</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3 align-top">
              <div className="text-gray-400 text-xs mb-2 select-none font-sans font-normal">* 각 일정별로 느낀 점, 배운 점 등을 글, 그림 등으로 학생이 직접 기록합니다.</div>
              <textarea
                value={watch('reportContent') || ''}
                onChange={(e) => setValue('reportContent', e.target.value, { shouldValidate: true })}
                placeholder="체험학습의 결과 및 느낀 점을 자세하고 구체적으로 작성해 주세요. (가급적 학생이 작성하도록 지도 바랍니다)"
                className={`w-full h-[240px] bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).reportContent ? 'border-b border-destructive' : ''}`}
              />
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="border border-black py-5 relative">
              <div className="text-center font-bold text-[10.5pt] mb-2">
                위와 같이 「학교장허가 교외체험학습」 결과보고서를 제출합니다.
              </div>
              <div className="text-center font-bold mb-2.5 text-[9.5pt]">
                {format(submitDate, 'yyyy 년 MM 월 dd 일')}
              </div>
              <div className="flex justify-end pr-12 items-center mb-2.5 text-[9.5pt]">
                <span className="font-bold mr-2">보호자 : </span>
                <span className="min-w-[80px] text-center font-bold mr-2 text-blue-800">{profile?.parentName || '학부모'}</span>
                <span className="relative inline-block text-center w-8 ml-1">
                  <span className="font-medium">(인)</span>
                  {profile?.parentSignature && (
                    <img
                      src={profile.parentSignature}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 max-w-none object-contain mix-blend-multiply pointer-events-none z-10"
                      alt="sig"
                    />
                  )}
                </span>
              </div>
              <div className="text-center font-black text-[14pt] tracking-widest mt-1.5">
                호치민시한국국제학교장 귀하
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <div className="text-xs text-gray-500 space-y-1 mt-4 font-sans font-normal leading-relaxed print:text-black">
        <p>※ 보고서 제출 기한: 체험학습 종료 후 7일 이내</p>
        <p>※ 보고서의 내용은 자세하고 구체적으로 작성 / 1일 1장, 2일 이상은 2일에 1장 정도 추가(권고)</p>
        <p>※ 체험학습을 증빙할 수 있는 자료(항공권, 입장권, 팜플렛, 사진, 영수증 등) 첨부</p>
      </div>
    </div>
  );
}
