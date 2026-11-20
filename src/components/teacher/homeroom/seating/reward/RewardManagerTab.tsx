'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Coins, Gift, History, WalletCards } from 'lucide-react';
import type { DeskSlot } from '@/lib/types/seating';
import type { StudentRewardAccount, RewardItem, PointTransaction } from '@/lib/types/praiseReward';
import {
  getSyncedStudentAccounts,
  getSavedRewardItems,
  getSavedTransactions,
} from '@/lib/services/praiseRewardService';
import { AccountListSubTab } from './AccountListSubTab';
import { RewardItemSettingSubTab } from './RewardItemSettingSubTab';
import { TransactionHistorySubTab } from './TransactionHistorySubTab';

interface RewardManagerTabProps {
  classKey: string;
  slots?: DeskSlot[];
}

export const RewardManagerTab: React.FC<RewardManagerTabProps> = ({
  classKey,
  slots = [],
}) => {
  const [subTab, setSubTab] = useState<'accounts' | 'items' | 'history'>('accounts');
  const [accounts, setAccounts] = useState<StudentRewardAccount[]>([]);
  const [rewardItems, setRewardItems] = useState<RewardItem[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);

  const loadData = () => {
    const accs = getSyncedStudentAccounts(classKey, slots);
    const items = getSavedRewardItems(classKey);
    const txs = getSavedTransactions(classKey);
    setAccounts(accs);
    setRewardItems(items);
    setTransactions(txs);
  };

  useEffect(() => {
    loadData();

    const handleAccountsUpdated = () => loadData();
    const handleRewardsUpdated = () => loadData();
    const handleTxUpdated = () => loadData();

    window.addEventListener('class-reward-accounts-updated', handleAccountsUpdated);
    window.addEventListener('class-rewards-updated', handleRewardsUpdated);
    window.addEventListener('class-reward-tx-updated', handleTxUpdated);

    return () => {
      window.removeEventListener('class-reward-accounts-updated', handleAccountsUpdated);
      window.removeEventListener('class-rewards-updated', handleRewardsUpdated);
      window.removeEventListener('class-reward-tx-updated', handleTxUpdated);
    };
  }, [classKey, slots]);

  return (
    <div className="space-y-3">
      {/* ─── 상단 보상 관리 안내 배너 ─── */}
      <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <p className="font-black text-slate-900">
              학급 포인트 통장 & 보상 관리
            </p>
            <p className="text-[11px] text-slate-500">
              칭찬 시 누적되는 등급/온도계 점수와 별도로, 보상 교환 시 소비되는 가상 학급 화폐를 관리합니다.
            </p>
          </div>
        </div>
      </div>

      {/* ─── 서브 탭 메뉴 ─── */}
      <Tabs
        value={subTab}
        onValueChange={(val) => setSubTab(val as 'accounts' | 'items' | 'history')}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 w-full p-1 bg-slate-100 rounded-2xl h-10 border border-slate-200">
          <TabsTrigger
            value="accounts"
            className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-xs gap-1.5 transition-all"
          >
            <WalletCards className="w-3.5 h-3.5" />
            <span>포인트 통장 현황</span>
          </TabsTrigger>
          <TabsTrigger
            value="items"
            className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-blue-800 data-[state=active]:shadow-xs gap-1.5 transition-all"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>보상 아이템 목록</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-xs gap-1.5 transition-all"
          >
            <History className="w-3.5 h-3.5" />
            <span>거래 내역 ({transactions.length})</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-2.5">
          <TabsContent value="accounts" className="m-0 focus-visible:outline-none">
            <AccountListSubTab
              classKey={classKey}
              accounts={accounts}
              rewardItems={rewardItems}
              onRefresh={loadData}
            />
          </TabsContent>

          <TabsContent value="items" className="m-0 focus-visible:outline-none">
            <RewardItemSettingSubTab
              classKey={classKey}
              rewardItems={rewardItems}
              onRefresh={loadData}
            />
          </TabsContent>

          <TabsContent value="history" className="m-0 focus-visible:outline-none">
            <TransactionHistorySubTab
              transactions={transactions}
              onRefresh={loadData}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
