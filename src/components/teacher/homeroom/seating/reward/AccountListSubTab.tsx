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
  Coins,
  Search,
  Gift,
  Plus,
  Minus,
  Check,
  Sparkles,
  ArrowDownUp,
  AlertCircle,
} from 'lucide-react';
import type { StudentRewardAccount, RewardItem } from '@/lib/types/praiseReward';
import { exchangeRewardItem, adjustStudentPoints } from '@/lib/services/praiseRewardService';
import { useToast } from '@/hooks/use-toast';

interface AccountListSubTabProps {
  classKey: string;
  accounts: StudentRewardAccount[];
  rewardItems: RewardItem[];
  onRefresh: () => void;
}

export const AccountListSubTab: React.FC<AccountListSubTabProps> = ({
  classKey,
  accounts,
  rewardItems,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // 교환 모달 상태
  const [exchangeStudent, setExchangeStudent] = useState<StudentRewardAccount | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);

  // 수동 조정 모달 상태
  const [adjustStudent, setAdjustStudent] = useState<StudentRewardAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'ADD' | 'SUBTRACT'>('ADD');

  // 통계 계산
  const totalCirculating = accounts.reduce((acc, cur) => acc + cur.balance, 0);
  const totalSpentAll = accounts.reduce((acc, cur) => acc + cur.totalSpent, 0);

  const filteredAccounts = accounts.filter((a) =>
    a.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.studentNum && String(a.studentNum).includes(searchTerm))
  );

  // 보상 교환 실행
  const handleConfirmExchange = () => {
    if (!exchangeStudent || !selectedReward) return;

    const res = exchangeRewardItem(classKey, exchangeStudent.studentId, selectedReward);
    if (res.success) {
      toast({
        title: '보상 교환 완료',
        description: res.message,
      });
      setExchangeStudent(null);
      setSelectedReward(null);
      onRefresh();
    } else {
      toast({
        title: '보상 교환 실패',
        description: res.message,
        variant: 'destructive',
      });
    }
  };

  // 수동 조정 실행
  const handleConfirmAdjust = () => {
    if (!adjustStudent) return;
    const delta = adjustType === 'ADD' ? adjustAmount : -adjustAmount;
    const res = adjustStudentPoints(
      classKey,
      adjustStudent.studentId,
      delta,
      adjustReason || (adjustType === 'ADD' ? '교사 수동 포인트 지급' : '교사 수동 포인트 차감')
    );

    if (res.success) {
      toast({
        title: '포인트 조정 완료',
        description: `${adjustStudent.studentName} 학생의 포인트가 ${delta > 0 ? `+${delta}P 지급` : `${delta}P 차감`}되었습니다.`,
      });
      setAdjustStudent(null);
      setAdjustAmount(1);
      setAdjustReason('');
      onRefresh();
    }
  };

  const activeRewards = rewardItems.filter((r) => r.isEnabled);

  return (
    <div className="space-y-3.5">
      {/* ─── 상단 요약 통계 카드 ─── */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100/60 border border-amber-200 rounded-2xl">
          <p className="text-[10px] font-bold text-amber-700">시중 유통 포인트 (잔액 합계)</p>
          <p className="text-base sm:text-lg font-black text-amber-950 font-mono mt-0.5">
            {totalCirculating.toLocaleString()} <span className="text-xs">P</span>
          </p>
        </div>
        <div className="p-2.5 bg-gradient-to-br from-rose-50 to-rose-100/60 border border-rose-200 rounded-2xl">
          <p className="text-[10px] font-bold text-rose-700">총 보상 교환 소비액</p>
          <p className="text-base sm:text-lg font-black text-rose-950 font-mono mt-0.5">
            {totalSpentAll.toLocaleString()} <span className="text-xs">P</span>
          </p>
        </div>
        <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200 rounded-2xl">
          <p className="text-[10px] font-bold text-blue-700">개설된 학생 통장</p>
          <p className="text-base sm:text-lg font-black text-blue-950 font-mono mt-0.5">
            {accounts.length} <span className="text-xs">명</span>
          </p>
        </div>
      </div>

      {/* ─── 검색 필터 바 ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="학생 이름 또는 번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs pl-8 bg-slate-50 border-slate-200 rounded-xl"
          />
        </div>
        <p className="text-[11px] text-slate-500 font-bold shrink-0">
          총 {filteredAccounts.length}명
        </p>
      </div>

      {/* ─── 학생 통장 목록 (테이블 / 카드) ─── */}
      <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 border rounded-2xl bg-white shadow-2xs">
        {filteredAccounts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {accounts.length === 0
              ? '좌석 배치도에 등록된 학생이 없습니다. 자리 배치 후 자동으로 통장이 개설됩니다.'
              : '일치하는 학생이 없습니다.'}
          </div>
        ) : (
          filteredAccounts.map((acc) => (
            <div
              key={acc.studentId}
              className="p-2.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 text-center font-mono font-bold text-slate-400 shrink-0">
                  {acc.studentNum || '-'}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900 truncate">
                      {acc.studentName}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 ${
                        acc.gender === 'Female' || acc.gender === '여'
                          ? 'text-rose-600 border-rose-200'
                          : 'text-blue-600 border-blue-200'
                      }`}
                    >
                      {acc.gender === 'Female' || acc.gender === '여' ? '여' : '남'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>누적 {acc.totalEarned}P</span>
                    <span>•</span>
                    <span>사용 {acc.totalSpent}P</span>
                  </div>
                </div>
              </div>

              {/* 잔액 및 액션 버튼 */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 font-mono font-black text-amber-600 text-sm bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    {acc.balance}P
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExchangeStudent(acc);
                      setSelectedReward(null);
                    }}
                    className="h-7 px-2 text-[11px] font-bold bg-amber-50/60 border-amber-300 text-amber-900 hover:bg-amber-100 gap-1 rounded-xl"
                  >
                    <Gift className="w-3 h-3 text-amber-600" />
                    <span>보상 교환</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAdjustStudent(acc);
                      setAdjustAmount(1);
                      setAdjustReason('');
                      setAdjustType('ADD');
                    }}
                    className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                    title="포인트 수동 지급/차감"
                  >
                    <ArrowDownUp className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── 보상 교환 다이얼로그 ─── */}
      <Dialog open={!!exchangeStudent} onOpenChange={(open) => !open && setExchangeStudent(null)}>
        <DialogContent className="sm:max-w-md p-5 rounded-3xl">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <Gift className="w-5 h-5 text-amber-600" />
              <span>보상 교환 처리</span>
            </DialogTitle>
          </DialogHeader>

          {exchangeStudent && (
            <div className="space-y-3 py-2 text-xs">
              {/* 학생 정보 및 잔액 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-400 font-bold mr-1">
                    {exchangeStudent.studentNum ? `${exchangeStudent.studentNum}번` : ''}
                  </span>
                  <span className="font-black text-slate-900 text-sm">
                    {exchangeStudent.studentName}
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono font-black text-amber-600 text-sm">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>보유 잔액: {exchangeStudent.balance}P</span>
                </div>
              </div>

              {/* 교환할 보상 선택 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">교환할 보상 선택</label>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {activeRewards.length === 0 ? (
                    <p className="text-center py-4 text-slate-400">등록된 보상이 없습니다.</p>
                  ) : (
                    activeRewards.map((reward) => {
                      const canAfford = exchangeStudent.balance >= reward.cost;
                      const isSelected = selectedReward?.id === reward.id;

                      return (
                        <div
                          key={reward.id}
                          onClick={() => canAfford && setSelectedReward(reward)}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            !canAfford
                              ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                              : isSelected
                              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-300'
                              : 'bg-white border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{reward.icon}</span>
                            <div>
                              <p className="font-black text-slate-900">{reward.name}</p>
                              <p className="text-[10px] text-slate-500">{reward.desc}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge
                              className={`font-mono text-xs font-black ${
                                canAfford
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-300 text-slate-600'
                              }`}
                            >
                              {reward.cost}P
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedReward && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-950 font-bold">
                  <span>교환 후 남는 포인트:</span>
                  <span className="font-mono text-sm font-black text-amber-600">
                    {exchangeStudent.balance - selectedReward.cost}P
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExchangeStudent(null)}
              className="rounded-xl text-xs h-9"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedReward}
              onClick={handleConfirmExchange}
              className="rounded-xl text-xs h-9 bg-[#2471B2] hover:bg-[#1E629D] text-white font-black"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              보상 교환 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 포인트 수동 지급/차감 다이얼로그 ─── */}
      <Dialog open={!!adjustStudent} onOpenChange={(open) => !open && setAdjustStudent(null)}>
        <DialogContent className="sm:max-w-sm p-5 rounded-3xl">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <ArrowDownUp className="w-5 h-5 text-blue-600" />
              <span>포인트 수동 입출금</span>
            </DialogTitle>
          </DialogHeader>

          {adjustStudent && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-mono text-slate-400 font-bold mr-1">
                    {adjustStudent.studentNum ? `${adjustStudent.studentNum}번` : ''}
                  </span>
                  <span className="font-black text-slate-900 text-sm">
                    {adjustStudent.studentName}
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-600">
                  현재: {adjustStudent.balance}P
                </span>
              </div>

              {/* 입금 vs 출금 모드 선택 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={adjustType === 'ADD' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdjustType('ADD')}
                  className={`h-9 font-black rounded-xl gap-1 text-xs ${
                    adjustType === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  포인트 지급 (+)
                </Button>
                <Button
                  type="button"
                  variant={adjustType === 'SUBTRACT' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdjustType('SUBTRACT')}
                  className={`h-9 font-black rounded-xl gap-1 text-xs ${
                    adjustType === 'SUBTRACT' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  포인트 차감 (-)
                </Button>
              </div>

              {/* 포인트 수치 입력 */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">조정 포인트 수량</label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8 text-xs font-mono font-black"
                />
              </div>

              {/* 사유 입력 */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">조정 사유 (선택)</label>
                <Input
                  type="text"
                  placeholder="예: 학급 청소 특별 보너스, 분실물 반환 등"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdjustStudent(null)}
              className="rounded-xl text-xs h-9"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmAdjust}
              className="rounded-xl text-xs h-9 bg-[#2471B2] hover:bg-[#1E629D] text-white font-black"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
