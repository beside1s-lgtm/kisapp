'use client';

import React from 'react';
import { FixtureItem } from '@/lib/types/fixtureHandover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowUp, ArrowDown, Key } from 'lucide-react';

interface FixtureItemTableProps {
  items: FixtureItem[];
  onChange: (items: FixtureItem[]) => void;
  windowsPassword: string;
  onWindowsPasswordChange: (pw: string) => void;
  readOnly?: boolean;
}

export function FixtureItemTable({
  items,
  onChange,
  windowsPassword,
  onWindowsPasswordChange,
  readOnly = false
}: FixtureItemTableProps) {
  const handleItemChange = (idx: number, field: keyof FixtureItem, value: any) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      [field]: value
    };
    onChange(updated);
  };

  const handleAddItem = () => {
    const nextNo = items.length + 1;
    const newItem: FixtureItem = {
      id: `item_${nextNo}_${Date.now()}`,
      itemNo: nextNo,
      name: '',
      quantity: 1,
      note: ''
    };
    onChange([...items, newItem]);
  };

  const handleDeleteItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx).map((it, i) => ({
      ...it,
      itemNo: i + 1
    }));
    onChange(updated);
  };

  const handleMove = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === items.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...items];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated.map((it, i) => ({ ...it, itemNo: i + 1 })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-800">비품 품목 목록 ({items.length}개)</span>
          <span className="text-[11px] text-slate-500 ml-2">※ 수정한 품목 및 수량은 향후 해당 학급/특별실의 기본 서식에 자동 보존됩니다.</span>
        </div>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddItem}
            className="h-7 text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>품목 추가</span>
          </Button>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-14 text-center">번호</th>
                <th className="py-2.5 px-3 text-left">비품명</th>
                <th className="py-2.5 px-3 w-28 text-center">수량</th>
                <th className="py-2.5 px-3 text-left min-w-[160px]">비고 (이상 상태, 규격 등)</th>
                {!readOnly && <th className="py-2.5 px-2 w-24 text-center">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3 text-center font-bold text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="font-medium text-slate-900">{item.name || '-'}</span>
                    ) : (
                      <Input
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        placeholder="비품명 입력 (예: TV, 실물화상기)"
                        className="h-8 text-xs font-medium"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {readOnly ? (
                      <span className="font-semibold text-slate-800">{item.quantity}</span>
                    ) : (
                      <Input
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        placeholder="1"
                        className="h-8 text-xs text-center font-semibold"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {readOnly ? (
                      <span className="text-slate-600">{item.note || '-'}</span>
                    ) : (
                      <Input
                        value={item.note || ''}
                        onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                        placeholder="이상이 있는 경우 기재"
                        className="h-8 text-xs text-slate-600"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                          title="위로 이동"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(idx, 'down')}
                          disabled={idx === items.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
                          title="아래로 이동"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 윈도우 로그인 비번 가로형 카드 박스 */}
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs">
          <div className="flex items-center gap-2 font-bold text-emerald-900 shrink-0 whitespace-nowrap">
            <Key className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm">★ 윈도우 로그인 비번:</span>
          </div>
          <div className="flex-1 w-full sm:max-w-md">
            {readOnly ? (
              <span className="font-bold text-emerald-800 text-xs sm:text-sm px-3 py-1 bg-white/90 rounded-md border border-emerald-200 inline-block">
                {windowsPassword || '없음'}
              </span>
            ) : (
              <Input
                value={windowsPassword}
                onChange={(e) => onWindowsPasswordChange(e.target.value)}
                placeholder="없음 또는 비밀번호 입력"
                className="h-8 text-xs bg-white border-emerald-300 text-emerald-900 font-bold w-full"
              />
            )}
          </div>
          <span className="text-[11px] text-emerald-700/90 whitespace-nowrap hidden md:inline">
            ※ PC 부팅 후 윈도우 로그인 암호가 없을 경우 '없음'으로 기재
          </span>
        </div>
      </div>
    </div>
  );
}
