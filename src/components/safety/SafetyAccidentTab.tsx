'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, AlertTriangle, CheckCircle2, Clock, Phone, HeartHandshake, User, MapPin } from 'lucide-react';
import type { SafetyIncident, IncidentStatus, IncidentType } from '@/lib/safety/types';
import { updateIncidentStatus } from '@/lib/services/safetyService';
import { useToast } from '@/hooks/use-toast';

interface SafetyAccidentTabProps {
  incidents: SafetyIncident[];
  onRefresh: () => void;
  onOpenNewIncidentModal: () => void;
}

export function SafetyAccidentTab({ incidents, onRefresh, onOpenNewIncidentModal }: SafetyAccidentTabProps) {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(item => {
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const text = `${item.victimName} ${item.location} ${item.description} ${item.type}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [incidents, selectedStatus, searchQuery]);

  const handleStatusChange = async (id: string, newStatus: IncidentStatus) => {
    setUpdatingId(id);
    try {
      await updateIncidentStatus(id, newStatus);
      toast({
        title: '상태 변경 완료',
        description: '안전사고 처리 상태가 성공적으로 업데이트되었습니다.',
      });
      onRefresh();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '상태 업데이트에 실패했습니다.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-amber-50 text-amber-700 border-amber-300">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            접수 대기
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-sky-50 text-sky-700 border-sky-300">
            <AlertTriangle className="w-3 h-3 mr-1 text-sky-600" />
            조치 진행 중
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge variant="outline" className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            조치 완료
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="학생명, 장소, 사고경위 검색"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-8 text-xs w-32 bg-white border-slate-200">
              <SelectValue placeholder="처리 상태 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">처리 상태 전체</SelectItem>
              <SelectItem value="RECEIVED" className="text-xs">접수 대기</SelectItem>
              <SelectItem value="IN_PROGRESS" className="text-xs">조치 진행 중</SelectItem>
              <SelectItem value="RESOLVED" className="text-xs">조치 완료</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-xs font-semibold text-slate-500">
            총 <b className="text-slate-800">{filteredIncidents.length}</b>건
          </span>
        </div>
      </div>

      {/* 안전사고 접수 대장 테이블 */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="w-24 text-center text-xs font-bold text-slate-700">발생 일시</TableHead>
                  <TableHead className="w-28 text-xs font-bold text-slate-700">사고 유형</TableHead>
                  <TableHead className="w-28 text-xs font-bold text-slate-700">대상자 / 학급</TableHead>
                  <TableHead className="w-32 text-xs font-bold text-slate-700">발생 장소</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">사고 경위 및 응급처치</TableHead>
                  <TableHead className="w-24 text-center text-xs font-bold text-slate-700">학부모 연락</TableHead>
                  <TableHead className="w-28 text-center text-xs font-bold text-slate-700">처리 상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400">
                      등록된 안전사고가 없습니다. 안전하고 평온한 학교 환경이 유지되고 있습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIncidents.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="text-center text-xs font-semibold text-slate-700 whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span>{item.incidentDate}</span>
                          <span className="text-[10px] text-slate-400">{item.incidentTime}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-800 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 text-slate-700 border-slate-200">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-800 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{item.victimName}</span>
                          {item.victimGradeClass && (
                            <span className="text-[11px] text-slate-500">{item.victimGradeClass}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{item.location}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-sm sm:max-w-md">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-800 line-clamp-2 leading-relaxed">{item.description}</p>
                          {item.firstAidGiven && (
                            <p className="text-[11px] text-emerald-700 bg-emerald-50/60 p-1 rounded border border-emerald-100/70">
                              <span className="font-bold">조치:</span> {item.firstAidGiven}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {item.guardianNotified ? (
                          <div className="flex flex-col items-center text-emerald-600">
                            <span className="text-xs font-bold flex items-center gap-0.5">
                              <Phone className="w-3 h-3" /> 완료
                            </span>
                            {item.guardianNotificationTime && (
                              <span className="text-[10px] text-slate-400">{item.guardianNotificationTime}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">미통보</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Select
                          value={item.status}
                          onValueChange={(val) => handleStatusChange(item.id, val as IncidentStatus)}
                          disabled={updatingId === item.id}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-28 bg-white border-slate-200 font-bold mx-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RECEIVED" className="text-xs font-bold text-amber-700">접수 대기</SelectItem>
                            <SelectItem value="IN_PROGRESS" className="text-xs font-bold text-sky-700">조치 진행 중</SelectItem>
                            <SelectItem value="RESOLVED" className="text-xs font-bold text-emerald-700">조치 완료</SelectItem>
                          </SelectContent>
                        </Select>
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
