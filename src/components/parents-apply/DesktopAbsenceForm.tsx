'use client';

import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

export function DesktopAbsenceForm({
  watchGradeClassNumber,
  setValue,
  errors,
  profile,
  watchStudentName,
  watchAbsenceStartDate,
  watchAbsenceEndDate,
  watchAbsenceTotalDays,
  absenceExcludedSummary,
  watch,
  submitDate,
  enableCumulative,
  isLoadingLimits,
  isOverAbsenceLimit,
  accumulatedAbsenceDays,
}: {
  watchGradeClassNumber: string;
  setValue: any;
  errors: any;
  profile: any;
  watchStudentName: string;
  watchAbsenceStartDate: string;
  watchAbsenceEndDate: string;
  watchAbsenceTotalDays: number;
  absenceExcludedSummary: string | null;
  watch: any;
  submitDate: Date;
  enableCumulative: boolean;
  isLoadingLimits: boolean;
  isOverAbsenceLimit: boolean;
  accumulatedAbsenceDays: number;
}) {
  return (
    <div className="font-serif text-[10pt] sm:text-[11pt] text-black min-w-[280px]">
      {/* 누적 결석 경고 알림 (연간 누계 기능 활성화 시에만 노출) */}
      {enableCumulative && (
        <>
          <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6 print:hidden">
            <div>
              <h5 className="font-bold text-slate-800 text-xs sm:text-sm">연간 누적 결석 현황 (올해)</h5>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">병결, 미인정, 기타 결석의 합계 (출석인정 제외)</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] sm:text-xs text-muted-foreground block">누적 / 한도 (유급)</span>
              <span className={`text-xs sm:text-base md:text-sm font-black whitespace-nowrap ${isOverAbsenceLimit ? 'text-destructive' : 'text-slate-700'}`}>
                {isLoadingLimits ? '...' : `${accumulatedAbsenceDays}일`}
                {` + 신청 ${watchAbsenceTotalDays}일 = 총 ${accumulatedAbsenceDays + Number(watchAbsenceTotalDays)}일`}
                {` / 63일`}
              </span>
            </div>
          </div>

          {isOverAbsenceLimit && (
            <div className="bg-destructive/10 text-destructive p-3 sm:p-4 rounded-lg text-xs sm:text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-4 sm:mb-6 print:hidden">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">한해 총 결석 일수가 63일을 초과할 경우 교육과정 수료(진급)가 불가할 수 있습니다.</p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mb-1 text-[8.5pt] sm:text-[9.5pt]">{'<서식 3>'}</div>
      <div className="text-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-[0.3em] sm:tracking-[0.5em] pl-[0.3em] sm:pl-[0.5em]">결 석 계</h1>
        <p className="text-red-600 font-bold text-[11px] sm:text-xs mt-1">(결석한 날부터 5일 이내 제출)</p>
      </div>

      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full border-collapse border border-black leading-tight mb-4 text-xs md:text-sm [word-break:keep-all] [overflow-wrap:break-word]">
          <tbody>
            <tr>
              <th className="border border-black bg-slate-50/50 py-2 sm:py-2.5 w-[85px] sm:w-[110px] font-bold text-center text-[11px] sm:text-xs">결석 학생</th>
              <td className="border border-black px-2 sm:px-3 py-2 sm:py-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] sm:text-xs whitespace-nowrap">학년-반-번:</span>
                    <input
                      value={watchGradeClassNumber || ''}
                      onChange={(e) => setValue('gradeClassNumber', e.target.value, { shouldValidate: true })}
                      className={`flex-1 max-w-[120px] sm:max-w-[150px] bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center text-xs sm:text-sm ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                      placeholder="예: 4-4-2"
                      readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)}
                    />
                  </div>
                  <div className="flex items-center gap-1 sm:ml-4">
                    <span className="text-[11px] sm:text-xs whitespace-nowrap">성 명:</span>
                    <input
                      value={watchStudentName || ''}
                      onChange={(e) => setValue('studentName', e.target.value, { shouldValidate: true })}
                      className={`flex-1 max-w-[120px] sm:max-w-[150px] bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center text-xs sm:text-sm ${errors.studentName ? 'border-destructive' : ''}`}
                      placeholder="학생 이름"
                      readOnly={!!profile?.studentName}
                    />
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-slate-50/50 py-2 sm:py-2.5 font-bold text-center text-[11px] sm:text-xs">결석 기간</th>
              <td className="border border-black px-2 sm:px-3 py-2 sm:py-2.5">
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs sm:text-sm">
                  <input
                    type="date"
                    value={watchAbsenceStartDate || ''}
                    onChange={(e) => setValue('absencePeriod.startDate', e.target.value, { shouldValidate: true })}
                    className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none font-sans text-xs"
                  />
                  <span>~</span>
                  <input
                    type="date"
                    value={watchAbsenceEndDate || ''}
                    onChange={(e) => setValue('absencePeriod.endDate', e.target.value, { shouldValidate: true })}
                    className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none font-sans text-xs"
                  />
                  <span className="ml-1 sm:ml-2">대략 (</span>
                  <input
                    type="number"
                    min="1"
                    value={watchAbsenceTotalDays || 1}
                    onChange={(e) => setValue('absencePeriod.totalDays', Number(e.target.value), { shouldValidate: true })}
                    className="w-8 sm:w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none font-bold font-sans text-xs sm:text-sm"
                  />
                  <span>) 일간</span>
                </div>
                {absenceExcludedSummary && (
                  <div className="mt-1.5 text-[8pt] text-indigo-700 font-sans bg-indigo-50/80 px-2 py-1 rounded border border-indigo-200/80 leading-relaxed font-medium">
                    {absenceExcludedSummary}
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <th className="border border-black bg-slate-50/50 py-2 sm:py-2.5 font-bold text-center text-[11px] sm:text-xs">결석종류</th>
              <td className="border border-black px-2 sm:px-3 py-2 sm:py-2.5">
                <select
                  value={watch('absenceType')}
                  onChange={(e) => setValue('absenceType', e.target.value as any)}
                  className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent text-xs sm:text-sm"
                >
                  <option value="병결">병결</option>
                  <option value="미인정">미인정</option>
                  <option value="출석인정">출석인정</option>
                  <option value="기타">기타</option>
                </select>
              </td>
            </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center">결석사유</th>
            <td className="border border-black px-3 py-2.5">
              <textarea
                value={watch('absenceReason') || ''}
                onChange={(e) => setValue('absenceReason', e.target.value, { shouldValidate: true })}
                placeholder="결석 사유를 자세히 입력해주세요."
                className={`w-full h-24 bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).absenceReason ? 'border-b border-destructive' : ''}`}
              />
              {(errors as any).absenceReason && <p className="text-xs text-destructive mt-1 font-sans font-normal">{(errors as any).absenceReason.message}</p>}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black px-4 py-6 relative">
              <div className="text-center mb-4 text-sm font-medium">
                {format(submitDate, 'yyyy 년 MM 월 dd 일')}
              </div>
              <div className="flex flex-col items-end pr-12 space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">학 생 :</span>
                  <span className="min-w-[80px] text-center font-bold mr-2">{watchStudentName || '이름 입력'}</span>
                  <span className="inline-block text-center w-8 text-transparent select-none">(인)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">학부모 :</span>
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
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* 확인서 영역 */}
      <div className="text-center mb-2 print:hidden">
        <h2 className="text-lg font-bold tracking-[0.5em] text-gray-400">확 인 서 (작성 불필요)</h2>
      </div>
      <table className="w-full border-collapse border border-slate-300 leading-relaxed opacity-40 select-none pointer-events-none print:hidden mb-4">
        <tbody>
          <tr>
            <th className="border border-slate-300 bg-slate-50/50 py-2.5 w-[110px] font-bold text-center">구 분</th>
            <td className="border border-slate-300 px-3 py-2.5 text-center text-xs">
              병결 [ &nbsp; ] &nbsp;&nbsp;&nbsp;
              미인정 결석 [ &nbsp; ] &nbsp;&nbsp;&nbsp;
              기타결 [ &nbsp; ]<br/>
              출석인정(경조사, 법정전염병, 생리결석, 비자) [ &nbsp; ]
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border border-slate-300 px-3 py-6 align-top">
              <div className="text-center mb-3 font-medium text-xs">위 제출 내용이 사실과 다름없음을 확인함.</div>
              <div className="space-y-1.5 text-xs">
                <p>1. 확인방법: 전화/문자( &nbsp; ), 학부모 내교( &nbsp; ), 가정방문( &nbsp; ), 기타( &nbsp; )</p>
                <p>2. 확인내용: 결석 사유와 동일함을 확인합니다.</p>
                <div className="h-[10px]"></div>
                <p>3. 확인일시: 20 &nbsp; 년 &nbsp; 월 &nbsp; 일</p>
              </div>
              <div className="text-center mt-6 mb-1 text-xs">
                20 &nbsp; 년 &nbsp; 월 &nbsp; 일
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
