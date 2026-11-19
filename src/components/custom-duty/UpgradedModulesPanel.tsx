'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  CheckSquare,
  Download,
  FileText,
  Plus,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import type { ApprovalDoc } from '@/lib/types';
import type {
  CustomDutyChecklistItem,
  CustomDutyTableRow,
  CustomDutyWorkspace,
} from '@/lib/types/customDuty';
import {
  saveWorkspaceChecklist,
  saveWorkspaceTableRows,
} from '@/lib/services/customDutyService';

interface UpgradedModulesPanelProps {
  workspace: CustomDutyWorkspace;
  userEmail: string;
}

export function UpgradedModulesPanel({ workspace, userEmail }: UpgradedModulesPanelProps) {
  const { toast } = useToast();
  const enabled = workspace.enabledModules || [];

  // 1. 맞춤형 표 상태
  const columns =
    workspace.customTableColumns && workspace.customTableColumns.length > 0
      ? workspace.customTableColumns
      : ['항목', '담당자/대상', '일정', '상태', '비고'];
  const [rows, setRows] = useState<CustomDutyTableRow[]>(workspace.customTableRows || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [newRowDraft, setNewRowDraft] = useState<Record<string, string>>({});
  const [savingTable, setSavingTable] = useState(false);

  // 2. 체크리스트 상태
  const [checklist, setChecklist] = useState<CustomDutyChecklistItem[]>(
    workspace.customChecklist || []
  );
  const [newCheckTitle, setNewCheckTitle] = useState('');
  const [newCheckTiming, setNewCheckTiming] = useState('');

  // 3. 결재 문서함 자동 연동
  const [relatedApprovals, setRelatedApprovals] = useState<ApprovalDoc[]>([]);

  useEffect(() => {
    setRows(workspace.customTableRows || []);
  }, [workspace.customTableRows]);

  useEffect(() => {
    setChecklist(workspace.customChecklist || []);
  }, [workspace.customChecklist]);

  useEffect(() => {
    if (!enabled.includes('approval_history')) return;
    const q = query(collection(db, 'approvals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const keyword = workspace.dutyName.replace(/\s+/g, '').toLowerCase();
        const docs = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as ApprovalDoc))
          .filter((docItem) => {
            const hay = [
              docItem.title,
              docItem.handoverCategory,
              docItem.driveTargetTaskName,
            ]
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, '')
              .toLowerCase();
            return hay.includes(keyword);
          })
          .slice(0, 15);
        setRelatedApprovals(docs);
      },
      (err) => {
        console.warn('[UpgradedModulesPanel] approvals listener error:', err);
      }
    );
    return () => unsub();
  }, [enabled, workspace.dutyName]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const qLower = searchQuery.toLowerCase();
    return rows.filter((r) =>
      columns.some((col) => (r[col] || '').toLowerCase().includes(qLower))
    );
  }, [rows, columns, searchQuery]);

  if (enabled.length === 0) return null;

  const handleAddRow = async () => {
    const hasAnyValue = columns.some((c) => (newRowDraft[c] || '').trim() !== '');
    if (!hasAnyValue) {
      toast({ variant: 'destructive', title: '입력 필요', description: '최소 한 개 이상의 값을 입력하세요.' });
      return;
    }
    const created: CustomDutyTableRow = {
      id: `row_${Date.now()}`,
    };
    columns.forEach((col) => {
      created[col] = (newRowDraft[col] || '').trim();
    });
    const nextRows = [created, ...rows];
    setRows(nextRows);
    setNewRowDraft({});
    setSavingTable(true);
    try {
      await saveWorkspaceTableRows(workspace.dutyName, nextRows, userEmail);
      toast({ title: '항목 추가됨', description: '데이터가 안전하게 저장되었습니다.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '저장 오류', description: err?.message });
    } finally {
      setSavingTable(false);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    const nextRows = rows.filter((r) => r.id !== rowId);
    setRows(nextRows);
    try {
      await saveWorkspaceTableRows(workspace.dutyName, nextRows, userEmail);
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 오류', description: err?.message });
    }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const sheetRows = filteredRows.map((row) => {
        const obj: Record<string, string> = {};
        columns.forEach((c) => {
          obj[c] = row[c] || '';
        });
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(sheetRows, { header: columns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, workspace.dutyName.slice(0, 28));
      XLSX.writeFile(wb, `${workspace.dutyName}_관리대장.xlsx`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: '엑셀 내보내기 실패', description: err?.message });
    }
  };

  const handleToggleCheck = async (itemId: string) => {
    const next = checklist.map((it) =>
      it.id === itemId ? { ...it, done: !it.done } : it
    );
    setChecklist(next);
    await saveWorkspaceChecklist(workspace.dutyName, next, userEmail);
  };

  const handleAddChecklist = async () => {
    if (!newCheckTitle.trim()) return;
    const next: CustomDutyChecklistItem[] = [
      ...checklist,
      {
        id: `chk_${Date.now()}`,
        title: newCheckTitle.trim(),
        timing: newCheckTiming.trim() || '상시',
        done: false,
      },
    ];
    setChecklist(next);
    setNewCheckTitle('');
    setNewCheckTiming('');
    await saveWorkspaceChecklist(workspace.dutyName, next, userEmail);
  };

  const handleRemoveChecklist = async (itemId: string) => {
    const next = checklist.filter((it) => it.id !== itemId);
    setChecklist(next);
    await saveWorkspaceChecklist(workspace.dutyName, next, userEmail);
  };

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-4">
      {/* 1. 맞춤형 데이터 관리 표 */}
      {enabled.includes('custom_table') && (
        <Card className="border-indigo-200 shadow-2xs">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-slate-900">
              <Table2 className="w-4 h-4 text-indigo-600" />
              <span>{workspace.dutyName} 관리 대장</span>
              <Badge variant="outline" className="text-[10px] font-bold">
                총 {rows.length}건
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="표 내 검색..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={filteredRows.length === 0}
                className="h-7 text-xs font-bold gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>엑셀 저장</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 빠른 행 추가 바 */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
              <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-2 flex-wrap">
                {columns.map((col) => (
                  <div key={col} className="flex-1 min-w-[110px] space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 block truncate">{col}</span>
                    <Input
                      value={newRowDraft[col] || ''}
                      onChange={(e) =>
                        setNewRowDraft((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      placeholder={col}
                      className="h-7 text-xs bg-white"
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                disabled={savingTable}
                onClick={handleAddRow}
                className="h-7 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>행 추가</span>
              </Button>
            </div>

            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="px-3 py-2 text-center w-12">연번</th>
                    {columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center w-14">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-slate-400">
                        등록된 항목이 없습니다. 위 입력란에서 데이터를 추가하세요.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-center text-slate-500 font-medium">
                          {idx + 1}
                        </td>
                        {columns.map((col) => (
                          <td key={col} className="px-3 py-2 text-slate-800 whitespace-nowrap">
                            {row[col] || '-'}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-rose-600"
                            onClick={() => handleDeleteRow(row.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. 연간 추진 체크리스트 & 결재 이력 2단 그리드 */}
      {(enabled.includes('checklist') || enabled.includes('approval_history')) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {enabled.includes('checklist') && (
            <Card className="border-emerald-200 shadow-2xs">
              <CardHeader className="pb-2.5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-slate-900">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  <span>추진 체크리스트</span>
                </CardTitle>
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                  {completedCount} / {checklist.length} 완료
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newCheckTiming}
                    onChange={(e) => setNewCheckTiming(e.target.value)}
                    placeholder="시기 (예: 9월)"
                    className="h-7 text-xs w-24 shrink-0"
                  />
                  <Input
                    value={newCheckTitle}
                    onChange={(e) => setNewCheckTitle(e.target.value)}
                    placeholder="새 추진 과업 입력..."
                    className="h-7 text-xs flex-1 min-w-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklist();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddChecklist}
                    className="h-7 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    추가
                  </Button>
                </div>

                {checklist.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-5 border border-dashed rounded-xl">
                    등록된 체크리스트가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto overscroll-contain pr-1">
                    {checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                          <Checkbox
                            checked={Boolean(item.done)}
                            onCheckedChange={() => handleToggleCheck(item.id)}
                          />
                          {item.timing && (
                            <Badge variant="outline" className="text-[10px] shrink-0 bg-slate-50">
                              {item.timing}
                            </Badge>
                          )}
                          <span
                            className={
                              item.done
                                ? 'line-through text-slate-400 truncate'
                                : 'font-medium text-slate-800 truncate'
                            }
                          >
                            {item.title}
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-rose-600 shrink-0"
                          onClick={() => handleRemoveChecklist(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {enabled.includes('approval_history') && (
            <Card className="border-sky-200 shadow-2xs">
              <CardHeader className="pb-2.5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-slate-900">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>연동 결재문서 목록</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {relatedApprovals.length}건
                </Badge>
              </CardHeader>
              <CardContent>
                {relatedApprovals.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl">
                    &apos;{workspace.dutyName}&apos; 키워드나 해당 편철 폴더로 상신된 결재 문서가 아직 없습니다.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto overscroll-contain">
                    {relatedApprovals.map((docItem) => (
                      <Link
                        key={docItem.id}
                        href={`/documents/${docItem.id}`}
                        className="py-2 px-1.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-lg text-xs transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-bold text-slate-800 truncate">{docItem.title}</div>
                          <div className="text-[10px] text-slate-400">
                            {docItem.requesterName} · {docItem.createdAt ? new Date(docItem.createdAt).toLocaleDateString('ko-KR') : ''}
                          </div>
                        </div>
                        <Badge
                          className={
                            docItem.status === 'approved'
                              ? 'bg-emerald-600 text-white text-[10px] shrink-0'
                              : docItem.status === 'rejected'
                                ? 'bg-rose-600 text-white text-[10px] shrink-0'
                                : 'bg-amber-500 text-white text-[10px] shrink-0'
                          }
                        >
                          {docItem.status === 'approved'
                            ? '결재완료'
                            : docItem.status === 'rejected'
                              ? '반려'
                              : '진행중'}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
