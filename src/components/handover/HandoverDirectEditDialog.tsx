'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { HandoverDocument, HandoverItem } from '@/lib/types/handover';
import { UserProfile } from '@/lib/types';
import {
  compareHandoverItemsAsc,
  updateHandoverByReviewer,
} from '@/lib/services/handoverService';
import {
  HANDOVER_MANUAL_PERIOD_OPTIONS,
  applyEditedTimelineItem,
  inferHandoverTimingMetaFromPeriod,
  normalizeHandoverPeriodLabel,
} from '@/lib/handover/systemDutyBlueprints';
import { HandoverTimelineItemCard } from './HandoverTimelineItemCard';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Plus, Save } from 'lucide-react';

interface HandoverDirectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: HandoverDocument | null;
  currentUserProfile: UserProfile;
  reviewerRoleLabel?: string;
  onSaved?: (updatedDoc: HandoverDocument) => void;
}

const PERIOD_OPTIONS = [...HANDOVER_MANUAL_PERIOD_OPTIONS];

export function HandoverDirectEditDialog({
  open,
  onOpenChange,
  document,
  currentUserProfile,
  reviewerRoleLabel = '교감',
  onSaved,
}: HandoverDirectEditDialogProps) {
  const { toast } = useToast();

  const [primaryDuty, setPrimaryDuty] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [generalGuide, setGeneralGuide] = useState('');
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 항목 직접 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPeriod, setNewPeriod] = useState<string>(PERIOD_OPTIONS[0]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSummary, setNewSummary] = useState('');

  useEffect(() => {
    if (open && document) {
      setPrimaryDuty(document.primaryDuty || '');
      setFolderUrl(document.folderUrl || '');
      setContactInfo(document.contactInfo || '');
      setGeneralGuide(document.generalGuide || '');
      setItems([...(document.items || [])].sort(compareHandoverItemsAsc));
      setEditingItemId(null);
      setShowAddForm(false);
      setNewTitle('');
      setNewSummary('');
    }
  }, [open, document]);

  const handleSaveItemEdit = (
    itemId: string,
    patch: { period: string; documentTitle: string; summary: string }
  ) => {
    setItems((prev) =>
      applyEditedTimelineItem(prev, itemId, patch).sort(compareHandoverItemsAsc)
    );
    setEditingItemId(null);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    if (editingItemId === itemId) setEditingItemId(null);
  };

  const handleAddItem = () => {
    if (!newTitle.trim()) {
      toast({ variant: 'destructive', description: '추가할 업무 항목 제목을 입력하세요.' });
      return;
    }
    const normalizedPeriod = normalizeHandoverPeriodLabel(newPeriod);
    const meta = inferHandoverTimingMetaFromPeriod(normalizedPeriod);
    const newItem: HandoverItem = {
      id: `vp_edit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceType: 'manual',
      period: normalizedPeriod,
      scheduleLabel: meta.scheduleLabel,
      category: primaryDuty || document?.primaryDuty || '일반업무',
      documentTitle: newTitle.trim(),
      date: newDate || format(new Date(), 'yyyy-MM-dd'),
      summary: newSummary.trim(),
      timingKind: meta.timingKind,
      sortOrder: meta.sortOrder,
      userEdited: true,
    };
    setItems((prev) => [...prev, newItem].sort(compareHandoverItemsAsc));
    setNewTitle('');
    setNewSummary('');
    setShowAddForm(false);
  };

  const handleSaveAll = async () => {
    if (!document) return;
    if (!primaryDuty.trim()) {
      toast({ variant: 'destructive', description: '주 업무명은 비워둘 수 없습니다.' });
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateHandoverByReviewer(
        document.id,
        {
          primaryDuty: primaryDuty.trim(),
          folderUrl: folderUrl.trim(),
          contactInfo: contactInfo.trim(),
          generalGuide: generalGuide.trim(),
          items,
        },
        currentUserProfile,
        reviewerRoleLabel
      );
      toast({
        title: '직접 수정 저장 완료',
        description: `${updated.authorName} 교사의 "${updated.primaryDuty}" 인수인계서 수정 사항이 저장되었습니다.`,
      });
      onSaved?.(updated);
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '수정 저장 실패',
        description: err?.message || '인수인계서 직접 수정 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-5 bg-white border border-purple-200 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-700 hover:bg-purple-700 text-white font-bold text-xs gap-1">
              <Pencil className="w-3 h-3" />
              <span>{reviewerRoleLabel} 직접 수정</span>
            </Badge>
            <span className="text-xs text-slate-500">
              작성자: <b className="text-slate-800">{document?.authorName}</b> ({document?.authorDepartment || '소속 미지정'})
            </span>
          </div>
          <DialogTitle className="text-base font-black text-slate-900">
            인수인계서 내용 직접 수정 및 보완
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            수정한 내용은 현재 결재 대기 상태를 유지한 채 즉시 반영되며 수정자 이력이 기록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">주 업무명</Label>
              <Input
                value={primaryDuty}
                onChange={(e) => setPrimaryDuty(e.target.value)}
                className="h-8 text-xs font-bold bg-white border-slate-300"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold text-slate-700">전임자 비상 연락망</Label>
              <Input
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="h-8 text-xs bg-white border-slate-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">전년도 업무 드라이브 / 폴더 링크</Label>
            <Input
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="h-8 text-xs bg-white border-slate-300"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">총괄 인계 사항 및 운영 노하우</Label>
            <Textarea
              value={generalGuide}
              onChange={(e) => setGeneralGuide(e.target.value)}
              rows={4}
              className="text-xs bg-white border-slate-300 leading-relaxed"
            />
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-extrabold text-slate-800">
                시기별 업무 인계 타임라인 ({items.length}건)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="h-7 text-[11px] font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>{showAddForm ? '추가 폼 닫기' : '인계 항목 추가'}</span>
              </Button>
            </div>

            {showAddForm && (
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">업무명 / 과업 제목</Label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="예: 1학기 평가 계획 최종 확정"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">추진 시기</Label>
                    <Select value={newPeriod} onValueChange={setNewPeriod}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIOD_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">추진 일자</Label>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">세부 인계 사항 및 팁</Label>
                    <Input
                      value={newSummary}
                      onChange={(e) => setNewSummary(e.target.value)}
                      placeholder="인계 시 꼭 참고할 내용을 입력하세요."
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>타임라인에 반영</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  등록된 인계 항목이 없습니다.
                </div>
              ) : (
                items.map((item) => (
                  <HandoverTimelineItemCard
                    key={item.id}
                    item={item}
                    compact={true}
                    showPeriodBadgeInMeta={true}
                    isEditing={editingItemId === item.id}
                    onStartEdit={(it) => setEditingItemId(it.id)}
                    onCancelEdit={() => setEditingItemId(null)}
                    onSaveEdit={handleSaveItemEdit}
                    onRemove={handleRemoveItem}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-8 text-xs"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="h-8 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white gap-1.5"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>수정 내용 저장</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
