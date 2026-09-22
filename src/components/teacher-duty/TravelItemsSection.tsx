'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Users, CalendarDays } from 'lucide-react';
import type { UseFormRegister, UseFormWatch, UseFormSetValue, UseFormGetValues, FieldArrayWithId, FieldErrors } from 'react-hook-form';
import type { DutyFormValues } from '@/app/(app)/teacher/duty/page';

export function TravelItemsSection({
  profile,
  openRepeatModal,
  appendTravel,
  errors,
  travelFields,
  register,
  watch,
  setValue,
  getValues,
  users,
  removeTravel,
}: {
  profile: any;
  openRepeatModal: () => void;
  appendTravel: (item: any) => void;
  errors: FieldErrors<DutyFormValues>;
  travelFields: FieldArrayWithId<DutyFormValues, 'travelItems', 'id'>[];
  register: UseFormRegister<DutyFormValues>;
  watch: UseFormWatch<DutyFormValues>;
  setValue: UseFormSetValue<DutyFormValues>;
  getValues: UseFormGetValues<DutyFormValues>;
  users: any[];
  removeTravel: (index: number) => void;
}) {
  return (
    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 p-4 rounded-xl border border-muted-foreground/10">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            💼 복수 출장 및 동행자 신청 목록
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            여러 날짜의 출장을 각각 한 행씩 입력하여 하나의 기안문으로 묶어 상신할 수 있습니다.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openRepeatModal()}
            className="text-primary border-primary/20 hover:bg-primary/10 w-full sm:w-auto text-xs"
          >
            <CalendarDays className="mr-1.5 h-4 w-4" /> 요일 반복 / 동행자 일괄 생성
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendTravel({
              date: new Date().toISOString().split('T')[0],
              subType: '관내',
              destination: '',
              reason: '',
              noExpensesPaid: false,
              useCompanyVehicle: false,
              travelers: profile ? [{ name: profile.name, email: profile.email }] : []
            })}
            className="text-primary border-primary/20 hover:bg-primary/10 w-full sm:w-auto text-xs"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" /> 일정 추가
          </Button>
        </div>
      </div>

      {errors.travelItems && (
        <p className="text-sm font-semibold text-destructive">{(errors.travelItems as any).message || '출장 일정을 올바르게 입력해주세요.'}</p>
      )}

      <div className="border rounded-xl overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b text-muted-foreground font-semibold text-xs text-left">
              <th className="p-3 min-w-[130px]">날짜*</th>
              <th className="p-3 min-w-[90px]">구분*</th>
              <th className="p-3 min-w-[150px]">목적지*</th>
              <th className="p-3 min-w-[180px]">동행자*</th>
              <th className="p-3 min-w-[180px]">옵션</th>
              <th className="p-3 min-w-[200px]">사유*</th>
              <th className="p-3 text-center w-12"></th>
            </tr>
          </thead>
          <tbody>
            {travelFields.map((field, index) => (
              <tr key={field.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                <td className="p-2">
                  <Input
                    type="date"
                    {...register(`travelItems.${index}.date` as const)}
                    className="h-9 text-xs"
                  />
                </td>
                <td className="p-2">
                  <Select
                    value={watch(`travelItems.${index}.subType` as const)}
                    onValueChange={(val) => setValue(`travelItems.${index}.subType` as const, val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="관내">관내</SelectItem>
                      <SelectItem value="관외">관외</SelectItem>
                      <SelectItem value="국외">국외</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2">
                  <Input
                    {...register(`travelItems.${index}.destination` as const)}
                    placeholder="목적지 입력"
                    className="h-9 text-xs"
                  />
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-1">
                      {watch(`travelItems.${index}.travelers` as const)?.map((tr: any, tIdx: number) => (
                        <span key={tr.email} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                          {tr.name}
                          <button
                            type="button"
                            onClick={() => {
                              const currentTravelers = getValues(`travelItems.${index}.travelers` as const) || [];
                              setValue(`travelItems.${index}.travelers` as const, currentTravelers.filter((_: any, i: number) => i !== tIdx));
                            }}
                            className="text-primary hover:text-destructive hover:scale-110 ml-0.5 text-xs font-bold transition-all"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>

                    <Select
                      onValueChange={(val) => {
                        if (val === 'ADD_SELF' && profile) {
                          const curr = getValues(`travelItems.${index}.travelers` as const) || [];
                          if (!curr.some((t: any) => t.email === profile.email)) {
                            setValue(`travelItems.${index}.travelers` as const, [...curr, { name: profile.name, email: profile.email }]);
                          }
                        } else if (val.startsWith('ADD_USER_')) {
                          const email = val.replace('ADD_USER_', '');
                          const u = users.find(x => x.email === email);
                          if (u) {
                            const curr = getValues(`travelItems.${index}.travelers` as const) || [];
                            if (!curr.some((t: any) => t.email === u.email)) {
                              setValue(`travelItems.${index}.travelers` as const, [...curr, { name: u.name, email: u.email }]);
                            }
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-[11px] text-muted-foreground bg-muted/30">
                        <span className="flex items-center gap-1"><Users size={12} /> 인원 추가</span>
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="ADD_SELF">본인 추가</SelectItem>
                        {users.map(u => (
                          <SelectItem key={`add-${index}-${u.email}`} value={`ADD_USER_${u.email}`}>{u.name} ({u.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={watch(`travelItems.${index}.noExpensesPaid` as const) || false}
                        onChange={(e) => setValue(`travelItems.${index}.noExpensesPaid` as const, e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      여비 부지급
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={watch(`travelItems.${index}.useCompanyVehicle` as const) || false}
                        onChange={(e) => setValue(`travelItems.${index}.useCompanyVehicle` as const, e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      관용차량 이용
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  <Input
                    {...register(`travelItems.${index}.reason` as const)}
                    placeholder="출장 사유 입력"
                    className="h-9 text-xs"
                  />
                </td>
                <td className="p-2 text-center">
                  {travelFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTravel(index)}
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
  );
}
