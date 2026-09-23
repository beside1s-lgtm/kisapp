'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, AlertTriangle } from 'lucide-react';
import type { ApprovalDoc, FieldTripBlackoutPeriod } from '@/lib/types';

export function MobileFormCard({
  currentType,
  t,
  watch,
  setValue,
  errors,
  watchAbsenceStartDate,
  watchAbsenceEndDate,
  watchAbsenceTotalDays,
  absenceExcludedSummary,
  enableCumulative,
  isLoadingLimits,
  isOverAbsenceLimit,
  accumulatedAbsenceDays,
  originalApplyDoc,
  loadingOriginal,
  watchFieldTripStartDate,
  watchFieldTripEndDate,
  watchFieldTripTotalDays,
  overlappedBlackoutPeriod,
  blackoutPeriods,
  isOverFieldTripLimit,
  profile,
  isSubmitting,
  isOverLimit,
}: {
  currentType: 'absence' | 'field-trip' | 'field-trip-report';
  t: (key: string, params?: any) => string;
  watch: any;
  setValue: any;
  errors: any;
  watchAbsenceStartDate: string;
  watchAbsenceEndDate: string;
  watchAbsenceTotalDays: number;
  absenceExcludedSummary: string | null;
  enableCumulative: boolean;
  isLoadingLimits: boolean;
  isOverAbsenceLimit: boolean;
  accumulatedAbsenceDays: number;
  originalApplyDoc: ApprovalDoc | null;
  loadingOriginal: boolean;
  watchFieldTripStartDate: string;
  watchFieldTripEndDate: string;
  watchFieldTripTotalDays: number;
  overlappedBlackoutPeriod: FieldTripBlackoutPeriod | null;
  blackoutPeriods: FieldTripBlackoutPeriod[];
  isOverFieldTripLimit: boolean;
  profile: any;
  isSubmitting: boolean;
  isOverLimit: boolean;
}) {
  return (
    <div className="sm:hidden p-4 space-y-4">
      {currentType === 'absence' ? (
        <>
          {/* 결석계 - 모바일 카드 */}
          <div className="text-center pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">{t('parents.apply.absence_title') || '결 석 계'}</h2>
            <p className="text-[11px] text-red-500 font-semibold mt-0.5">{t('parents.apply.absence_notice') || '결석한 날부터 5일 이내 제출'}</p>
          </div>

          {/* 결석 기간 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.absence_period') || '결석 기간'} <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={watchAbsenceStartDate || ''}
                onChange={(e) => setValue('absencePeriod.startDate', e.target.value, { shouldValidate: true })}
                className={`flex-1 border rounded-lg px-2.5 h-10 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  (errors as any).absencePeriod?.startDate ? 'border-destructive bg-destructive/5' : 'border-slate-300 focus:border-indigo-400'
                }`}
              />
              <span className="text-slate-400 text-xs">~</span>
              <input
                type="date"
                value={watchAbsenceEndDate || ''}
                onChange={(e) => setValue('absencePeriod.endDate', e.target.value, { shouldValidate: true })}
                className={`flex-1 border rounded-lg px-2.5 h-10 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  (errors as any).absencePeriod?.endDate ? 'border-destructive bg-destructive/5' : 'border-slate-300 focus:border-indigo-400'
                }`}
              />
            </div>
            {watchAbsenceTotalDays > 0 && (
              <p className="text-[11px] text-indigo-600 font-semibold">
                {t('parents.apply.total_days', { days: watchAbsenceTotalDays }) || `총 ${watchAbsenceTotalDays}일`}
                {absenceExcludedSummary && <span className="text-slate-500 font-normal ml-1">({absenceExcludedSummary.replace('※ 결석 기간 중 ', '').replace(` (실제 수업일수: ${watchAbsenceTotalDays}일)`, '')} 제외)</span>}
              </p>
            )}
            {(errors as any).absencePeriod?.startDate && <p className="text-[11px] text-destructive font-medium">{(errors as any).absencePeriod.startDate.message}</p>}
          </div>

          {/* 결석 종류 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.absence_type') || '결석 종류'} <span className="text-red-500">*</span></label>
            <select
              value={watch('absenceType')}
              onChange={(e) => setValue('absenceType', e.target.value as any, { shouldValidate: true })}
              className="w-full border border-slate-300 rounded-lg px-3 h-10 text-xs focus:outline-none focus:border-indigo-400 bg-white"
            >
              <option value="병결">{t('parents.apply.absence_type_illness') || '병결'}</option>
              <option value="출석인정">{t('parents.apply.absence_type_authorized') || '출석인정'}</option>
              <option value="기타">{t('parents.apply.absence_type_other') || '기타'}</option>
            </select>
          </div>

          {/* 결석 사유 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.absence_reason') || '결석 사유'} <span className="text-red-500">*</span></label>
            <textarea
              value={watch('absenceReason') || ''}
              onChange={(e) => setValue('absenceReason', e.target.value, { shouldValidate: true })}
              placeholder={t('parents.apply.absence_reason_ph') || '결석 사유를 자세히 입력해주세요.'}
              rows={4}
              className={`w-full border rounded-lg p-3 text-xs focus:outline-none resize-none placeholder:text-slate-400 ${
                (errors as any).absenceReason ? 'border-destructive bg-destructive/5 focus:ring-2 focus:ring-destructive/20' : 'border-slate-300 focus:border-indigo-400'
              }`}
            />
            {(errors as any).absenceReason && <p className="text-[11px] text-destructive font-medium">{(errors as any).absenceReason.message}</p>}
          </div>

          {/* 누적 결석 현황 (연간 누계 기능 활성화 시에만 노출) */}
          {enableCumulative && (
            <>
              {isLoadingLimits ? (
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 text-center">누적 현황 조회 중...</div>
              ) : (
                <div className={`rounded-lg px-3 py-2 text-xs flex justify-between items-center ${isOverAbsenceLimit ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
                  <span className="font-medium">{t('parents.apply.accumulated_absence_label') || '올해 누적 결석'}</span>
                  <span className="font-bold">{accumulatedAbsenceDays}일 + {t('parents.apply.applied_label') || '신청'} {watchAbsenceTotalDays}일 = {accumulatedAbsenceDays + Number(watchAbsenceTotalDays)}일 / 63일</span>
                </div>
              )}
              {isOverAbsenceLimit && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  한해 총 결석 63일 초과 시 진급이 불가할 수 있습니다.
                </div>
              )}
            </>
          )}
        </>
      ) : currentType === 'field-trip-report' ? (
        <>
          {/* 결과보고서 - 모바일 */}
          <div className="text-center pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">{t('parents.apply.report_title') || '교외체험학습 결과보고서'}</h2>
            <p className="text-[11px] text-red-500 font-semibold mt-0.5">{t('parents.apply.report_notice') || '체험학습 종료 후 7일 이내 제출'}</p>
          </div>
          {originalApplyDoc && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <span className="font-bold text-slate-700">{t('parents.apply.linked_apply_doc') || '연동된 신청서:'}</span>
              <span className="ml-1 text-slate-600">{originalApplyDoc.docNo} ({originalApplyDoc.parentFormData?.tripPeriod?.startDate} ~ {originalApplyDoc.parentFormData?.tripPeriod?.endDate})</span>
            </div>
          )}
          {loadingOriginal && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-center text-slate-500">
              신청서 정보를 불러오는 중입니다...
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.report_title_label') || '보고서 제목'} <span className="text-red-500">*</span></label>
            <input
              value={watch('reportTitle') || ''}
              onChange={(e) => setValue('reportTitle', e.target.value, { shouldValidate: true })}
              placeholder={t('parents.apply.report_title_ph') || '보고서 제목 입력'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
            />
            {(errors as any).reportTitle && <p className="text-[11px] text-red-500">{(errors as any).reportTitle.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.report_content_label') || '결과 보고 내용'} <span className="text-red-500">*</span></label>
            <textarea
              value={watch('reportContent') || ''}
              onChange={(e) => setValue('reportContent', e.target.value, { shouldValidate: true })}
              placeholder={t('parents.apply.report_content_ph') || '체험학습의 결과 및 느낀 점을 작성해주세요.'}
              rows={6}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none"
            />
            {(errors as any).reportContent && <p className="text-[11px] text-red-500">{(errors as any).reportContent.message}</p>}
          </div>
        </>
      ) : (
        <>
          {/* 체험학습 신청서 - 모바일 카드 */}
          <div className="text-center pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">{t('parents.apply.fieldtrip_title') || '교외체험학습 신청서'}</h2>
            <p className="text-[11px] text-red-500 font-semibold mt-0.5">{t('parents.apply.fieldtrip_notice') || '체험학습 실시 7일 전 제출'}</p>
          </div>

          {/* 신청 기간 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.period') || '신청 기간'} <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={watchFieldTripStartDate || ''}
                onChange={(e) => setValue('tripPeriod.startDate', e.target.value, { shouldValidate: true })}
                className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400"
              />
              <span className="text-slate-400 text-xs">~</span>
              <input
                type="date"
                value={watchFieldTripEndDate || ''}
                onChange={(e) => setValue('tripPeriod.endDate', e.target.value, { shouldValidate: true })}
                className="flex-1 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400"
              />
            </div>
            {watchFieldTripTotalDays > 0 && (
              <p className="text-[11px] text-indigo-600 font-semibold">{t('parents.apply.total_days', { days: watchFieldTripTotalDays }) || `총 ${watchFieldTripTotalDays}일`} (주말·공휴일 제외 수업일수)</p>
            )}
            {overlappedBlackoutPeriod && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-start gap-1.5 mt-1 animate-in fade-in">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-bold">{t('parents.apply.disallowed_period_toast_title') || '신청 기간이 아닙니다.'}</p>
                  <p className="text-[11px] text-red-600 font-normal mt-0.5">
                    {overlappedBlackoutPeriod.reason} ({overlappedBlackoutPeriod.startDate.replace(/-/g, '.')} ~ {overlappedBlackoutPeriod.endDate.replace(/-/g, '.')})
                  </p>
                </div>
              </div>
            )}
            {(errors as any).tripPeriod?.startDate && <p className="text-[11px] text-red-500">{(errors as any).tripPeriod.startDate.message}</p>}
          </div>

          {/* 불인정 기간 안내 접이식 배너 */}
          <details className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
            <summary className="font-bold text-slate-700 cursor-pointer flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="text-red-500 font-bold">※</span>
                {t('parents.apply.blackout_notice_title') || '체험학습 신청 불가(불인정) 기간 안내'}
              </span>
              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                {blackoutPeriods.length}개 기간
              </Badge>
            </summary>
            <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
              <p className="text-[10px] text-red-600 font-medium">※ 허용 일수 초과 시, 초과 일수는 [미인정결석] 처리됩니다.</p>
              <div className="grid grid-cols-1 gap-1 pt-1">
                {blackoutPeriods.map((bp, i) => (
                  <div key={bp.id || i} className="flex justify-between items-center text-[10.5px] bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="font-mono text-slate-700 font-medium">{bp.startDate.replace(/-/g, '.')} ~ {bp.endDate.replace(/-/g, '.')}</span>
                    <span className="text-slate-500">{bp.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* 학습 형태 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.trip_type') || '학습 형태'} <span className="text-red-500">*</span></label>
            <select
              value={watch('tripType')}
              onChange={(e) => setValue('tripType', e.target.value as any, { shouldValidate: true })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 bg-white"
            >
              <option value="가족동반여행">{t('parents.apply.trip_type_family') || '가족동반여행'}</option>
              <option value="친인척 방문">{t('parents.apply.trip_type_relatives') || '친인척 방문'}</option>
              <option value="답사·견학 활동">{t('parents.apply.trip_type_cultural') || '답사·견학 활동'}</option>
              <option value="기타">{t('parents.apply.trip_type_other') || '기타'}</option>
            </select>
          </div>

          {/* 방문 장소 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.destination') || '방문 장소'} <span className="text-red-500">*</span></label>
            <input
              value={watch('destination') || ''}
              onChange={(e) => setValue('destination', e.target.value, { shouldValidate: true })}
              placeholder={t('parents.apply.destination_ph') || '방문할 국가 및 도시명'}
              className={`w-full border rounded-lg px-3 h-10 text-xs focus:outline-none ${
                (errors as any).destination ? 'border-destructive bg-destructive/5 focus:ring-2 focus:ring-destructive/20' : 'border-slate-300 focus:border-indigo-400'
              }`}
            />
            {(errors as any).destination && <p className="text-[11px] text-destructive font-medium">{(errors as any).destination.message}</p>}
          </div>

          {/* 목적 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.purpose') || '목적'} <span className="text-red-500">*</span></label>
            <input
              value={watch('purpose') || ''}
              onChange={(e) => setValue('purpose', e.target.value, { shouldValidate: true })}
              placeholder={t('parents.apply.purpose_ph') || '체험학습을 통해 달성하고자 하는 목적'}
              className={`w-full border rounded-lg px-3 h-10 text-xs focus:outline-none ${
                (errors as any).purpose ? 'border-destructive bg-destructive/5 focus:ring-2 focus:ring-destructive/20' : 'border-slate-300 focus:border-indigo-400'
              }`}
            />
            {(errors as any).purpose && <p className="text-[11px] text-destructive font-medium">{(errors as any).purpose.message}</p>}
          </div>

          {/* 학습 계획 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">{t('parents.apply.plan') || '학습 계획'} <span className="text-red-500">*</span></label>
            <textarea
              value={watch('detailedPlan') || ''}
              onChange={(e) => setValue('detailedPlan', e.target.value, { shouldValidate: true })}
              placeholder={t('parents.apply.plan_ph') || '일자별 이동 경로, 방문 장소 및 예상 활동'}
              rows={4}
              className={`w-full border rounded-lg p-3 text-xs focus:outline-none resize-none placeholder:text-slate-400 ${
                (errors as any).detailedPlan ? 'border-destructive bg-destructive/5 focus:ring-2 focus:ring-destructive/20' : 'border-slate-300 focus:border-indigo-400'
              }`}
            />
            {(errors as any).detailedPlan && <p className="text-[11px] text-destructive font-medium">{(errors as any).detailedPlan.message}</p>}
          </div>

          {/* 보호자 정보 (자동 고정 표시) */}
          <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200 space-y-1">
            <p className="text-[11px] text-slate-500 font-medium">보호자 정보 (학부모 설정에서 자동 적용)</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">성명:</span>
              <span className="font-bold text-slate-800">{profile?.parentName || '미설정'}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500">관계:</span>
              <span className="font-bold text-slate-800">{(profile as any)?.parentRelation || '미설정'}</span>
            </div>
            {(!(profile as any)?.parentRelation) && (
              <p className="text-[11px] text-amber-600">⚠ 설정 페이지에서 보호자 관계를 먼저 입력해 주세요.</p>
            )}
          </div>

          {/* 누적 체험학습 현황 */}
          {isOverFieldTripLimit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              연간 교외체험학습 허용 한도(20일)를 초과하여 신청할 수 없습니다.
            </div>
          )}
        </>
      )}

      {/* 모바일 제출 버튼 */}
      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || isOverLimit || (currentType === 'field-trip-report' && loadingOriginal)}
          className="w-full h-10 font-bold bg-primary text-primary-foreground text-xs sm:text-sm"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {currentType === 'field-trip-report' ? (t('parents.apply.submit_report_btn') || '결과보고서 제출') : (t('parents.apply.submit_btn') || '신청서 제출')}
        </Button>
      </div>
    </div>
  );
}
