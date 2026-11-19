'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Wrench, ShieldCheck, AlertTriangle, AlertCircle, MapPin, CheckCircle2 } from 'lucide-react';
import type { SafetyFacilityItem, SafetyStatus } from '@/lib/safety/types';
import { updateFacilityStatus } from '@/lib/services/safetyService';
import { useToast } from '@/hooks/use-toast';

interface SafetyFacilitiesTabProps {
  facilities: SafetyFacilityItem[];
  onRefresh: () => void;
}

const CATEGORIES = ['전체', '소방/비상대피', '보행/통학로', '놀이/체육', 'CCTV/보안', '전기/가스'] as const;

export function SafetyFacilitiesTab({ facilities, onRefresh }: SafetyFacilitiesTabProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(item => {
      if (selectedCategory !== '전체' && item.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const text = `${item.name} ${item.location} ${item.managerName} ${item.notes || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [facilities, selectedCategory, selectedStatus, searchQuery]);

  const handleStatusChange = async (id: string, newStatus: SafetyStatus) => {
    setUpdatingId(id);
    try {
      await updateFacilityStatus(id, newStatus);
      toast({
        title: '시설물 점검 상태 갱신',
        description: '시설물 점검 결과가 저장되었습니다.',
      });
      onRefresh();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '시설물 상태 변경에 실패했습니다.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatusBadge = (status: SafetyStatus) => {
    switch (status) {
      case 'SAFE':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
            <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
            정상
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-amber-50 text-amber-700 border-amber-300">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
            점검/보수 요망
          </Badge>
        );
      case 'DANGER':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-rose-50 text-rose-700 border-rose-300">
            <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
            사용 금지/위험
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        {/* 카테고리 칩 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-bold shrink-0 transition-all ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 검색 및 필터 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="시설명, 위치, 담당자 검색"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-8 text-xs w-28 bg-white border-slate-200">
              <SelectValue placeholder="상태 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">상태 전체</SelectItem>
              <SelectItem value="SAFE" className="text-xs">정상</SelectItem>
              <SelectItem value="WARNING" className="text-xs">보수 요망</SelectItem>
              <SelectItem value="DANGER" className="text-xs">위험</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 시설물 테이블 */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-32 text-xs font-bold text-slate-700">분류</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">시설물 명칭</TableHead>
                  <TableHead className="w-32 text-xs font-bold text-slate-700">설치 위치</TableHead>
                  <TableHead className="w-24 text-center text-xs font-bold text-slate-700">점검 주기</TableHead>
                  <TableHead className="w-28 text-center text-xs font-bold text-slate-700">최근 점검일</TableHead>
                  <TableHead className="w-32 text-center text-xs font-bold text-slate-700">점검 상태</TableHead>
                  <TableHead className="w-48 text-xs font-bold text-slate-700">비고 및 조치사항</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFacilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400">
                      등록된 시설물이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFacilities.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.location}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-700">{item.checkCycle}</span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {item.lastCheckedDate}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Select
                          value={item.status}
                          onValueChange={(val) => handleStatusChange(item.id, val as SafetyStatus)}
                          disabled={updatingId === item.id}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-28 bg-white border-slate-200 font-bold mx-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SAFE" className="text-xs font-bold text-emerald-700">정상</SelectItem>
                            <SelectItem value="WARNING" className="text-xs font-bold text-amber-700">보수 요망</SelectItem>
                            <SelectItem value="DANGER" className="text-xs font-bold text-rose-700">위험(조치)</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs">
                        <p className="line-clamp-2 leading-relaxed">{item.notes || '-'}</p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
