'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/lib/types';
import {
  FixtureHandoverDocument,
  FixtureHandoverStatus,
  FixtureRoomType
} from '@/lib/types/fixtureHandover';
import {
  bulkApproveFixtureDocuments,
  deleteFixtureDocument,
  openFixturePrintWindow
} from '@/lib/services/fixtureHandoverService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  School,
  Building2,
  Printer,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Loader2,
  RotateCcw
} from 'lucide-react';

interface FixtureHandoverListProps {
  documents: FixtureHandoverDocument[];
  currentUserProfile: UserProfile;
  isVicePrincipalOrAdmin?: boolean;
  onViewDoc: (doc: FixtureHandoverDocument) => void;
  onEditDoc: (doc: FixtureHandoverDocument) => void;
  onRefresh: () => void;
}

export function FixtureHandoverList({
  documents,
  currentUserProfile,
  isVicePrincipalOrAdmin = false,
  onViewDoc,
  onEditDoc,
  onRefresh
}: FixtureHandoverListProps) {
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] = useState<'ALL' | FixtureRoomType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | FixtureHandoverStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const filteredDocs = documents.filter((d) => {
    if (typeFilter !== 'ALL' && d.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchRoom =
        d.type === 'CLASSROOM'
          ? `${d.grade}학년 ${d.classNum}반`.toLowerCase().includes(q)
          : (d.roomName || '').toLowerCase().includes(q);
      const matchAuthor = (d.authorName || '').toLowerCase().includes(q);
      const matchSuccessor = (d.successorName || '').toLowerCase().includes(q);
      if (!matchRoom && !matchAuthor && !matchSuccessor) return false;
    }
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredDocs.map((d) => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.length}건의 비품 인계서에 대해 교감 입회 확인을 일괄 완료하시겠습니까?`)) {
      return;
    }
    setIsBulkApproving(true);
    try {
      await bulkApproveFixtureDocuments(
        selectedIds,
        currentUserProfile.name || '신선영',
        currentUserProfile.email
      );
      toast({
        title: '일괄 확인 완료',
        description: `${selectedIds.length}건의 비품 인계서가 최종 승인되었습니다.`
      });
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '일괄 확인 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleDelete = async (docItem: FixtureHandoverDocument) => {
    const name = docItem.type === 'CLASSROOM' ? `${docItem.grade}학년 ${docItem.classNum}반` : docItem.roomName;
    if (!window.confirm(`"${name}" 비품 인계서를 삭제하시겠습니까?`)) return;
    try {
      await deleteFixtureDocument(docItem.id);
      toast({ title: '삭제 완료', description: '비품 인계서가 삭제되었습니다.' });
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: err?.message || '삭제 중 오류' });
    }
  };

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 바 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 구분 필터 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                typeFilter === 'ALL' ? 'bg-white text-[#2471B2] shadow-2xs' : 'text-slate-600'
              }`}
            >
              전체 구분
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('CLASSROOM')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                typeFilter === 'CLASSROOM' ? 'bg-white text-[#2471B2] shadow-2xs' : 'text-slate-600'
              }`}
            >
              <School className="w-3 h-3" />
              <span>학급</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SPECIAL_ROOM')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                typeFilter === 'SPECIAL_ROOM' ? 'bg-white text-[#2471B2] shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>특별실</span>
            </button>
          </div>

          {/* 상태 필터 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                statusFilter === 'ALL' ? 'bg-white text-[#2471B2] shadow-2xs' : 'text-slate-600'
              }`}
            >
              전체 상태
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SUBMITTED_WAITING_SUCCESSOR')}
              className={`px-2.5 py-1 rounded-md transition-all text-amber-700 ${
                statusFilter === 'SUBMITTED_WAITING_SUCCESSOR' ? 'bg-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              인수자 대기
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SUBMITTED_WAITING_ACADEMIC_HEAD')}
              className={`px-2.5 py-1 rounded-md transition-all text-[#2471B2] ${
                statusFilter === 'SUBMITTED_WAITING_ACADEMIC_HEAD' ? 'bg-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              부장 대기
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('READY_FOR_VP_APPROVAL')}
              className={`px-2.5 py-1 rounded-md transition-all text-[#C49832] ${
                statusFilter === 'READY_FOR_VP_APPROVAL' ? 'bg-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              교감 결재 대기
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-2.5 py-1 rounded-md transition-all text-emerald-700 ${
                statusFilter === 'APPROVED' ? 'bg-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              확인 완료
            </button>
          </div>
        </div>

        {/* 검색창 */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="학급, 특별실, 교사명 검색..."
              className="h-8 text-xs pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-8 text-xs font-bold gap-1 text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">새로고침</span>
          </Button>
        </div>
      </div>

      {/* 교감/관리자 일괄 확인 바 */}
      {isVicePrincipalOrAdmin && selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-indigo-900">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>선택한 {selectedIds.length}개 비품 인계서</span>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isBulkApproving}
            onClick={handleBulkApprove}
            className="h-7 text-xs font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isBulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>일괄 교감 입회 확인</span>
          </Button>
        </div>
      )}

      {/* 목록 테이블 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                {isVicePrincipalOrAdmin && (
                  <th className="py-2.5 px-3 w-10 text-center">
                    <Checkbox
                      checked={
                        filteredDocs.length > 0 && selectedIds.length === filteredDocs.length
                      }
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </th>
                )}
                <th className="py-2.5 px-3 w-20 text-center">구분</th>
                <th className="py-2.5 px-3 text-left">교실 / 명칭</th>
                <th className="py-2.5 px-3 text-center">인계 교사</th>
                <th className="py-2.5 px-3 text-center">인수 교사</th>
                <th className="py-2.5 px-3 text-center w-20">품목 수</th>
                <th className="py-2.5 px-3 text-center w-28">윈도우 비번</th>
                <th className="py-2.5 px-3 text-center w-28">결재 상태</th>
                <th className="py-2.5 px-3 text-center w-24">인계 일자</th>
                <th className="py-2.5 px-3 text-center w-36">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td
                    colSpan={isVicePrincipalOrAdmin ? 10 : 9}
                    className="py-12 text-center text-slate-400 font-medium"
                  >
                    등록된 비품 인수인계서가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((docItem) => {
                  const isClass = docItem.type === 'CLASSROOM';
                  const isAuthor =
                    currentUserProfile.email &&
                    docItem.authorEmail &&
                    currentUserProfile.email.toLowerCase() === docItem.authorEmail.toLowerCase();
                  const isSelected = selectedIds.includes(docItem.id);

                  return (
                    <tr
                      key={docItem.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {isVicePrincipalOrAdmin && (
                        <td className="py-2.5 px-3 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(docItem.id)}
                          />
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            isClass
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isClass ? '학급' : '특별실'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {isClass ? (
                          <span>
                            {docItem.grade}학년 {docItem.classNum}반
                          </span>
                        ) : (
                          <span>{docItem.roomName}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700">
                        {docItem.authorName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {docItem.successorName || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {docItem.items?.length || 0}개
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-emerald-800">
                        {docItem.windowsPassword || '없음'}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {docItem.status === 'APPROVED' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                            교감 확인 완료
                          </Badge>
                        ) : docItem.status === 'READY_FOR_VP_APPROVAL' ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                            교감 결재 대기
                          </Badge>
                        ) : docItem.status === 'SUBMITTED_WAITING_ACADEMIC_HEAD' || docItem.status === 'SUBMITTED' ? (
                          <Badge className="bg-blue-100 text-[#2471B2] border-blue-200 text-[10px] font-bold">
                            교무부장 확인 대기
                          </Badge>
                        ) : docItem.status === 'SUBMITTED_WAITING_SUCCESSOR' ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px] font-bold">
                            인수자 확인 대기
                          </Badge>
                        ) : docItem.status === 'REJECTED' ? (
                          <Badge className="bg-rose-100 text-[#B01E23] border-rose-200 text-[10px] font-bold">
                            반려됨
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px]">
                            임시 저장
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {docItem.handoverDate}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onViewDoc(docItem)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="열람"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openFixturePrintWindow(docItem)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                            title="A4 인쇄"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {(isAuthor || isVicePrincipalOrAdmin) && docItem.status !== 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => onEditDoc(docItem)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                              title="수정"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(isAuthor || isVicePrincipalOrAdmin) && docItem.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(docItem)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
