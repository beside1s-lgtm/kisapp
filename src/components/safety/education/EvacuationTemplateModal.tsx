'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  ShieldAlert,
  Clock,
  MapPin,
  ListChecks,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  EvacuationPlanTemplateData,
  DEFAULT_EVACUATION_TEMPLATE,
} from '@/lib/safety/templateTypes';
import {
  loadEvacuationTemplate,
  saveEvacuationTemplate,
} from '@/lib/safety/safetyTemplateService';

interface EvacuationTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function EvacuationTemplateModal({
  isOpen,
  onClose,
  onSaved,
}: EvacuationTemplateModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState<EvacuationPlanTemplateData>(DEFAULT_EVACUATION_TEMPLATE);
  const [activeTab, setActiveTab] = useState<'info' | 'prep' | 'schedule' | 'routes'>('info');

  // 모달 열릴 때 최신 템플릿 로드
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      loadEvacuationTemplate()
        .then((data) => setFormData(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // 기본값으로 복원
  const handleResetToDefault = () => {
    if (confirm('모든 재난대피 훈련 서식 설정을 기본 템플릿 값으로 초기화하시겠습니까?')) {
      setFormData(DEFAULT_EVACUATION_TEMPLATE);
      toast({
        title: '기본값 복원 완료',
        description: '저장 버튼을 누르면 기본 서식으로 확정 저장됩니다.',
      });
    }
  };

  // 저장 실행
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEvacuationTemplate(formData);
      toast({
        title: '재난대피 훈련 서식 틀 저장 완료',
        description: '지진 및 화재 대피 훈련 기안문 작성 시 수정된 서식이 자동 적용됩니다.',
      });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: '서식 설정 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setSaving(false);
    }
  };

  // 사전 준비 점검표 항목 제어
  const handleAddPrepTask = () => {
    setFormData((prev) => ({
      ...prev,
      prepTasks: [
        ...prev.prepTasks,
        {
          no: prev.prepTasks.length + 1,
          title: '신규 점검 항목',
          content: '세부 점검 내용을 입력하세요.',
          schedule: '훈련 3일 전',
          manager: '담당 부서',
        },
      ],
    }));
  };

  const handleRemovePrepTask = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      prepTasks: prev.prepTasks.filter((_, idx) => idx !== index),
    }));
  };

  // 타임테이블 항목 제어
  const handleAddTimeTable = () => {
    setFormData((prev) => ({
      ...prev,
      timeTable: [
        ...prev.timeTable,
        {
          no: prev.timeTable.length + 1,
          stage: '신규 훈련 단계',
          time: '14:30',
          content: '훈련 진행 상세 내용',
          manager: '담당 교사',
        },
      ],
    }));
  };

  const handleRemoveTimeTable = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      timeTable: prev.timeTable.filter((_, idx) => idx !== index),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-slate-200">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  재난(지진/화재) 대피 훈련 계획 기본 템플릿(틀) 설정
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  기안문 본문과 붙임 1(2페이지 완결)의 점검표, 타임테이블, 8대 수칙, 층별 대피 경로를 커스텀 편집합니다.
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-[10px]">
              기본 틀 관리
            </Badge>
          </div>

          {/* 서브 탭 바 */}
          <div className="flex items-center gap-1.5 pt-3">
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'info' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('info')}
              className={`h-7 px-3 text-xs font-bold rounded-lg ${
                activeTab === 'info' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1" /> 기본 근거/방침
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'prep' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('prep')}
              className={`h-7 px-3 text-xs font-bold rounded-lg ${
                activeTab === 'prep' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 mr-1" /> 사전 준비 점검표
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'schedule' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('schedule')}
              className={`h-7 px-3 text-xs font-bold rounded-lg ${
                activeTab === 'schedule' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 mr-1" /> 당일 타임테이블
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'routes' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('routes')}
              className={`h-7 px-3 text-xs font-bold rounded-lg ${
                activeTab === 'routes' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 mr-1" /> 층별 동선 & 수칙
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-700">
          {loading ? (
            <div className="py-12 text-center text-slate-400">서식 템플릿을 불러오는 중...</div>
          ) : (
            <>
              {/* 탭 1: 기본 근거 및 방침 */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  <div className="space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <Label className="text-xs font-bold text-slate-900">관련 근거 법령 및 지침</Label>
                    <Input
                      value={formData.legalBasis}
                      onChange={(e) => setFormData({ ...formData, legalBasis: e.target.value })}
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <Label className="text-xs font-bold text-slate-900">훈련 목적 (3대 핵심 목적)</Label>
                    {formData.objectives.map((obj, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                        <Input
                          value={obj}
                          onChange={(e) => {
                            const next = [...formData.objectives];
                            next[idx] = e.target.value;
                            setFormData({ ...formData, objectives: next });
                          }}
                          className="h-8 text-xs bg-white flex-1"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <Label className="text-xs font-bold text-slate-900">기본 방침</Label>
                    {formData.guidelines.map((guide, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                        <Input
                          value={guide}
                          onChange={(e) => {
                            const next = [...formData.guidelines];
                            next[idx] = e.target.value;
                            setFormData({ ...formData, guidelines: next });
                          }}
                          className="h-8 text-xs bg-white flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 탭 2: 사전 준비 점검표 */}
              {activeTab === 'prep' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-bold text-slate-900">사전 준비 목록 및 점검표 (붙임문서 2번 표)</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddPrepTask}
                      className="h-7 text-xs border-slate-300"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1 text-blue-600" /> 항목 추가
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formData.prepTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-600 text-xs w-6 text-center">{idx + 1}</span>
                          <Input
                            value={task.title}
                            onChange={(e) => {
                              const next = [...formData.prepTasks];
                              next[idx].title = e.target.value;
                              setFormData({ ...formData, prepTasks: next });
                            }}
                            placeholder="점검 구분 (예: 소방시설 점검)"
                            className="h-7 text-xs font-bold w-1/4 bg-white"
                          />
                          <Input
                            value={task.schedule}
                            onChange={(e) => {
                              const next = [...formData.prepTasks];
                              next[idx].schedule = e.target.value;
                              setFormData({ ...formData, prepTasks: next });
                            }}
                            placeholder="추진일정 (예: 훈련 1주 전)"
                            className="h-7 text-xs w-28 bg-white"
                          />
                          <Input
                            value={task.manager}
                            onChange={(e) => {
                              const next = [...formData.prepTasks];
                              next[idx].manager = e.target.value;
                              setFormData({ ...formData, prepTasks: next });
                            }}
                            placeholder="담당 부서 (예: 행정실)"
                            className="h-7 text-xs w-28 bg-white"
                          />
                          {formData.prepTasks.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemovePrepTask(idx)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <Input
                          value={task.content}
                          onChange={(e) => {
                            const next = [...formData.prepTasks];
                            next[idx].content = e.target.value;
                            setFormData({ ...formData, prepTasks: next });
                          }}
                          placeholder="세부 점검 내용"
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 탭 3: 당일 타임테이블 */}
              {activeTab === 'schedule' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-bold text-slate-900">훈련 당일 일정 및 타임테이블 (붙임문서 3번 표)</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddTimeTable}
                      className="h-7 text-xs border-slate-300"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1 text-blue-600" /> 단계 추가
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formData.timeTable.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-600 text-xs w-6 text-center">{idx + 1}</span>
                          <Input
                            value={item.stage}
                            onChange={(e) => {
                              const next = [...formData.timeTable];
                              next[idx].stage = e.target.value;
                              setFormData({ ...formData, timeTable: next });
                            }}
                            placeholder="훈련 단계명"
                            className="h-7 text-xs font-bold w-1/3 bg-white"
                          />
                          <Input
                            value={item.time}
                            onChange={(e) => {
                              const next = [...formData.timeTable];
                              next[idx].time = e.target.value;
                              setFormData({ ...formData, timeTable: next });
                            }}
                            placeholder="시간 (예: 14:10-14:30)"
                            className="h-7 text-xs w-28 bg-white font-bold text-blue-600"
                          />
                          <Input
                            value={item.manager}
                            onChange={(e) => {
                              const next = [...formData.timeTable];
                              next[idx].manager = e.target.value;
                              setFormData({ ...formData, timeTable: next });
                            }}
                            placeholder="담당 (예: 수업 교사)"
                            className="h-7 text-xs w-28 bg-white"
                          />
                          {formData.timeTable.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveTimeTable(idx)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                        <Input
                          value={item.content}
                          onChange={(e) => {
                            const next = [...formData.timeTable];
                            next[idx].content = e.target.value;
                            setFormData({ ...formData, timeTable: next });
                          }}
                          placeholder="훈련 진행 세부 내용"
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 탭 4: 층별 동선 및 수칙 */}
              {activeTab === 'routes' && (
                <div className="space-y-4">
                  <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <Label className="font-bold text-slate-900">
                      초등 본관 층별 대피 동선 및 집결지 안내 (구분자는 | 기호 사용)
                    </Label>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-blue-700">[1층 대피 집결지]</span>
                      <Input
                        value={formData.floorRoutes.floor1Assembly}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            floorRoutes: { ...formData.floorRoutes, floor1Assembly: e.target.value },
                          })
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-emerald-700">[2층 대피 동선 (1~3학년)]</span>
                      <Input
                        value={formData.floorRoutes.floor2Routes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            floorRoutes: { ...formData.floorRoutes, floor2Routes: e.target.value },
                          })
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-amber-700">[3층 대피 동선 (4~6학년)]</span>
                      <Input
                        value={formData.floorRoutes.floor3Routes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            floorRoutes: { ...formData.floorRoutes, floor3Routes: e.target.value },
                          })
                        }
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                    <Label className="font-bold text-slate-900">대피 방법 8대 수칙</Label>
                    {formData.rules.map((rule, idx) => (
                      <Input
                        key={idx}
                        value={rule}
                        onChange={(e) => {
                          const next = [...formData.rules];
                          next[idx] = e.target.value;
                          setFormData({ ...formData, rules: next });
                        }}
                        className="h-7 text-xs bg-white"
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            className="text-xs text-slate-500 hover:text-slate-800 h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 기본값으로 복원
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 border-slate-300"
            >
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white h-8 px-4"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? '저장 중...' : '서식 틀 저장'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
