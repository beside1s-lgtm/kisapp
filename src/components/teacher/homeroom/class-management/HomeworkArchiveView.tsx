'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Archive,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Users,
  FileSpreadsheet,
  Trash2,
  Calendar,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import type { HomeroomHomework, HomeroomHomeworkCheck } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';

export interface StudentHomeworkEval {
  studentId: string;
  studentNum?: string | null;
  name: string;
  completedCount: number;
  totalCount: number;
  rate: number; // 0 ~ 100
  grade: '매우잘함' | '잘함' | '보통' | '미흡';
  badgeClass: string;
}

export function getEvaluationGrade(rate: number): {
  grade: '매우잘함' | '잘함' | '보통' | '미흡';
  badgeClass: string;
} {
  if (rate >= 90) {
    return {
      grade: '매우잘함',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    };
  }
  if (rate >= 80) {
    return {
      grade: '잘함',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
    };
  }
  if (rate >= 60) {
    return {
      grade: '보통',
      badgeClass: 'bg-amber-100 text-amber-850 border-amber-300 font-bold',
    };
  }
  return {
    grade: '미흡',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  };
}

interface HomeworkArchiveViewProps {
  classLabel: string;
  archivedHomeworks: HomeroomHomework[];
  homeworkChecks: HomeroomHomeworkCheck[];
  students: MasterStudent[];
  onToggleConfirm: (hwId: string, isConfirmed: boolean) => void;
  onDeleteHomework?: (hwId: string) => void;
  onToggleHwCheck?: (hwId: string, studentId: string, studentName: string) => void;
}

export const HomeworkArchiveView: React.FC<HomeworkArchiveViewProps> = ({
  classLabel,
  archivedHomeworks,
  homeworkChecks,
  students,
  onToggleConfirm,
  onDeleteHomework,
  onToggleHwCheck,
}) => {
  const { toast } = useToast();
  const [selectedArchivedHwId, setSelectedArchivedHwId] = useState<string | null>(null);

  // 정렬된 아카이브 목록 (확인 일시 또는 등록 일시 최신순)
  const sortedArchivedHws = useMemo(() => {
    return [...archivedHomeworks].sort((a, b) => {
      const timeA = a.confirmedAt || a.createdAt || '';
      const timeB = b.confirmedAt || b.createdAt || '';
      return timeB.localeCompare(timeA);
    });
  }, [archivedHomeworks]);

  // 학생별 제출 통계 및 4단계 평가 산출
  const studentEvaluations = useMemo<StudentHomeworkEval[]>(() => {
    const totalN = archivedHomeworks.length;

    return students.map((s) => {
      const sid = s.studentId || s.id || '';
      let mCount = 0;

      archivedHomeworks.forEach((hw) => {
        const isDone = homeworkChecks.some(
          (c) => c.hwId === hw.id && c.studentId === sid && c.checked
        );
        if (isDone) mCount += 1;
      });

      const rate = totalN > 0 ? Math.round((mCount / totalN) * 100) : 0;
      const { grade, badgeClass } = getEvaluationGrade(rate);

      return {
        studentId: sid,
        studentNum: s.studentNum,
        name: s.name,
        completedCount: mCount,
        totalCount: totalN,
        rate,
        grade,
        badgeClass,
      };
    }).sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0));
  }, [archivedHomeworks, homeworkChecks, students]);

  // 학급 전체 요약 통계
  const overallStats = useMemo(() => {
    const totalN = archivedHomeworks.length;
    if (students.length === 0 || totalN === 0) {
      return {
        avgRate: 0,
        gradeCounts: { 매우잘함: 0, 잘함: 0, 보통: 0, 미흡: 0 },
      };
    }

    const sumRate = studentEvaluations.reduce((acc, curr) => acc + curr.rate, 0);
    const avgRate = Math.round(sumRate / students.length);

    const gradeCounts = {
      매우잘함: studentEvaluations.filter((e) => e.grade === '매우잘함').length,
      잘함: studentEvaluations.filter((e) => e.grade === '잘함').length,
      보통: studentEvaluations.filter((e) => e.grade === '보통').length,
      미흡: studentEvaluations.filter((e) => e.grade === '미흡').length,
    };

    return { avgRate, gradeCounts };
  }, [archivedHomeworks.length, studentEvaluations, students.length]);

  // 선택된 아카이브 과제 객체
  const selectedArchivedHw = useMemo(() => {
    if (!selectedArchivedHwId) return null;
    return archivedHomeworks.find((h) => h.id === selectedArchivedHwId) || null;
  }, [archivedHomeworks, selectedArchivedHwId]);

  // 엑셀(XLSX) 다운로드 기능 구현
  const handleExportXLSX = () => {
    if (archivedHomeworks.length === 0) {
      toast({
        title: '내보낼 데이터 없음',
        description: '확인(아카이브)된 숙제가 최소 1건 이상 있어야 합니다.',
        variant: 'destructive',
      });
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const wb = XLSX.utils.book_new();

    // 1. 학생별 종합 평가 시트
    const summaryHeader = [
      '번호',
      '성명',
      '총 과제 수(N)',
      '제출 완료(M)',
      '미제출 건수',
      '달성률(%)',
      '평가 등급',
    ];
    const summaryRows = studentEvaluations.map((e) => [
      e.studentNum || '',
      e.name,
      e.totalCount,
      e.completedCount,
      e.totalCount - e.completedCount,
      `${e.rate}%`,
      e.grade,
    ]);
    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);
    XLSX.utils.book_append_sheet(wb, summaryWs, '학생별제출평가');

    // 2. 과제별 세부 제출 매트릭스 시트
    const matrixHeader = [
      '번호',
      '성명',
      ...sortedArchivedHws.map((h) => `${h.title} (${h.date})`),
      '완료율(%)',
      '평가 등급',
    ];
    const matrixRows = studentEvaluations.map((e) => {
      const checkCells = sortedArchivedHws.map((hw) => {
        const isDone = homeworkChecks.some(
          (c) => c.hwId === hw.id && c.studentId === e.studentId && c.checked
        );
        return isDone ? 'O' : 'X';
      });
      return [
        e.studentNum || '',
        e.name,
        ...checkCells,
        `${e.rate}%`,
        e.grade,
      ];
    });
    const matrixWs = XLSX.utils.aoa_to_sheet([matrixHeader, ...matrixRows]);
    XLSX.utils.book_append_sheet(wb, matrixWs, '과제별상세현황');

    XLSX.writeFile(wb, `${classLabel}_확인된숙제_통계평가_${todayStr}.xlsx`);
    toast({
      title: '엑셀 다운로드 완료',
      description: '확인된 숙제 기반 학생별 통계 및 등급 평가 엑셀이 생성되었습니다.',
    });
  };

  return (
    <div className="space-y-4">
      {/* ── 상단 요약 통계 카드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>보관된 과제 (N)</span>
              <Archive className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {archivedHomeworks.length}
              <span className="text-xs font-bold text-slate-400 ml-1">개</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>학급 평균 달성률</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
              {overallStats.avgRate}
              <span className="text-xs font-bold text-emerald-500 ml-1">%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>우수 (90% 이상)</span>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">
              {overallStats.gradeCounts.매우잘함}
              <span className="text-xs font-bold text-slate-400 ml-1">명</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>지도 필요 (59% 이하)</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
              {overallStats.gradeCounts.미흡}
              <span className="text-xs font-bold text-slate-400 ml-1">명</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 아카이브된 숙제 목록 및 관리 ── */}
      <Card className="rounded-2xl border-slate-200/90 shadow-xs bg-white">
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-indigo-600 shrink-0" />
              <CardTitle className="text-sm sm:text-base font-black text-slate-800">
                확인 완료된 숙제 보관함
              </CardTitle>
              <Badge className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0 border-0">
                총 {archivedHomeworks.length}개
              </Badge>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleExportXLSX}
              disabled={archivedHomeworks.length === 0}
              className="h-8 sm:h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>제출 통계/평가 XLSX 다운로드</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          {archivedHomeworks.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Archive className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs sm:text-sm font-semibold">
                담임교사 확인 처리된 숙제가 아직 없습니다.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                활성 숙제 목록에서 검사가 끝난 숙제의 [확인] 버튼을 누르면 이곳으로 안전하게 아카이브됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {sortedArchivedHws.map((hw) => {
                  const doneCount = students.filter((s) => {
                    const sid = s.studentId || s.id || '';
                    return homeworkChecks.some(
                      (c) => c.hwId === hw.id && c.studentId === sid && c.checked
                    );
                  }).length;
                  const totalCount = students.length;
                  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                  const isSelected = selectedArchivedHwId === hw.id;

                  return (
                    <div
                      key={hw.id}
                      onClick={() => setSelectedArchivedHwId(isSelected ? null : hw.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-400 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-black text-slate-800 truncate">
                              {hw.title}
                            </span>
                            <Badge className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0 h-4 border-0 shrink-0">
                              확인됨
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{hw.dateWithDay || hw.date}</span>
                            <span>·</span>
                            <span className="font-bold text-emerald-700">
                              제출 {doneCount}/{totalCount}명 ({pct}%)
                            </span>
                          </div>
                        </div>

                        {/* 액션 버튼: 확인 취소(되돌리기) 및 삭제 */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onToggleConfirm(hw.id, false)}
                            className="h-7 text-[11px] font-bold px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50 cursor-pointer"
                            title="활성 숙제 목록으로 되돌리기"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            <span>되돌리기</span>
                          </Button>
                          {onDeleteHomework && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeleteHomework(hw.id)}
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 프로그레스 바 */}
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 선택된 아카이브 과제의 학생별 체크표 열람 */}
              {selectedArchivedHw && (
                <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                    <span className="text-xs font-black text-slate-800">
                      [{selectedArchivedHw.title}] 학생별 제출 상세 확인
                    </span>
                    <span className="text-[11px] text-slate-500">
                      카드를 클릭하여 제출 상태를 수정할 수 있습니다.
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                    {students.map((s) => {
                      const sid = s.studentId || s.id || '';
                      const isDone = homeworkChecks.some(
                        (c) => c.hwId === selectedArchivedHw.id && c.studentId === sid && c.checked
                      );

                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => onToggleHwCheck?.(selectedArchivedHw.id, sid, s.name)}
                          className={`p-1.5 rounded-lg border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                            isDone
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[9px] text-slate-400">
                            {s.studentNum ? `${s.studentNum}번` : ''}
                          </span>
                          <span className="text-xs font-bold truncate max-w-[60px]">{s.name}</span>
                          <span
                            className={`text-[10px] font-black mt-0.5 ${
                              isDone ? 'text-emerald-600' : 'text-slate-300'
                            }`}
                          >
                            {isDone ? '✓ 완료' : '미제출'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 학생별 제출율 및 4단계 평가 요약 테이블 ── */}
      <Card className="rounded-2xl border-slate-200/90 shadow-xs bg-white">
        <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <CardTitle className="text-sm sm:text-base font-black text-slate-800">
                  학생별 숙제 제출율 및 등급 평가
                </CardTitle>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                보관된 전체 숙제 수({archivedHomeworks.length}개) 기준 학생별 달성률 및 등급
              </p>
            </div>

            {/* 등급 기준 안내 배지 바 */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-slate-400 font-semibold mr-0.5">등급 기준:</span>
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0 h-4 border-0">
                매우잘함 (90~100%)
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0 h-4 border-0">
                잘함 (80~89%)
              </Badge>
              <Badge className="bg-amber-100 text-amber-850 text-[10px] font-bold px-1.5 py-0 h-4 border-0">
                보통 (60~79%)
              </Badge>
              <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0 h-4 border-0">
                미흡 (59% 이하)
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-14 text-center">번호</th>
                  <th className="py-2.5 px-3 min-w-[90px]">학생 이름</th>
                  <th className="py-2.5 px-3 text-center min-w-[100px]">제출 현황 (M/N)</th>
                  <th className="py-2.5 px-3 min-w-[140px]">달성률 (%)</th>
                  <th className="py-2.5 px-3 text-center min-w-[90px]">평가 등급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentEvaluations.map((evalItem) => (
                  <tr key={evalItem.studentId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {evalItem.studentNum || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-slate-800">
                      {evalItem.name}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                      <span className="text-emerald-700">{evalItem.completedCount}</span>
                      <span className="text-slate-400"> / {evalItem.totalCount}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              evalItem.rate >= 90
                                ? 'bg-emerald-500'
                                : evalItem.rate >= 80
                                ? 'bg-blue-500'
                                : evalItem.rate >= 60
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${evalItem.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-800 w-10 text-right">
                          {evalItem.rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge className={`${evalItem.badgeClass} text-[11px] px-2 py-0.5 border`}>
                        {evalItem.grade}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
