'use client';

import React from 'react';
import { 
  Activity, 
  RefreshCw, 
  Pencil, 
  Trash2, 
  FileCheck,
  Camera 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DiseaseRecord, normalizeDiseaseCategory } from '@/lib/services/healthService';
import { COMMON_DISEASES, CATEGORY_BADGE_STYLES } from './types';

interface DiseaseTableProps {
  records: DiseaseRecord[];
  loading: boolean;
  periodLabel: string;
  schoolLevel: 'elementary' | 'secondary' | 'staff';
  onOpenEditDisease: (record: DiseaseRecord) => void;
  onQuickStatusChange: (record: DiseaseRecord, nextStatus: 'isolated' | 'recovered' | 'observing') => void;
  onToggleCertificate?: (record: DiseaseRecord) => void;
  onOpenCertificateDialog?: (record: DiseaseRecord) => void;
  onDelete: (record: DiseaseRecord) => void;
}

export function DiseaseTable({
  records,
  loading,
  periodLabel,
  schoolLevel,
  onOpenEditDisease,
  onQuickStatusChange,
  onToggleCertificate,
  onOpenCertificateDialog,
  onDelete,
}: DiseaseTableProps) {
  const isStaff = schoolLevel === 'staff';

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
      <div className="overflow-x-auto w-full">
        <Table className="min-w-[1250px] w-full">
          <TableHeader className="bg-slate-50">
            <TableRow className="text-xs whitespace-nowrap">
              <TableHead className="w-12 text-center whitespace-nowrap">No</TableHead>
              <TableHead className="w-24 text-center font-bold whitespace-nowrap">
                {isStaff ? '소속 부서' : '학반'}
              </TableHead>
              <TableHead className="w-24 text-center font-bold whitespace-nowrap">
                {isStaff ? '직책' : '담임명'}
              </TableHead>
              <TableHead className="w-32 font-bold whitespace-nowrap">
                {isStaff ? '교직원명' : '성명 (번호)'}
              </TableHead>
              <TableHead className="w-16 text-center whitespace-nowrap">성별</TableHead>
              <TableHead className="w-52 font-bold whitespace-nowrap">병명 (질병명)</TableHead>
              <TableHead className="w-48 text-center whitespace-nowrap">
                {isStaff ? '병가(격리) 기간' : '결석(격리) 기간'}
              </TableHead>
              <TableHead className="w-16 text-center whitespace-nowrap">일수</TableHead>
              <TableHead className="w-28 text-center whitespace-nowrap">상태</TableHead>
              <TableHead className="w-20 text-center whitespace-nowrap">소견서</TableHead>
              <TableHead className="min-w-[180px] whitespace-nowrap">증상 및 비고</TableHead>
              <TableHead className="w-28 text-center whitespace-nowrap">출처</TableHead>
              <TableHead className="w-24 text-center whitespace-nowrap">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-muted-foreground text-xs">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin text-slate-400 mb-2" />
                  {periodLabel} 데이터를 불러오는 중입니다...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-14 text-muted-foreground">
                  <Activity className="w-9 h-9 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-sm text-slate-700">
                    {periodLabel} {isStaff ? '교직원' : schoolLevel === 'elementary' ? '초등' : '중등'}에 기록된 질병/감염병 내역이 없습니다.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isStaff ? (
                      '교직원이 [교원 서비스 > 건강/질병 신고]에서 직접 신고하거나, 우측 상단의 [교직원 질병 등록] 버튼으로 기록하면 즉시 반영됩니다.'
                    ) : (
                      '담임 교사가 출석부나 결석계(병결)를 승인하거나, 우측 상단의 [감염병 환자 등록] 버튼으로 기록하면 즉시 반영됩니다.'
                    )}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              records.map((r, index) => {
                const category = normalizeDiseaseCategory(r.diseaseCategory, r.diseaseName);
                const catStyle = CATEGORY_BADGE_STYLES[category] || CATEGORY_BADGE_STYLES['단순질병'];
                const isCurrentlyIsolated = r.status === 'isolated';

                return (
                  <TableRow key={`${r.id}_${r.diagnosedAt || ''}_${index}`} className="text-xs hover:bg-slate-50/80 transition-colors">
                    <TableCell className="text-center text-slate-500 font-medium whitespace-nowrap">
                      {index + 1}
                    </TableCell>
                    {/* 학반 / 소속부서 */}
                    <TableCell className="text-center font-black text-slate-900 bg-slate-50/50 whitespace-nowrap">
                      {isStaff ? (
                        <Badge variant="outline" className="font-extrabold text-slate-800 bg-white border-slate-300 whitespace-nowrap inline-block">
                          {r.staffDepartment || '교직원'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-extrabold text-slate-800 bg-white border-slate-300 whitespace-nowrap inline-block">
                          {r.grade}-{r.classNum}
                        </Badge>
                      )}
                    </TableCell>
                    {/* 담임명 / 직책 */}
                    <TableCell className="text-center font-bold text-slate-700 whitespace-nowrap">
                      {isStaff ? (r.staffPosition || '-') : (r.homeroomTeacherName || '담임교사')}
                    </TableCell>
                    {/* 학생 성명 (번호) / 교직원명 */}
                    <TableCell className="font-black text-slate-900 whitespace-nowrap">
                      <span>{r.studentName}</span>
                      {!isStaff && r.studentNum && (
                        <span className="text-[11px] text-slate-400 ml-1 font-semibold whitespace-nowrap">
                          ({r.studentNum}번)
                        </span>
                      )}
                    </TableCell>
                    {/* 성별 */}
                    <TableCell className="text-center text-slate-600 font-medium whitespace-nowrap">
                      {r.gender || '-'}
                    </TableCell>
                    {/* 병명 (질병명) & 질병 형태 배지 */}
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5 group whitespace-nowrap">
                        {/* 1. 질병 형태 배지 (감염병/단순질병/식중독 색상 분리) */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-1.5 py-0 shrink-0 whitespace-nowrap ${catStyle.badge}`}
                          title={`질병 형태: ${category}`}
                        >
                          {category}
                        </Badge>
                        {/* 2. 구체적 병명 배지 */}
                        <Badge
                          variant="outline"
                          onClick={() => onOpenEditDisease(r)}
                          className={`text-[11px] font-bold px-2 py-0.5 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all shrink-0 whitespace-nowrap ${catStyle.badge}`}
                          title="클릭하여 병명 및 분류 직접 수정"
                        >
                          {r.diseaseName}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => onOpenEditDisease(r)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 shrink-0"
                          title="병명 수정하기"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </TableCell>
                    {/* 결석(격리) 기간 */}
                    <TableCell className="text-center font-medium text-slate-700 whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap inline-block">
                        {r.isolationStartDate || r.diagnosedAt} ~ {r.isolationEndDate || '-'}
                      </span>
                    </TableCell>
                    {/* 일수 */}
                    <TableCell className="text-center font-bold text-slate-800 whitespace-nowrap">
                      {r.totalDays || 1}일
                    </TableCell>
                    {/* 상태 */}
                    <TableCell className="text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenEditDisease(r)}
                        className="group inline-flex items-center gap-1 focus:outline-none"
                        title="클릭하여 상태 변경 (관찰중/격리/완치)"
                      >
                        {isCurrentlyIsolated ? (
                          <Badge className="bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-black animate-pulse whitespace-nowrap inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-rose-400">
                            {isStaff ? '출근중지' : '등교중지'}
                          </Badge>
                        ) : r.status === 'recovered' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold whitespace-nowrap inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-emerald-400">
                            {isStaff ? '완치(출근)' : '완치(출석)'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-bold whitespace-nowrap inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-400">
                            관찰중
                          </Badge>
                        )}
                        <Pencil className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TableCell>
                    {/* 소견서 */}
                    <TableCell className="text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1">
                        {r.medicalCertificateUrl ? (
                          <button
                            type="button"
                            onClick={() => onOpenCertificateDialog && onOpenCertificateDialog(r)}
                            className="focus:outline-none"
                            title="첨부된 소견서 사진 보기 및 관리"
                          >
                            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 text-[10px] font-bold whitespace-nowrap inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-sky-400">
                              <FileCheck className="w-3 h-3 mr-0.5" />
                              제출완료 (사진)
                            </Badge>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => (onToggleCertificate ? onToggleCertificate(r) : onOpenEditDisease(r))}
                              className="focus:outline-none"
                              title="클릭하여 보건교사 직권으로 제출완료/미제출 즉시 전환"
                            >
                              {r.medicalCertificateSubmitted ? (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300 text-[10px] font-bold whitespace-nowrap inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-400">
                                  <FileCheck className="w-3 h-3 mr-0.5" />
                                  직권제출완료
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 text-[10px] font-medium whitespace-nowrap inline-flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-slate-300 hover:text-slate-700">
                                  미제출
                                </Badge>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenCertificateDialog && onOpenCertificateDialog(r)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                              title="소견서 사진 등록 및 관리"
                            >
                              <Camera className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {/* 증상 및 비고 */}
                    <TableCell className="max-w-[220px]">
                      <div className="truncate text-slate-700 font-medium break-keep" title={r.symptoms}>
                        {r.symptoms || '-'}
                      </div>
                      {r.notes && (
                        <div className="truncate text-[10px] text-slate-400 break-keep" title={r.notes}>
                          ※ {r.notes}
                        </div>
                      )}
                    </TableCell>
                    {/* 출처 */}
                    <TableCell className="text-center whitespace-nowrap">
                      {r.source === 'staff_self' ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-4 bg-teal-50 text-teal-700 border-teal-200 whitespace-nowrap inline-flex items-center justify-center font-semibold">
                          본인 직접신고
                        </Badge>
                      ) : r.notes?.includes('출석부') ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-4 bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap inline-flex items-center justify-center font-semibold">
                          담임 출석부
                        </Badge>
                      ) : r.source === 'absence_doc' ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-4 bg-sky-50 text-sky-700 border-sky-200 whitespace-nowrap inline-flex items-center justify-center font-semibold">
                          담임 결석계
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap inline-flex items-center justify-center font-semibold">
                          보건실 접수
                        </Badge>
                      )}
                    </TableCell>
                    {/* 관리 */}
                    <TableCell className="text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        {isCurrentlyIsolated ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onQuickStatusChange(r, 'recovered')}
                            className="h-6 px-1.5 text-[10px] font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 whitespace-nowrap"
                            title={isStaff ? '완치(출근재개) 상태로 전환' : '완치(등교재개) 상태로 전환'}
                          >
                            {isStaff ? '출근재개' : '등교재개'}
                          </Button>
                        ) : r.status === 'recovered' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onQuickStatusChange(r, 'isolated')}
                            className="h-6 px-1.5 text-[10px] font-bold text-rose-700 border-rose-300 hover:bg-rose-50 whitespace-nowrap"
                            title={isStaff ? '출근중지(격리) 상태로 전환' : '등교중지(격리) 상태로 전환'}
                          >
                            {isStaff ? '출근중지' : '등교중지'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onQuickStatusChange(r, 'isolated')}
                              className="h-6 px-1.5 text-[10px] font-bold text-rose-700 border-rose-300 hover:bg-rose-50 whitespace-nowrap"
                              title={isStaff ? '출근중지(격리) 상태로 전환' : '등교중지(격리) 상태로 전환'}
                            >
                              {isStaff ? '출근중지' : '등교중지'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onQuickStatusChange(r, 'recovered')}
                              className="h-6 px-1.5 text-[10px] font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 whitespace-nowrap"
                              title={isStaff ? '완치(출근) 상태로 전환' : '완치(출석) 상태로 전환'}
                            >
                              완치
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEditDisease(r)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                          title="질병명 및 상세정보 수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(r)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
