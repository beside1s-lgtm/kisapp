'use client';

import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import type { FieldTripBlackoutPeriod } from '@/lib/types';

export function DesktopFieldTripForm({
  enableCumulative,
  isLoadingLimits,
  isOverFieldTripLimit,
  accumulatedFieldTripDays,
  watchFieldTripTotalDays,
  watchStudentName,
  watchGradeClassNumber,
  setValue,
  errors,
  watch,
  fieldTripExcludedSummary,
  overlappedBlackoutPeriod,
  t,
  blackoutPeriods,
  watchFieldTripStartDate,
  watchFieldTripEndDate,
  profile,
  submitDate,
}: {
  enableCumulative: boolean;
  isLoadingLimits: boolean;
  isOverFieldTripLimit: boolean;
  accumulatedFieldTripDays: number;
  watchFieldTripTotalDays: number;
  watchStudentName: string;
  watchGradeClassNumber: string;
  setValue: any;
  errors: any;
  watch: any;
  fieldTripExcludedSummary: string | null;
  overlappedBlackoutPeriod: FieldTripBlackoutPeriod | null;
  t: (key: string, params?: any) => string;
  blackoutPeriods: FieldTripBlackoutPeriod[];
  watchFieldTripStartDate: string;
  watchFieldTripEndDate: string;
  profile: any;
  submitDate: Date;
}) {
  return (
    <div className="font-serif text-[10pt] text-black min-w-[280px]">
      {/* 누적 일수 경고 (연간 누계 기능 활성화 시에만 노출) */}
      {enableCumulative && (
        <>
          <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6 print:hidden">
            <div>
              <h5 className="font-bold text-slate-800 text-xs sm:text-sm">연간 누적 체험학습 현황 (올해)</h5>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">출석인정 개인 교외체험학습 사용 현황</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] sm:text-xs text-muted-foreground block">누적 / 한도 (연간)</span>
              <span className={`text-xs sm:text-base md:text-sm font-black whitespace-nowrap ${isOverFieldTripLimit ? 'text-destructive' : 'text-slate-700'}`}>
                {isLoadingLimits ? '...' : `${accumulatedFieldTripDays}일`}
                {` + 신청 ${watchFieldTripTotalDays}일 = 총 ${accumulatedFieldTripDays + Number(watchFieldTripTotalDays)}일`}
                {` / 20일`}
              </span>
            </div>
          </div>

          {isOverFieldTripLimit && (
            <div className="bg-destructive/10 text-destructive p-3 sm:p-4 rounded-lg text-xs sm:text-sm font-semibold flex items-start gap-2 border border-destructive/20 mb-4 sm:mb-6 print:hidden">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">연간 교외체험학습 허용 한도(20일)를 초과하여 신청할 수 없습니다.</p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mb-1 text-[8.5pt] sm:text-[9.5pt]">{'<서식 1>'}</div>
      <div className="text-center mb-4 sm:mb-5 space-y-1">
        <h1 className="text-xl md:text-2xl font-bold whitespace-nowrap leading-snug">「학교장허가 교외체험학습」 신청서</h1>
        <p className="text-red-600 font-bold text-[11px] sm:text-xs">(체험학습 실시 7일전 제출)</p>
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
                value={watchStudentName || ''}
                onChange={(e) => setValue('studentName', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none font-bold text-center ${errors.studentName ? 'border-destructive' : ''}`}
                placeholder="학생명 입력"
                readOnly={!!profile?.studentName}
              />
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">학 년 &nbsp; 반 &nbsp; 번</th>
            <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
              <input
                value={watchGradeClassNumber || ''}
                onChange={(e) => setValue('gradeClassNumber', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${errors.gradeClassNumber ? 'border-destructive' : ''}`}
                placeholder="예: 4-4-2"
                readOnly={!!(profile?.studentGrade && profile?.studentClass && profile?.studentNumber)}
              />
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-center whitespace-nowrap">휴대폰</th>
            <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
              <input
                value={watch('phone') || ''}
                onChange={(e) => setValue('phone', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).phone ? 'border-destructive' : ''}`}
                placeholder="보호자 연락처"
              />
            </td>
          </tr>
          {/* 2. 본교 출석인정기간 (rowSpan 3 또는 2) / 신청 기간 / 연간 누적 일수 / 불인정 기간 안내 및 표 */}
          <tr>
            <th rowSpan={enableCumulative ? 3 : 2} className="border border-black bg-slate-50/50 py-2.5 text-red-600 font-bold text-[8pt] leading-snug break-keep" style={{ wordBreak: 'keep-all' }}>
              본교 출석인정기간<br/>(휴일 제외, 학기당 7일,<br/>연간 14일)
            </th>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold text-[9pt] break-keep whitespace-nowrap" style={{ wordBreak: 'keep-all' }}>신청 기간</th>
            <td colSpan={4} className="border border-black py-2.5 text-left px-3 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <input
                  type="date"
                  value={watchFieldTripStartDate || ''}
                  onChange={(e) => setValue('tripPeriod.startDate', e.target.value, { shouldValidate: true })}
                  className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 font-sans"
                /> ~ &nbsp;
                <input
                  type="date"
                  value={watchFieldTripEndDate || ''}
                  onChange={(e) => setValue('tripPeriod.endDate', e.target.value, { shouldValidate: true })}
                  className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none mr-1 font-sans"
                /> &nbsp;
                총 (
                <input
                  type="number"
                  min="1"
                  value={watchFieldTripTotalDays || 1}
                  onChange={(e) => setValue('tripPeriod.totalDays', Number(e.target.value), { shouldValidate: true })}
                  className="w-10 text-center border-b border-gray-300 focus:border-black focus:outline-none mr-1 font-bold font-sans"
                /> ) 일간
              </div>
              {fieldTripExcludedSummary && (
                <div className="mt-1.5 text-[8pt] text-indigo-700 font-sans bg-indigo-50/80 px-2 py-1 rounded border border-indigo-200/80 leading-relaxed font-medium">
                  {fieldTripExcludedSummary}
                </div>
              )}
              {overlappedBlackoutPeriod && (
                <div className="mt-1.5 text-[8pt] text-red-700 font-sans bg-red-50 px-2 py-1 rounded border border-red-200 leading-relaxed font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  {t('parents.apply.disallowed_period_toast_title') || '신청 기간이 아닙니다'}: {overlappedBlackoutPeriod.reason} ({overlappedBlackoutPeriod.startDate.replace(/-/g, '.')} ~ {overlappedBlackoutPeriod.endDate.replace(/-/g, '.')})
                </div>
              )}
            </td>
          </tr>
          {enableCumulative && (
            <tr>
              <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight text-[9pt] break-keep" style={{ wordBreak: 'keep-all' }}>연간 체험학습<br/>누적 일수</th>
              <td colSpan={4} className="border border-black py-2.5 text-left px-3 text-xs break-keep" style={{ wordBreak: 'keep-all' }}>
                기존 사용 일수 및 금번 신청 일수 포함 총 ( {accumulatedFieldTripDays} + {watchFieldTripTotalDays} = {accumulatedFieldTripDays + Number(watchFieldTripTotalDays)} ) 일
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={5} className="border border-black p-2 bg-white text-left align-middle font-sans">
              <div className="text-[7.5pt] font-bold text-gray-800 mb-1 flex items-center justify-between">
                <span>※ 허용 일수 초과 시, 초과 일수는 [미인정결석] 처리됨.</span>
                <span className="text-red-600 font-bold">※ 체험학습 신청 불가 기간</span>
              </div>
              <table className="w-full border-collapse border border-black text-center text-[7.5pt] leading-tight">
                <thead>
                  <tr className="bg-slate-50 font-bold">
                    <th className="border border-black py-0.5 w-[46%]">체험학습 불인정 기간</th>
                    <th className="border border-black py-0.5 w-[54%]">사 유</th>
                  </tr>
                </thead>
                <tbody>
                  {blackoutPeriods.map((bp, i) => (
                    <tr key={bp.id || i} className="h-[14px]">
                      <td className="border border-black py-0.5 px-1 font-mono text-[7pt]">{bp.startDate.replace(/-/g, '.')} ~ {bp.endDate.replace(/-/g, '.')}</td>
                      <td className="border border-black py-0.5 px-1 text-left text-[7pt] pl-2">{bp.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">학습형태</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3">
              <select
                value={watch('tripType')}
                onChange={(e) => setValue('tripType', e.target.value as any)}
                className="border border-gray-300 rounded px-1.5 py-0.5 focus:border-black focus:outline-none bg-transparent text-xs"
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
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">방문 장소</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3">
              <input
                value={watch('destination') || ''}
                onChange={(e) => setValue('destination', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none ${(errors as any).destination ? 'border-destructive' : ''}`}
                placeholder="방문할 국가 및 도시명을 입력해주세요."
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold leading-tight whitespace-nowrap">보호자<br/>(인솔자)명</th>
            <td className="border border-black py-2.5 px-1 font-bold text-center whitespace-nowrap">
              <input
                value={watch('companionName') || ''}
                onChange={(e) => setValue('companionName', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).companionName ? 'border-destructive' : ''}`}
                placeholder="동행자 성명"
              />
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">관계</th>
            <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
              <input
                value={watch('companionRelation') || ''}
                onChange={(e) => setValue('companionRelation', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none text-center ${(errors as any).companionRelation ? 'border-destructive' : ''}`}
                placeholder="예: 부, 모, 조부"
              />
            </td>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">휴대폰</th>
            <td className="border border-black py-2.5 px-1 text-center whitespace-nowrap">
              <input
                value={watch('phone') || ''}
                onChange={(e) => setValue('phone', e.target.value, { shouldValidate: true })}
                className="w-full bg-transparent border-none text-center text-gray-500 cursor-not-allowed"
                readOnly
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 font-bold whitespace-nowrap">목 적</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3">
              <input
                value={watch('purpose') || ''}
                onChange={(e) => setValue('purpose', e.target.value, { shouldValidate: true })}
                className={`w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none ${(errors as any).purpose ? 'border-destructive' : ''}`}
                placeholder="체험학습을 통해 달성하고자 하는 구체적인 목적"
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-slate-50/50 py-2.5 h-[120px] leading-tight text-[9.5pt] font-bold">교외체험학습<br/>계획<br/>(일정, 기대<br/>효과 등)</th>
            <td colSpan={5} className="border border-black py-2.5 text-left px-3 align-top">
              <textarea
                value={watch('detailedPlan') || ''}
                onChange={(e) => setValue('detailedPlan', e.target.value, { shouldValidate: true })}
                placeholder="일자별 상세 이동 경로, 방문 장소 및 예상 활동을 꼼꼼하게 입력해 주세요."
                className={`w-full h-28 bg-transparent focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed ${(errors as any).detailedPlan ? 'border-b border-destructive' : ''}`}
              />
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="border border-black py-5 relative">
              <div className="text-center font-bold text-[10.5pt] mb-2">
                위와 같이 「학교장허가 교외체험학습」을 신청합니다.
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

      {/* 통보서 영역 */}
      <div className="text-center mb-2 print:hidden">
        <h2 className="text-lg font-bold tracking-[0.5em] text-gray-400">통 보 서 (작성 불필요)</h2>
      </div>
      <table className="w-full border-collapse border border-slate-300 leading-relaxed opacity-40 select-none pointer-events-none print:hidden mb-4">
        <tbody>
          <tr>
            <td className="border border-slate-300 py-6 px-4 text-center">
              <p className="font-bold text-sm mb-4">「학교장허가 교외체험학습」 통보서</p>
              <div className="text-left text-xs space-y-2 max-w-md mx-auto">
                <p>학생: __________________ ( ____학년 ____반 ____번 )</p>
                <p>기간: 20___년 ___월 ___일 ~ ___월 ___일 ( ___일간 )</p>
                <p>위와 같이 교외체험학습을 승인 및 통보합니다.</p>
              </div>
              <p className="mt-6 text-xs">20___ 년 ___ 월 ___ 일</p>
              <p className="mt-2 font-bold text-xs">호치민시한국국제학교장 (직인생략)</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
