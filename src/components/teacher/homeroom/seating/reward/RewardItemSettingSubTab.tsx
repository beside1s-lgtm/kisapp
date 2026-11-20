'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  Gift,
  Coins,
} from 'lucide-react';
import type { RewardItem, RewardCategory } from '@/lib/types/praiseReward';
import {
  saveRewardItems,
  DEFAULT_REWARD_ITEMS,
} from '@/lib/services/praiseRewardService';
import { useToast } from '@/hooks/use-toast';

interface RewardItemSettingSubTabProps {
  classKey: string;
  rewardItems: RewardItem[];
  onRefresh: () => void;
}

const CATEGORY_LABELS: Record<RewardCategory, { label: string; class: string }> = {
  coupon: { label: '쿠폰/면제권', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  privilege: { label: '특권/우선권', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  item: { label: '실물 상품/뽑기', class: 'bg-purple-100 text-purple-800 border-purple-200' },
  other: { label: '기타/활동', class: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export const RewardItemSettingSubTab: React.FC<RewardItemSettingSubTabProps> = ({
  classKey,
  rewardItems,
  onRefresh,
}) => {
  const { toast } = useToast();

  // 추가/수정 모달 상태
  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  // 폼 입력 상태
  const [name, setName] = useState('');
  const [cost, setCost] = useState(10);
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [category, setCategory] = useState<RewardCategory>('coupon');

  const openNewModal = () => {
    setIsNew(true);
    setEditingItem({
      id: `reward_${Date.now()}`,
      name: '',
      cost: 10,
      desc: '',
      icon: '🎁',
      category: 'coupon',
      isEnabled: true,
    });
    setName('');
    setCost(10);
    setDesc('');
    setIcon('🎁');
    setCategory('coupon');
  };

  const openEditModal = (item: RewardItem) => {
    setIsNew(false);
    setEditingItem(item);
    setName(item.name);
    setCost(item.cost);
    setDesc(item.desc);
    setIcon(item.icon);
    setCategory(item.category);
  };

  const handleSaveItem = () => {
    if (!name.trim()) {
      toast({ title: '보상 이름을 입력해주세요.', variant: 'destructive' });
      return;
    }

    const newItem: RewardItem = {
      id: editingItem?.id || `reward_${Date.now()}`,
      name: name.trim(),
      cost: Math.max(1, cost),
      desc: desc.trim(),
      icon: icon || '🎁',
      category,
      isEnabled: editingItem ? editingItem.isEnabled : true,
    };

    let updated: RewardItem[];
    if (isNew) {
      updated = [...rewardItems, newItem];
    } else {
      updated = rewardItems.map((r) => (r.id === newItem.id ? newItem : r));
    }

    saveRewardItems(classKey, updated);
    setEditingItem(null);
    onRefresh();
    toast({
      title: isNew ? '보상 항목 추가 완료' : '보상 항목 수정 완료',
      description: `[${newItem.name}] (${newItem.cost}P) 보상이 저장되었습니다.`,
    });
  };

  const handleToggleEnable = (id: string) => {
    const updated = rewardItems.map((r) =>
      r.id === id ? { ...r, isEnabled: !r.isEnabled } : r
    );
    saveRewardItems(classKey, updated);
    onRefresh();
  };

  const handleDeleteItem = (id: string, itemName: string) => {
    if (confirm(`[${itemName}] 보상 항목을 삭제하시겠습니까?`)) {
      const updated = rewardItems.filter((r) => r.id !== id);
      saveRewardItems(classKey, updated);
      onRefresh();
      toast({ title: '보상 항목 삭제 완료' });
    }
  };

  const handleResetToDefault = () => {
    if (confirm('보상 목록을 기본 추천 목록(7개)으로 초기화하시겠습니까?')) {
      saveRewardItems(classKey, DEFAULT_REWARD_ITEMS);
      onRefresh();
      toast({
        title: '기본 보상 목록 복원 완료',
        description: '자리 선택권, 숙제 면제권 등 기본 보상으로 복원되었습니다.',
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* ─── 툴바 ─── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 font-bold">
          학생들이 모은 포인트로 교환할 수 있는 보상 목록을 설정합니다.
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            className="text-xs text-slate-500 hover:text-slate-800 h-8 gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>기본값 복원</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openNewModal}
            className="h-8 px-2.5 text-xs font-black bg-[#2471B2] hover:bg-[#1E629D] text-white rounded-xl gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 보상 추가</span>
          </Button>
        </div>
      </div>

      {/* ─── 보상 아이템 카드 그리드 ─── */}
      <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
        {rewardItems.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 border rounded-2xl bg-white">
            등록된 보상이 없습니다. [새 보상 추가] 또는 [기본값 복원]을 눌러보세요.
          </div>
        ) : (
          rewardItems.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                item.isEnabled
                  ? 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
                  : 'bg-slate-50 border-slate-200 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0 select-none">{item.icon}</span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900 text-xs truncate">
                      {item.name}
                    </span>
                    <Badge className={`text-[9px] px-1.5 py-0 ${CATEGORY_LABELS[item.category].class}`}>
                      {CATEGORY_LABELS[item.category].label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{item.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge className="font-mono text-xs font-black bg-amber-500 text-white px-2 py-0.5">
                  {item.cost}P
                </Badge>

                {/* 사용 여부 토글 */}
                <button
                  type="button"
                  onClick={() => handleToggleEnable(item.id)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                    item.isEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-slate-200 text-slate-600 border-slate-300'
                  }`}
                >
                  {item.isEnabled ? '활성' : '숨김'}
                </button>

                {/* 수정 / 삭제 */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(item)}
                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 rounded-lg"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteItem(item.id, item.name)}
                  className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── 추가 / 수정 모달 ─── */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md p-5 rounded-3xl">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <Gift className="w-5 h-5 text-amber-600" />
              <span>{isNew ? '새 보상 등록' : '보상 수정'}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1 col-span-1">
                <label className="font-bold text-slate-700 block">아이콘</label>
                <Input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="h-9 text-center text-lg font-black"
                  placeholder="🎁"
                />
              </div>
              <div className="space-y-1 col-span-3">
                <label className="font-bold text-slate-700 block">보상 명칭</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs font-black"
                  placeholder="예: 자리 1일 선택권"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">필요 포인트 (P)</label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={cost}
                  onChange={(e) => setCost(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs font-mono font-black"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">카테고리</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RewardCategory)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs"
                >
                  <option value="coupon">쿠폰/면제권</option>
                  <option value="privilege">특권/우선권</option>
                  <option value="item">실물 상품/뽑기</option>
                  <option value="other">기타/활동</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">보상 설명</label>
              <Input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="h-9 text-xs"
                placeholder="예: 원하는 자리에 하루 동안 앉을 수 있어요"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingItem(null)}
              className="rounded-xl text-xs h-9"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveItem}
              className="rounded-xl text-xs h-9 bg-[#2471B2] hover:bg-[#1E629D] text-white font-black"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
