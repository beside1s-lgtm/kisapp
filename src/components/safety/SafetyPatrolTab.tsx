'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, ShieldCheck, AlertTriangle, AlertCircle, Calendar, Clock, MapPin, User } from 'lucide-react';
import type { SafetyPatrolLog, SafetyZone, SafetyStatus } from '@/lib/safety/types';

interface SafetyPatrolTabProps {
  logs: SafetyPatrolLog[];
  onOpenNewPatrolModal: () => void;
}

const ZONES: SafetyZone[] = [
  '전체',
  '정문/통학로',
  '운동장/체육시설',
  '교사동 복도/계단',
  '특별실/실습실',
  '급식실/식당',
  '스쿨버스 승하차장',
];

export function SafetyPatrolTab({ logs, onOpenNewPatrolModal }: SafetyPatrolTabProps) {
  const [selectedZone, setSelectedZone] = useState<SafetyZone>('전체');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (selectedZone !== '전체' && log.zone !== selectedZone) return false;
      if (selectedStatus !== 'all' && log.overallStatus !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const text = `${log.patrolLeader} ${log.specialNotes || ''} ${log.actionTaken || ''} ${log.zone}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [logs, selectedZone, selectedStatus, searchQuery]);

  const renderStatusBadge = (status: SafetyStatus) => {
    switch (status) {
      case 'SAFE':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
            <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
            양호
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
            주의
          </Badge>
        );
      case 'DANGER':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-rose-50 text-rose-700 border-rose-300">
            <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
            위험(조치필요)
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* 툴바: 구역 탭 + 검색 + 상태 필터 */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        {/* 구역 선택 버튼 그룹 */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
          {ZONES.map(zone => (
            <button
              key={zone}
              type="button"
              onClick={() => setSelectedZone(zone)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-bold shrink-0 transition-all ${
                selectedZone === zone
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {zone}
            </button>
          ))}
        </div>

        {/* 검색 및 상태 드롭다운 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="순찰자, 특이사항 검색"
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
              <SelectItem value="SAFE" className="text-xs">양호</SelectItem>
              <SelectItem value="WARNING" className="text-xs">주의</SelectItem>
              <SelectItem value="DANGER" className="text-xs">위험</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 순찰 일지 테이블 */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-24 text-center text-xs font-bold text-slate-700">일자 / 시간</TableHead>
                  <TableHead className="w-32 text-xs font-bold text-slate-700">순찰 구역</TableHead>
                  <TableHead className="w-24 text-center text-xs font-bold text-slate-700">순찰자</TableHead>
                  <TableHead className="w-20 text-center text-xs font-bold text-slate-700">점검 결과</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">특이사항 및 점검 내용</TableHead>
                  <TableHead className="w-48 text-xs font-bold text-slate-700">후속 조치 사항</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400">
                      등록된 순찰 일지가 없습니다. 상단의 [순찰 일지 작성]을 통해 새 일지를 기록하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map(log => (
                    <TableRow key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="text-center text-xs font-semibold text-slate-700 whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span>{log.date}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{log.time}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{log.zone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-700 whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className="font-bold">{log.patrolLeader}</span>
                          {log.companionTeachers && log.companionTeachers.length > 0 && (
                            <span className="text-[10px] text-slate-400">외 {log.companionTeachers.length}명</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {renderStatusBadge(log.overallStatus)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-xs sm:max-w-md">
                        <p className="line-clamp-2 leading-relaxed">{log.specialNotes || '특이사항 없음'}</p>
                        {log.checklist && log.checklist.some(c => c.status !== 'SAFE') && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {log.checklist.filter(c => c.status !== 'SAFE').map(item => (
                              <span key={item.id} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {item.label}: {item.note || '확인 필요'}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 max-w-xs">
                        <p className="line-clamp-2 leading-relaxed">{log.actionTaken || '-'}</p>
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
