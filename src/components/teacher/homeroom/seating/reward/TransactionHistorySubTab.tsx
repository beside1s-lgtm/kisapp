'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  History,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
} from 'lucide-react';
import type { PointTransaction, TransactionType } from '@/lib/types/praiseReward';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TransactionHistorySubTabProps {
  transactions: PointTransaction[];
  onRefresh: () => void;
}

export const TransactionHistorySubTab: React.FC<TransactionHistorySubTabProps> = ({
  transactions,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (searchTerm && !tx.studentName.toLowerCase().includes(searchTerm.toLowerCase()) && !tx.reason.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* ─── 필터 바 ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={filterType === 'ALL' ? 'default' : 'outline'}
            onClick={() => setFilterType('ALL')}
            className="h-7 text-[11px] px-2.5 rounded-xl font-bold"
          >
            전체 ({transactions.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === 'EARN' ? 'default' : 'outline'}
            onClick={() => setFilterType('EARN')}
            className={`h-7 text-[11px] px-2.5 rounded-xl font-bold ${
              filterType === 'EARN' ? 'bg-emerald-600 text-white' : ''
            }`}
          >
            적립 (+)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === 'SPEND' ? 'default' : 'outline'}
            onClick={() => setFilterType('SPEND')}
            className={`h-7 text-[11px] px-2.5 rounded-xl font-bold ${
              filterType === 'SPEND' ? 'bg-rose-600 text-white' : ''
            }`}
          >
            보상 교환 (-)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === 'ADJUST' ? 'default' : 'outline'}
            onClick={() => setFilterType('ADJUST')}
            className={`h-7 text-[11px] px-2.5 rounded-xl font-bold ${
              filterType === 'ADJUST' ? 'bg-blue-600 text-white' : ''
            }`}
          >
            수동 조정
          </Button>
        </div>

        <div className="relative max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="학생명 또는 사유 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 text-xs pl-8 bg-slate-50 border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* ─── 거래 내역 목록 ─── */}
      <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 border rounded-2xl bg-white shadow-2xs">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            기록된 포인트 거래 내역이 없습니다.
          </div>
        ) : (
          filtered.map((tx) => {
            const isPositive = tx.amount > 0;
            const formattedDate = tx.timestamp
              ? format(new Date(tx.timestamp), 'M/d HH:mm', { locale: ko })
              : '-';

            return (
              <div
                key={tx.id}
                className="p-2.5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      isPositive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900 truncate">
                        {tx.studentName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formattedDate}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{tx.reason}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-black text-sm ${
                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isPositive ? `+${tx.amount}` : tx.amount}P
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    잔액 {tx.balanceAfter}P
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
