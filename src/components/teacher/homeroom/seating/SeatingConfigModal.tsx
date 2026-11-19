'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Minus, Plus, HelpCircle, Users, Check } from 'lucide-react';
import type {
  SeatingConfig,
  SeatingLayoutType,
  GenderPairType,
  RevealEffectType,
} from '@/lib/types/seating';
import { DEFAULT_SEATING_CONFIG } from '@/lib/types/seating';

interface SeatingConfigModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: SeatingConfig;
  studentCount: number;
  onApplyConfig: (config: SeatingConfig) => void;
}

export const SeatingConfigModal: React.FC<SeatingConfigModalProps> = ({
  isOpen,
  onOpenChange,
  initialConfig,
  studentCount,
  onApplyConfig,
}) => {
  const [config, setConfig] = useState<SeatingConfig>(initialConfig || DEFAULT_SEATING_CONFIG);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    } else {
      const defaultTitle = `${new Date().getMonth() + 1}월 자리배치도`;
      setConfig({ ...DEFAULT_SEATING_CONFIG, title: defaultTitle });
    }
  }, [initialConfig, isOpen]);

  // 대형 유형 전환
  const handleLayoutChange = (layoutType: SeatingLayoutType) => {
    setConfig((prev) => ({ ...prev, layoutType }));
  };

  // 분단 수 변경
  const handleDivisionCountChange = (delta: number) => {
    setConfig((prev) => {
      const maxCount = prev.rowConfig.rowType === 1 ? 6 : 4;
      const newCount = Math.max(1, Math.min(maxCount, prev.rowConfig.divisionCount + delta));
      return {
        ...prev,
        rowConfig: { ...prev.rowConfig, divisionCount: newCount },
      };
    });
  };

  // 자유형 슬롯 토글
  const toggleFreeSlot = (slotId: string) => {
    setConfig((prev) => {
      const set = new Set(prev.freeConfig.activeSlotIds);
      if (set.has(slotId)) {
        set.delete(slotId);
      } else {
        set.add(slotId);
      }
      return {
        ...prev,
        freeConfig: { ...prev.freeConfig, activeSlotIds: Array.from(set) },
      };
    });
  };

  // 자유형 초기 슬롯 자동 채우기 (학생 수만큼)
  useEffect(() => {
    if (config.layoutType === 'FREE' && config.freeConfig.activeSlotIds.length === 0) {
      const needed = Math.max(studentCount, 20);
      const initialIds: string[] = [];
      let count = 0;
      for (let r = 0; r < config.freeConfig.gridRows && count < needed; r++) {
        for (let c = 0; c < config.freeConfig.gridCols && count < needed; c++) {
          initialIds.push(`free_${r}_${c}`);
          count++;
        }
      }
      setConfig((prev) => ({
        ...prev,
        freeConfig: { ...prev.freeConfig, activeSlotIds: initialIds },
      }));
    }
  }, [config.layoutType, studentCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyConfig(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold text-slate-900 text-center">
            자리배치도 설정
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* 1. 자리배치도 이름 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">자리배치도 이름</Label>
            <Input
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="예: 9월 자리배치도"
              className="h-10 text-sm rounded-xl border-slate-300"
              required
            />
          </div>

          {/* 2. 대형 유형 선택 (탭) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">대형 유형 선택</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { type: 'ROW', label: '분단형' },
                  { type: 'GROUP', label: '모둠형' },
                  { type: 'FREE', label: '자유형' },
                ] as const
              ).map(({ type, label }) => {
                const isActive = config.layoutType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleLayoutChange(type)}
                    className={`h-11 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-A. 분단형 설정 */}
          {config.layoutType === 'ROW' && (
            <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-white">
              {/* 분단 설정 */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">분단 설정</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    *1열은 최대 6분단, 2열은 최대 4분단 까지 생성할 수 있습니다.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* 1열 카드 */}
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        rowConfig: {
                          ...config.rowConfig,
                          rowType: 1,
                          divisionCount: Math.min(config.rowConfig.divisionCount, 6),
                        },
                      })
                    }
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                      config.rowConfig.rowType === 1
                        ? 'border-orange-400 bg-orange-50/70 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-1 items-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-5 h-2.5 rounded-xs bg-amber-700/60" />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-800">1열</span>
                  </button>

                  {/* 2열 카드 */}
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        rowConfig: {
                          ...config.rowConfig,
                          rowType: 2,
                          divisionCount: Math.min(config.rowConfig.divisionCount, 4),
                        },
                      })
                    }
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                      config.rowConfig.rowType === 2
                        ? 'border-orange-400 bg-orange-50/70 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-1 items-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex gap-1">
                          <div className="w-4 h-2.5 rounded-xs bg-amber-700/60" />
                          <div className="w-4 h-2.5 rounded-xs bg-amber-700/60" />
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-800">2열</span>
                  </button>

                  {/* 분단 수 카운터 */}
                  <div className="p-2 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center gap-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDivisionCountChange(-1)}
                        className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow-2xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xl font-black text-slate-900 w-6 text-center">
                        {config.rowConfig.divisionCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDivisionCountChange(1)}
                        className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">분단</span>
                  </div>
                </div>
              </div>

              {/* 짝꿍 설정 */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">짝꿍 설정</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    *자리 자동배치 시 짝꿍의 성별을 설정할 수 있습니다.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'RANDOM', label: '랜덤', sub: '상관없음' },
                      { key: 'OPPOSITE', label: '이성끼리', sub: '남+여' },
                      { key: 'SAME', label: '동성끼리', sub: '남+남/여+여' },
                    ] as const
                  ).map(({ key, label, sub }) => {
                    const isSel = config.rowConfig.genderPair === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            rowConfig: { ...config.rowConfig, genderPair: key },
                          })
                        }
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          isSel
                            ? 'border-orange-400 bg-orange-50/70 shadow-2xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-0.5 text-slate-600">
                          {key === 'RANDOM' && (
                            <div className="flex gap-1">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-black flex items-center justify-center">?</span>
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-black flex items-center justify-center">?</span>
                            </div>
                          )}
                          {key === 'OPPOSITE' && (
                            <div className="flex gap-1">
                              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center justify-center">여</span>
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">남</span>
                            </div>
                          )}
                          {key === 'SAME' && (
                            <div className="flex gap-1">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">동</span>
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">동</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-800">{label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="avoidPartnerRow"
                    checked={config.rowConfig.avoidPreviousPartner}
                    onCheckedChange={(val) =>
                      setConfig({
                        ...config,
                        rowConfig: {
                          ...config.rowConfig,
                          avoidPreviousPartner: !!val,
                        },
                      })
                    }
                  />
                  <Label htmlFor="avoidPartnerRow" className="text-xs font-medium text-slate-700 cursor-pointer">
                    이전 짝꿍과 같이 안 앉기
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* 3-B. 모둠형 설정 */}
          {config.layoutType === 'GROUP' && (
            <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-white">
              {/* 모둠 설정 */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">모둠 설정</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    *모둠에 포함할 인원수를 선택해주세요.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {([3, 4, 5, 6] as const).map((size) => {
                    const isSel = config.groupConfig.groupSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            groupConfig: { ...config.groupConfig, groupSize: size },
                          })
                        }
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          isSel
                            ? 'border-orange-400 bg-orange-50/70 shadow-2xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap w-8 h-8 items-center justify-center gap-0.5">
                          {[...Array(size)].map((_, i) => (
                            <div key={i} className="w-3.5 h-2 rounded-xs bg-amber-700/60" />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-800">{size}인</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="mergeRemaining"
                    checked={config.groupConfig.mergeRemaining}
                    onCheckedChange={(val) =>
                      setConfig({
                        ...config,
                        groupConfig: {
                          ...config.groupConfig,
                          mergeRemaining: !!val,
                        },
                      })
                    }
                  />
                  <Label htmlFor="mergeRemaining" className="text-xs font-medium text-slate-700 cursor-pointer">
                    남는 학생은 기존 모둠에 합하기
                  </Label>
                </div>
              </div>

              {/* 모둠 짝꿍 설정 */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">짝꿍 설정</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    *자리 자동배치 시 짝꿍의 성별을 설정할 수 있습니다.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'RANDOM', label: '랜덤' },
                      { key: 'OPPOSITE', label: '이성끼리' },
                      { key: 'SAME', label: '동성끼리' },
                    ] as const
                  ).map(({ key, label }) => {
                    const isSel = config.groupConfig.genderPair === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            groupConfig: { ...config.groupConfig, genderPair: key },
                          })
                        }
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          isSel
                            ? 'border-orange-400 bg-orange-50/70 shadow-2xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <Users className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-bold text-slate-800">{label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="avoidPartnerGroup"
                    checked={config.groupConfig.avoidPreviousPartner}
                    onCheckedChange={(val) =>
                      setConfig({
                        ...config,
                        groupConfig: {
                          ...config.groupConfig,
                          avoidPreviousPartner: !!val,
                        },
                      })
                    }
                  />
                  <Label htmlFor="avoidPartnerGroup" className="text-xs font-medium text-slate-700 cursor-pointer">
                    이전 짝꿍과 같이 안 앉기
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* 3-C. 자유형 설정 */}
          {config.layoutType === 'FREE' && (
            <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">자유 대형 설정</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    *대형 안에서 학생의 자리를 자유롭게 설정할 수 있습니다. 사용할 자리를 선택해주세요.
                  </p>
                </div>
                <div className="text-xs font-bold">
                  <span className="text-orange-500 font-black">{config.freeConfig.activeSlotIds.length}</span>
                  <span className="text-slate-400"> / 56</span>
                </div>
              </div>

              {/* 칠판 표시 */}
              <div className="w-full flex justify-center">
                <div className="bg-emerald-800 text-white text-xs font-bold px-12 py-1.5 rounded-lg shadow-inner">
                  칠판
                </div>
              </div>

              {/* 7행 x 8열 책상 그리드 */}
              <div className="grid grid-cols-8 gap-1.5 max-w-lg mx-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {[...Array(config.freeConfig.gridRows)].map((_, r) =>
                  [...Array(config.freeConfig.gridCols)].map((_, c) => {
                    const slotId = `free_${r}_${c}`;
                    const isSelected = config.freeConfig.activeSlotIds.includes(slotId);
                    return (
                      <button
                        key={slotId}
                        type="button"
                        onClick={() => toggleFreeSlot(slotId)}
                        className={`h-7 rounded-sm border transition-all ${
                          isSelected
                            ? 'bg-amber-100 border-amber-600 shadow-2xs'
                            : 'bg-slate-200/70 border-slate-300 hover:bg-slate-300'
                        }`}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. 자리배치 결과보기 효과 선택 */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Label className="text-xs font-bold text-slate-800">
              자리배치 결과보기 효과 선택
            </Label>
            <RadioGroup
              value={config.revealEffect}
              onValueChange={(val) =>
                setConfig({ ...config, revealEffect: val as RevealEffectType })
              }
              className="flex items-center gap-6"
            >
              <div className="flex items-center space-x-2 cursor-pointer">
                <RadioGroupItem value="ONE_BY_ONE" id="effect-one" />
                <Label htmlFor="effect-one" className="text-xs font-medium cursor-pointer">
                  한 명씩 보기
                </Label>
              </div>
              <div className="flex items-center space-x-2 cursor-pointer">
                <RadioGroupItem value="ALL_AT_ONCE" id="effect-all" />
                <Label htmlFor="effect-all" className="text-xs font-medium cursor-pointer">
                  한 번에 보기
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 5. 만들기 제출 버튼 */}
          <div className="pt-2 flex justify-center">
            <Button
              type="submit"
              className="w-64 h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full text-base shadow-md transition-all active:scale-95"
            >
              만들기
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
