'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  Camera, 
  Clock, 
  AlertCircle, 
  FileCheck 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DiseaseRecord, updateDiseaseRecordDetails, normalizeDiseaseCategory } from '@/lib/services/healthService';
import { CATEGORY_BADGE_STYLES } from '@/components/health/disease-surveillance/types';

interface StaffDiseaseHistoryProps {
  records: DiseaseRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function StaffDiseaseHistory({
  records,
  loading,
  onRefresh,
}: StaffDiseaseHistoryProps) {
  const { toast } = useToast();
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 본인의 질병 상태를 완치(출근완료)로 전환
  const handleMarkRecovered = async (r: DiseaseRecord) => {
    setIsUpdating(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await updateDiseaseRecordDetails(
        r,
        r.diseaseName,
        r.diseaseCategory,
        r.notes,
        'recovered',
        r.medicalCertificateSubmitted
      );
      toast({
        title: '출근완료(완치) 처리 완료',
        description: '보건실 대장에 완치 상태로 갱신되었습니다.',
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: '상태 변경 실패', description: e.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-purple-600" />
              나의 건강/질병 신고 내역
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              본인이 신고한 질병 내역과 보건실 연동 현황입니다. 완치 후 정상 출근 시 [출근완료] 버튼을 눌러주세요.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-7 px-2.5 text-xs text-slate-700 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px] w-full text-xs">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="whitespace-nowrap">
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead className="w-32 font-bold">병명 (질병명)</TableHead>
                <TableHead className="w-44 text-center">병가(격리) 기간</TableHead>
                <TableHead className="w-16 text-center">일수</TableHead>
                <TableHead className="w-28 text-center">상태</TableHead>
                <TableHead className="w-24 text-center">소견서</TableHead>
                <TableHead className="min-w-[150px]">증상 및 비고</TableHead>
                <TableHead className="w-24 text-center">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-400 mb-2" />
                    신고 내역을 불러오는 중입니다...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50 mb-1.5" />
                    <p className="font-bold text-xs text-slate-700">신고된 질병 내역이 없습니다.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      건강 이상 또는 질병 진단 시 위의 양식을 작성하여 제출하세요.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r, idx) => {
                  const category = normalizeDiseaseCategory(r.diseaseCategory, r.diseaseName);
                  const catStyle = CATEGORY_BADGE_STYLES[category] || CATEGORY_BADGE_STYLES['단순질병'];
                  const isIsolated = r.status === 'isolated';

                  return (
                    <TableRow key={r.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="text-center text-slate-400 font-medium">
                        {idx + 1}
                      </TableCell>
                      {/* 병명 및 형태 배지 */}
                      <TableCell className="whitespace-nowrap font-bold">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${catStyle.badge}`}>
                            {category}
                          </Badge>
                          <span className="text-slate-900">{r.diseaseName}</span>
                        </div>
                      </TableCell>
                      {/* 병가 기간 */}
                      <TableCell className="text-center text-slate-700 font-medium whitespace-nowrap">
                        {r.isolationStartDate || r.diagnosedAt} ~ {r.isolationEndDate || '-'}
                      </TableCell>
                      {/* 일수 */}
                      <TableCell className="text-center font-bold text-slate-800 whitespace-nowrap">
                        {r.totalDays || 1}일
                      </TableCell>
                      {/* 상태 배지 */}
                      <TableCell className="text-center whitespace-nowrap">
                        {isIsolated ? (
                          <Badge className="bg-rose-600 text-white text-[10px] font-bold">
                            출근중지(격리)
                          </Badge>
                        ) : r.status === 'recovered' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold">
                            완치(출근완료)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-bold">
                            증상관찰중
                          </Badge>
                        )}
                      </TableCell>
                      {/* 소견서 */}
                      <TableCell className="text-center whitespace-nowrap">
                        {r.medicalCertificateUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotoUrl(r.medicalCertificateUrl!);
                              setIsPhotoDialogOpen(true);
                            }}
                            className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 font-bold"
                            title="소견서 사진 보기"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            사진 확인
                          </button>
                        ) : r.medicalCertificateSubmitted ? (
                          <span className="inline-flex items-center text-emerald-600 font-semibold">
                            <FileCheck className="w-3.5 h-3.5 mr-0.5" />
                            제출됨
                          </span>
                        ) : (
                          <span className="text-slate-400">미제출</span>
                        )}
                      </TableCell>
                      {/* 증상 및 비고 */}
                      <TableCell className="max-w-[200px] truncate text-slate-600">
                        {r.symptoms || r.notes || '-'}
                      </TableCell>
                      {/* 관리 버튼 */}
                      <TableCell className="text-center whitespace-nowrap">
                        {isIsolated && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleMarkRecovered(r)}
                            className="h-6 px-2 text-[10px] font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 whitespace-nowrap"
                          >
                            출근완료
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* 소견서 사진 확인 모달 */}
      <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600" />
              첨부된 소견서/진단서 사진
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex justify-center bg-slate-950/5 p-2 rounded-lg">
            {selectedPhotoUrl && (
              <img
                src={selectedPhotoUrl}
                alt="소견서 원본"
                className="max-h-[70vh] w-auto object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
