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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings2, RotateCcw, Save, Plus, Trash2, FileCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  YearlyPlanTemplateData,
  DEFAULT_YEARLY_TEMPLATE,
} from '@/lib/safety/templateTypes';
import {
  loadYearlyTemplate,
  saveYearlyTemplate,
} from '@/lib/safety/safetyTemplateService';

interface YearlyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function YearlyTemplateModal({
  isOpen,
  onClose,
  onSaved,
}: YearlyTemplateModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState<YearlyPlanTemplateData>(DEFAULT_YEARLY_TEMPLATE);

  // 모달 열릴 때 최신 템플릿 로드
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      loadYearlyTemplate()
        .then((data) => setFormData(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // 기본값으로 복원
  const handleResetToDefault = () => {
    if (confirm('모든 서식 설정을 기본 템플릿 값으로 초기화하시겠습니까?')) {
      setFormData(DEFAULT_YEARLY_TEMPLATE);
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
      await saveYearlyTemplate(formData);
      toast({
        title: '기본 서식 틀 저장 완료',
        description: '이제 학생 안전교육 기안문 및 붙임문서 작성 시 수정된 서식이 자동 적용됩니다.',
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

  // 과제 항목 추가/삭제
  const handleAddTask = () => {
    setFormData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { category: '신규 과제', details: '세부 실행 지침을 입력하세요.' }],
    }));
  };

  const handleRemoveTask = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, idx) => idx !== index),
    }));
  };

  const handleTaskChange = (index: number, field: 'category' | 'details', value: string) => {
    setFormData((prev) => {
      const nextTasks = [...prev.tasks];
      nextTasks[index] = { ...nextTasks[index], [field]: value };
      return { ...prev, tasks: nextTasks };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-slate-200">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  학생 안전교육 연간 운영 계획 기본 템플릿(틀) 설정
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  기안문 본문과 붙임 1(HTML) 문서에 공통 반영되는 기본 법령, 방침, 주요 추진 과제를 편집합니다.
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px]">
              기본 틀 관리
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
          {loading ? (
            <div className="py-12 text-center text-slate-400">서식 템플릿을 불러오는 중...</div>
          ) : (
            <>
              {/* 1. 관련 법령 및 기본 정보 */}
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-rose-600" />
                  1. 기안문 본문 기본 정보
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">관련 법령 및 근거</Label>
                    <Input
                      value={formData.legalBasis}
                      onChange={(e) => setFormData({ ...formData, legalBasis: e.target.value })}
                      placeholder="초·중등교육법 제23조 및 학교안전사고 예방 및 보상에 관한 법률 제8조"
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">대상 학생</Label>
                    <Input
                      value={formData.targetGrades}
                      onChange={(e) => setFormData({ ...formData, targetGrades: e.target.value })}
                      placeholder="초등 1~6학년 전교생"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 3대 추진 목표 (붙임 1. 목적란) */}
              <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <Label className="font-bold text-slate-900 flex items-center justify-between">
                  <span>2. 교육 기본 목표 (붙임문서 목적)</span>
                  <span className="text-[10px] text-slate-400 font-normal">줄 단위로 분리 입력</span>
                </Label>
                {formData.goals.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <Input
                      value={g}
                      onChange={(e) => {
                        const nextGoals = [...formData.goals];
                        nextGoals[idx] = e.target.value;
                        setFormData({ ...formData, goals: nextGoals });
                      }}
                      className="h-8 text-xs bg-white flex-1"
                    />
                  </div>
                ))}
              </div>

              {/* 3. 주요 추진 과제 및 운영 방침 (붙임 2. 방침 및 기안문 다항) */}
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-slate-900">
                    3. 주요 추진 과제 및 세부 운영 방침
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddTask}
                    className="h-7 text-[11px] px-2 border-slate-300 text-slate-700 hover:bg-white"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-rose-600" /> 과제 추가
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {formData.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5 relative group"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={task.category}
                          onChange={(e) => handleTaskChange(idx, 'category', e.target.value)}
                          placeholder="과제 구분명 (예: 7대 영역 시수 확보)"
                          className="h-7 text-xs font-bold w-1/3 bg-slate-50"
                        />
                        <Input
                          value={task.details}
                          onChange={(e) => handleTaskChange(idx, 'details', e.target.value)}
                          placeholder="세부 실행 내용"
                          className="h-7 text-xs flex-1 bg-white"
                        />
                        {formData.tasks.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveTask(idx)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. 재난대피 훈련 및 가정연계 요약 문구 */}
              <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <Label className="font-bold text-slate-900">
                  4. 재난대피 훈련 및 가정연계 안내 문구
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">지진대피 훈련 요약</span>
                    <Input
                      value={formData.evacuationSummary.earthquake}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          evacuationSummary: { ...formData.evacuationSummary, earthquake: e.target.value },
                        })
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">화재대피 훈련 요약</span>
                    <Input
                      value={formData.evacuationSummary.fire}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          evacuationSummary: { ...formData.evacuationSummary, fire: e.target.value },
                        })
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">여름방학 가정연계 (폭염 등)</span>
                    <Input
                      value={formData.homeLinkSummary.heatwave}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homeLinkSummary: { ...formData.homeLinkSummary, heatwave: e.target.value },
                        })
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">겨울방학 가정연계 (가정생활 등)</span>
                    <Input
                      value={formData.homeLinkSummary.homeLiving}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homeLinkSummary: { ...formData.homeLinkSummary, homeLiving: e.target.value },
                        })
                      }
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
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
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white h-8 px-4"
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
