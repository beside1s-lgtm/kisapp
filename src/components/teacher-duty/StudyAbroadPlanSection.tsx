'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Trash2 } from 'lucide-react';
import type { UseFormRegister, UseFormWatch, UseFormSetValue, FieldArrayWithId, FieldErrors } from 'react-hook-form';
import type { DutyFormValues } from '@/app/(app)/teacher/duty/page';

export function StudyAbroadPlanSection({
  register,
  errors,
  watch,
  setValue,
  fields,
  append,
  remove,
}: {
  register: UseFormRegister<DutyFormValues>;
  errors: FieldErrors<DutyFormValues>;
  watch: UseFormWatch<DutyFormValues>;
  setValue: UseFormSetValue<DutyFormValues>;
  fields: FieldArrayWithId<DutyFormValues, 'studyAbroadPlan.schedules', 'id'>[];
  append: (item: any) => void;
  remove: (index: number) => void;
}) {
  return (
    <div className="space-y-6 pt-6 border-t-2 border-primary/20 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
        <h3 className="text-lg font-bold text-primary flex items-center gap-2">
          📄 국외자율연수를 위한 공무외국외여행 계획서 작성
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          국외자율연수 시에는 학교장 승인을 받기 위한 공무외국외여행 계획서 제출이 필수적입니다. 아래 양식의 모든 정보를 상세히 입력해 주세요.
        </p>
      </div>

      {/* 기본 인적 사항 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="font-bold text-sm">소속</Label>
          <Input {...register('studyAbroadPlan.affiliation')} className="h-12" placeholder="예: 서울송정초등학교" />
          {errors.studyAbroadPlan?.affiliation && (
            <p className="text-xs text-destructive">{errors.studyAbroadPlan.affiliation.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-sm">직위(급)</Label>
          <Input {...register('studyAbroadPlan.position')} className="h-12" placeholder="예: 교사" />
          {errors.studyAbroadPlan?.position && (
            <p className="text-xs text-destructive">{errors.studyAbroadPlan.position.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-sm">성명</Label>
          <Input {...register('studyAbroadPlan.name')} className="h-12" placeholder="예: 홍길동" />
          {errors.studyAbroadPlan?.name && (
            <p className="text-xs text-destructive">{errors.studyAbroadPlan.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-sm">과목</Label>
          <Input {...register('studyAbroadPlan.subject')} className="h-12" placeholder="예: 공통" />
          {errors.studyAbroadPlan?.subject && (
            <p className="text-xs text-destructive">{errors.studyAbroadPlan.subject.message}</p>
          )}
        </div>
      </div>

      {/* 기간 정보 (자동 연동 & 노출) */}
      <div className="space-y-2">
        <Label className="font-bold text-sm">연수 기간 (복무 신청 기간과 자동 연동)</Label>
        <div className="p-4 bg-muted/30 border rounded-lg h-12 flex items-center text-sm font-semibold text-gray-700">
          {(() => {
            const sDate = watch('startDate');
            const eDate = watch('endDate');
            const tDays = watch('totalDays');
            return sDate && eDate
              ? `${sDate.replace(/-/g, '.')} - ${eDate.replace(/-/g, '.')} (${tDays || 0})일간`
              : '시작일과 종료일을 먼저 입력해 주세요.';
          })()}
        </div>
      </div>

      {/* 연수 구분 */}
      <div className="space-y-3">
        <Label className="font-bold text-sm">연수 구분</Label>
        <RadioGroup
          value={watch('studyAbroadPlan.category')}
          onValueChange={(val) => setValue('studyAbroadPlan.category', val)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {[
            '교직단체가 주관하는 연수',
            '해외 교육기관의 초청',
            '개인의 학습자료 수집',
            '기타'
          ].map((cat) => (
            <div key={cat} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/30 transition-colors">
              <RadioGroupItem value={cat} id={`cat-${cat}`} />
              <Label htmlFor={`cat-${cat}`} className="cursor-pointer text-sm font-medium w-full">{cat}</Label>
            </div>
          ))}
        </RadioGroup>
        {watch('studyAbroadPlan.category') === '기타' && (
          <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
            <Label className="font-bold text-xs text-muted-foreground">기타 상세 내용</Label>
            <Input {...register('studyAbroadPlan.categoryEtcDetail')} placeholder="기타 연수 구분을 구체적으로 적어주세요." className="h-10 mt-1" />
          </div>
        )}
        {errors.studyAbroadPlan?.category && (
          <p className="text-xs text-destructive">{errors.studyAbroadPlan.category.message}</p>
        )}
      </div>

      {/* 목적(배경) */}
      <div className="space-y-2">
        <Label className="font-bold text-sm">목적 (배경)</Label>
        <Textarea
          {...register('studyAbroadPlan.purpose')}
          placeholder="연수를 통해 넓히고자 하는 견문이나 목적, 수집하려는 자료의 활용 계획 등을 작성해 주세요."
          className="min-h-[100px] text-sm"
        />
        {errors.studyAbroadPlan?.purpose && (
          <p className="text-xs text-destructive">{errors.studyAbroadPlan.purpose.message}</p>
        )}
      </div>

      {/* 연수 세부 일정 */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="font-bold text-sm">연수 세부 일정</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ date: '', departure: '', destination: '', institution: '', content: '', note: '' })}
            className="text-primary hover:text-primary-foreground hover:bg-primary"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" /> 일정 추가
          </Button>
        </div>
        {errors.studyAbroadPlan?.schedules && (
          <p className="text-xs text-destructive">세부 일정의 모든 행의 필수 항목(날짜, 방문기관, 연수내용)을 올바르게 채워 주세요.</p>
        )}

        <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground font-semibold text-xs">
                <th className="p-3 text-left min-w-[90px]">월 일*</th>
                <th className="p-3 text-left min-w-[100px]">출발지</th>
                <th className="p-3 text-left min-w-[100px]">도착지</th>
                <th className="p-3 text-left min-w-[150px]">방문기관*</th>
                <th className="p-3 text-left min-w-[200px]">연수 내용*</th>
                <th className="p-3 text-left min-w-[100px]">비고</th>
                <th className="p-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="p-2">
                    <Input {...register(`studyAbroadPlan.schedules.${index}.date` as const)} placeholder="예: 8.4" className="h-9 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input {...register(`studyAbroadPlan.schedules.${index}.departure` as const)} placeholder="예: 인천" className="h-9 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input {...register(`studyAbroadPlan.schedules.${index}.destination` as const)} placeholder="예: 괌" className="h-9 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input {...register(`studyAbroadPlan.schedules.${index}.institution` as const)} placeholder="예: 사랑의 절벽" className="h-9 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input {...register(`studyAbroadPlan.schedules.${index}.content` as const)} placeholder="예: 유적지 답사 및 자료 수집" className="h-9 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input {...register(`studyAbroadPlan.schedules.${index}.note` as const)} className="h-9 text-xs" />
                  </td>
                  <td className="p-2 text-center">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 연수 효과 */}
      <div className="space-y-2">
        <Label className="font-bold text-sm">연수 효과</Label>
        <Textarea
          {...register('studyAbroadPlan.effects')}
          placeholder="연수를 통해 기대하는 교육적 효과, 교과 지도 및 학생 생활 지도에의 기여 방안 등을 작성해 주세요."
          className="min-h-[100px] text-sm"
        />
        {errors.studyAbroadPlan?.effects && (
          <p className="text-xs text-destructive">{errors.studyAbroadPlan.effects.message}</p>
        )}
      </div>
    </div>
  );
}
