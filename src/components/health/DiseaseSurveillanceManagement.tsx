'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Activity, GraduationCap, School, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Student } from '@/lib/pe/types';
import {
  DiseaseRecord,
  getDiseaseRecordsByPeriod,
  deleteDiseaseRecord,
  updateDiseaseStatus,
  updateDiseaseRecordDetails,
  normalizeDiseaseCategory,
} from '@/lib/services/healthService';
import type { DiseaseStats, DiseaseSurveillanceProps } from './disease-surveillance/types';
import { DiseaseStatsCards } from './disease-surveillance/DiseaseStatsCards';
import { DiseaseToolbar } from './disease-surveillance/DiseaseToolbar';
import { DiseaseTable } from './disease-surveillance/DiseaseTable';
import { DiseaseAddDialog } from './disease-surveillance/DiseaseAddDialog';
import { DiseaseEditDialog } from './disease-surveillance/DiseaseEditDialog';
import { DiseaseCertificateDialog } from './disease-surveillance/DiseaseCertificateDialog';

export function DiseaseSurveillanceManagement({ students }: DiseaseSurveillanceProps) {
  const { toast } = useToast();
  
  // 1. 초등 / 중등 / 교직원 선택 상태 (기본값: 초등)
  const [schoolLevel, setSchoolLevel] = useState<'elementary' | 'secondary' | 'staff'>('elementary');

  // 2. 월별 또는 연간 전체 선택 상태 ('03'~'12', '01', '02' 또는 'all')
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1).padStart(2, '0'));

  const isAnnualMode = selectedMonth === 'all';
  const periodLabel = isAnnualMode 
    ? `${selectedYear}학년도 연간 전체 (3월~익년 2월)` 
    : `${selectedYear}년 ${selectedMonth}월`;

  // 데이터 목록 및 로딩 상태
  const [records, setRecords] = useState<DiseaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 검색 및 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiseaseFilter, setSelectedDiseaseFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // 신규 등록 모달 상태
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // 질병명 및 분류 직접 수정 모달 상태
  const [editingRecord, setEditingRecord] = useState<DiseaseRecord | null>(null);
  const [isEditDiseaseOpen, setIsEditDiseaseOpen] = useState(false);
  const [editDiseaseName, setEditDiseaseName] = useState('');
  const [editDiseaseCategory, setEditDiseaseCategory] = useState('단순질병');
  const [editStatus, setEditStatus] = useState<'isolated' | 'recovered' | 'observing'>('observing');
  const [editCertificateSubmitted, setEditCertificateSubmitted] = useState<boolean>(false);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 소견서/진단서 확인 및 관리 모달 상태
  const [selectedCertRecord, setSelectedCertRecord] = useState<DiseaseRecord | null>(null);
  const [isCertDialogOpen, setIsCertDialogOpen] = useState(false);

  // 데이터 로드 (결석계 병결 + 담임 출석부 + 보건실 자체 기록 + 교직원 신고 통합)
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await getDiseaseRecordsByPeriod(selectedYear, selectedMonth);
      setRecords(data);
    } catch (e) {
      console.error(e);
      toast({ title: '데이터 로드 실패', variant: 'destructive' });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedYear, selectedMonth, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 대상(초등 vs 중등 vs 교직원) 및 검색 필터링된 기록
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. 초등(1~6) / 중등(7~12) / 교직원(staff) 필터
      const isStaffRecord = r.schoolLevel === 'staff' || r.targetType === 'staff';
      if (schoolLevel === 'staff') {
        if (!isStaffRecord) return false;
      } else {
        if (isStaffRecord) return false;
        const gradeNum = parseInt(r.grade, 10) || 1;
        const targetLevel = gradeNum <= 6 ? 'elementary' : 'secondary';
        if (targetLevel !== schoolLevel) return false;
      }

      // 2. 검색어 필터 (학반, 부서, 직책, 담임명, 성명, 병명, 증상)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchGc = `${r.grade}-${r.classNum}`.includes(q) || `${r.grade}학년`.includes(q);
        const matchDept = (r.staffDepartment || '').toLowerCase().includes(q);
        const matchPos = (r.staffPosition || '').toLowerCase().includes(q);
        const matchTeacher = (r.homeroomTeacherName || '').toLowerCase().includes(q);
        const matchName = r.studentName.toLowerCase().includes(q);
        const matchDisease = r.diseaseName.toLowerCase().includes(q);
        const matchSymptoms = (r.symptoms || '').toLowerCase().includes(q);
        if (!matchGc && !matchDept && !matchPos && !matchTeacher && !matchName && !matchDisease && !matchSymptoms) {
          return false;
        }
      }

      // 3. 질병 형태(감염병 / 단순질병 / 식중독) 필터
      if (selectedCategoryFilter !== 'all') {
        const normalizedCat = normalizeDiseaseCategory(r.diseaseCategory, r.diseaseName);
        if (normalizedCat !== selectedCategoryFilter) {
          return false;
        }
      }

      // 4. 특정 질병 필터
      if (selectedDiseaseFilter !== 'all' && r.diseaseName !== selectedDiseaseFilter) {
        return false;
      }

      return true;
    });
  }, [records, schoolLevel, searchQuery, selectedCategoryFilter, selectedDiseaseFilter]);

  // 대시보드 통계 지표 (현재 선택된 초/중/교직원 및 기간 기준)
  const stats: DiseaseStats = useMemo(() => {
    const totalCount = filteredRecords.length;
    const distinctClasses = new Set(
      filteredRecords.map(r =>
        schoolLevel === 'staff'
          ? (r.staffDepartment || '교직원')
          : `${r.grade}-${r.classNum}`
      )
    );
    const isolatedCount = filteredRecords.filter(r => r.status === 'isolated').length;
    const recoveredCount = filteredRecords.filter(r => r.status === 'recovered').length;

    const diseaseMap: Record<string, number> = {};
    filteredRecords.forEach(r => {
      diseaseMap[r.diseaseName] = (diseaseMap[r.diseaseName] || 0) + 1;
    });
    const topDiseases = Object.entries(diseaseMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      totalCount,
      classCount: distinctClasses.size,
      isolatedCount,
      recoveredCount,
      topDiseases
    };
  }, [filteredRecords, schoolLevel]);

  // 상태 빠른 변경 (관찰중 / 격리 / 완치)
  const handleQuickStatusChange = async (record: DiseaseRecord, nextStatus: 'isolated' | 'recovered' | 'observing') => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await updateDiseaseRecordDetails(
        record,
        record.diseaseName,
        record.diseaseCategory,
        record.notes,
        nextStatus,
        record.medicalCertificateSubmitted
      );
      setRecords(prev => prev.map(r => r.id === record.id ? {
        ...r,
        status: nextStatus,
        isolationEndDate: nextStatus === 'recovered' ? todayStr : r.isolationEndDate,
        source: 'health_manual',
      } : r));
      const isStaffRec = record.schoolLevel === 'staff' || record.targetType === 'staff';
      toast({
        title: nextStatus === 'recovered' 
          ? (isStaffRec ? '출근재개(완치) 처리 완료' : '등교재개(완치) 처리 완료') 
          : nextStatus === 'isolated' 
          ? (isStaffRec ? '출근중지(격리) 상태로 변경' : '등교중지(격리) 상태로 변경') 
          : '관찰중 상태로 변경',
        description: `${record.studentName} ${isStaffRec ? '교직원' : '학생'} 상태가 갱신되었습니다.`
      });
    } catch (err) {
      toast({ title: '상태 변경 실패', variant: 'destructive' });
    }
  };

  // 소견서 제출 여부 1클릭 토글
  const handleToggleCertificate = async (record: DiseaseRecord) => {
    const nextVal = !record.medicalCertificateSubmitted;
    try {
      await updateDiseaseRecordDetails(
        record,
        record.diseaseName,
        record.diseaseCategory,
        record.notes,
        record.status,
        nextVal
      );
      setRecords(prev => prev.map(r => r.id === record.id ? {
        ...r,
        medicalCertificateSubmitted: nextVal,
        source: 'health_manual',
      } : r));
      const isStaffRec = record.schoolLevel === 'staff' || record.targetType === 'staff';
      toast({
        title: nextVal ? '소견서: 제출완료로 변경' : '소견서: 미제출로 변경',
        description: `${record.studentName} ${isStaffRec ? '교직원' : '학생'}의 소견서 상태가 반영되었습니다.`
      });
    } catch (err) {
      toast({ title: '소견서 상태 변경 실패', variant: 'destructive' });
    }
  };

  // 소견서/진단서 팝업 열기
  const handleOpenCertificateDialog = (record: DiseaseRecord) => {
    setSelectedCertRecord(record);
    setIsCertDialogOpen(true);
  };

  // 소견서 상태 및 사진 저장
  const handleUpdateCertificate = async (record: DiseaseRecord, submitted: boolean, newUrl?: string) => {
    try {
      await updateDiseaseRecordDetails(
        record,
        record.diseaseName,
        record.diseaseCategory,
        record.notes,
        record.status,
        submitted,
        newUrl
      );
      setRecords(prev => prev.map(r => r.id === record.id ? {
        ...r,
        medicalCertificateSubmitted: submitted,
        medicalCertificateUrl: newUrl !== undefined ? newUrl : r.medicalCertificateUrl,
        source: 'health_manual',
      } : r));
      if (selectedCertRecord?.id === record.id) {
        setSelectedCertRecord(prev => prev ? {
          ...prev,
          medicalCertificateSubmitted: submitted,
          medicalCertificateUrl: newUrl !== undefined ? newUrl : prev.medicalCertificateUrl,
        } : null);
      }
      toast({
        title: submitted ? '소견서: 제출 완료 처리됨' : '소견서: 미제출 처리됨',
        description: `${record.studentName} 학생의 소견서 상태가 정상 반영되었습니다.`
      });
    } catch (err) {
      console.error('handleUpdateCertificate error:', err);
      toast({ title: '소견서 상태 저장 실패', variant: 'destructive' });
    }
  };

  // 삭제
  const handleDelete = async (record: DiseaseRecord) => {
    if (!window.confirm(`${record.studentName} 학생의 기록을 삭제하시겠습니까?`)) return;
    try {
      await deleteDiseaseRecord(record.id);
      toast({ title: '삭제 완료', description: '기록이 삭제되었습니다.' });
      loadData(true);
    } catch (err) {
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  };

  // 질병명 및 분류 직접 수정 모달 열기
  const handleOpenEditDisease = (record: DiseaseRecord) => {
    setEditingRecord(record);
    const initialName = record.diseaseName === '사유 미기재(확인필요)' ? '' : record.diseaseName;
    setEditDiseaseName(initialName);
    const normalizedCategory = normalizeDiseaseCategory(record.diseaseCategory, record.diseaseName);
    setEditDiseaseCategory(normalizedCategory);
    setEditStatus(record.status || 'observing');
    setEditCertificateSubmitted(Boolean(record.medicalCertificateSubmitted));
    setEditNotes(record.notes || '');
    setIsEditDiseaseOpen(true);
  };

  // 질병명 및 분류 수정 저장
  const handleSaveDiseaseEdit = async () => {
    if (!editingRecord || !editDiseaseName.trim()) {
      toast({ title: '병명을 입력해주세요.', variant: 'destructive' });
      return;
    }
    setIsSavingEdit(true);
    try {
      const trimmedName = editDiseaseName.trim();
      await updateDiseaseRecordDetails(
        editingRecord,
        trimmedName,
        editDiseaseCategory,
        editNotes,
        editStatus,
        editCertificateSubmitted
      );

      // 로컬 상태 즉각 반영 (0ms 지연)
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? {
        ...r,
        diseaseName: trimmedName,
        diseaseCategory: editDiseaseCategory,
        status: editStatus,
        medicalCertificateSubmitted: editCertificateSubmitted,
        notes: editNotes,
        source: 'health_manual',
      } : r));

      toast({
        title: '질병 정보가 수정되었습니다.',
        description: `${editingRecord.studentName} 학생: [${trimmedName}]`
      });
      setIsEditDiseaseOpen(false);
    } catch (err: any) {
      console.error('handleSaveDiseaseEdit error:', err);
      toast({ title: '수정 실패', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 엑셀 내보내기 (현재 필터링된 결과 또는 연간 전체 선택 가능)
  const handleExportExcel = async (mode: 'current' | 'annual' = 'current') => {
    let targetList = filteredRecords;
    let sheetTitle = isAnnualMode ? `${selectedYear}학년도_연간` : `${selectedYear}년_${selectedMonth}월`;

    if (mode === 'annual' && !isAnnualMode) {
      toast({ title: '연간 전체 데이터 준비 중...' });
      const annualData = await getDiseaseRecordsByPeriod(selectedYear, 'all');
      targetList = annualData.filter(r => {
        const gradeNum = parseInt(r.grade, 10) || 1;
        const targetLevel = gradeNum <= 6 ? 'elementary' : 'secondary';
        if (targetLevel !== schoolLevel) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchGc = `${r.grade}-${r.classNum}`.includes(q) || `${r.grade}학년`.includes(q);
          const matchTeacher = (r.homeroomTeacherName || '').toLowerCase().includes(q);
          const matchName = r.studentName.toLowerCase().includes(q);
          const matchDisease = r.diseaseName.toLowerCase().includes(q);
          const matchSymptoms = (r.symptoms || '').toLowerCase().includes(q);
          if (!matchGc && !matchTeacher && !matchName && !matchDisease && !matchSymptoms) {
            return false;
          }
        }

        if (selectedCategoryFilter !== 'all') {
          const normCat = normalizeDiseaseCategory(r.diseaseCategory, r.diseaseName);
          if (normCat !== selectedCategoryFilter) return false;
        }

        if (selectedDiseaseFilter !== 'all' && r.diseaseName !== selectedDiseaseFilter) {
          return false;
        }

        return true;
      });
      sheetTitle = `${selectedYear}학년도_연간전체`;
    }

    if (targetList.length === 0) {
      toast({ title: '내보낼 데이터가 없습니다.', variant: 'destructive' });
      return;
    }

    const levelKo = schoolLevel === 'elementary' ? '초등' : schoolLevel === 'secondary' ? '중등' : '교직원';
    const catTag = selectedCategoryFilter !== 'all' ? `_${selectedCategoryFilter}` : '';
    const isStaffMode = schoolLevel === 'staff';

    const exportData = targetList.map((r, idx) => ({
      연번: idx + 1,
      ...(isStaffMode ? {
        '소속(부서)': r.staffDepartment || r.grade || '교직원',
        '직책': r.staffPosition || r.homeroomTeacherName || '교직원',
        '교직원명': r.studentName,
      } : {
        '학반': `${r.grade}-${r.classNum}`,
        '담임': r.homeroomTeacherName || '담임교사',
        '번호': r.studentNum || '-',
        '성명': r.studentName,
      }),
      성별: r.gender || '-',
      질병형태: normalizeDiseaseCategory(r.diseaseCategory, r.diseaseName),
      병명: r.diseaseName,
      ...(isStaffMode ? {
        '병가(격리)기간': `${r.isolationStartDate || r.diagnosedAt} ~ ${r.isolationEndDate || '-'}`,
        '일수': r.totalDays ? `${r.totalDays}일` : '1일',
        '상태': r.status === 'isolated' ? '출근중지(격리)' : '완치(출근)',
      } : {
        '결석기간': `${r.isolationStartDate || r.diagnosedAt} ~ ${r.isolationEndDate || '-'}`,
        '일수': r.totalDays ? `${r.totalDays}일` : '1일',
        '상태': r.status === 'isolated' ? '등교중지(격리)' : '완치(출석)',
      }),
      소견서: r.medicalCertificateSubmitted ? '제출' : '미제출',
      증상및비고: r.symptoms || r.notes || '-',
      출처: r.source === 'staff_self' ? '본인 직접신고' : r.notes?.includes('출석부') ? '담임 출석부' : r.source === 'absence_doc' ? '담임 결석계' : '보건실 접수'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${levelKo}${catTag}_${sheetTitle}`);
    const filename = `${levelKo}_감염병_및_질병현황${catTag}_${sheetTitle}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast({ title: '엑셀 다운로드 완료', description: filename });
  };

  // A4 표준 보고서 팝업 인쇄 (월간 또는 연간 전체 선택 가능)
  const handlePrintReport = async (mode: 'current' | 'annual' = 'current') => {
    let targetList = filteredRecords;
    let titlePeriod = isAnnualMode ? `${selectedYear}학년도 연간 전체` : `${selectedYear}년 ${selectedMonth}월`;

    if (mode === 'annual' && !isAnnualMode) {
      toast({ title: '연간 전체 인쇄 데이터 준비 중...' });
      const annualData = await getDiseaseRecordsByPeriod(selectedYear, 'all');
      targetList = annualData.filter(r => {
        const isStaffRec = r.schoolLevel === 'staff' || r.targetType === 'staff';
        if (schoolLevel === 'staff') return isStaffRec;
        if (isStaffRec) return false;
        const gradeNum = parseInt(r.grade, 10) || 1;
        return (gradeNum <= 6 ? 'elementary' : 'secondary') === schoolLevel;
      });
      titlePeriod = `${selectedYear}학년도 연간 전체`;
    }

    const levelKo = schoolLevel === 'elementary' ? '초등' : schoolLevel === 'secondary' ? '중등' : '교직원';
    const isStaffMode = schoolLevel === 'staff';
    const docTitle = `${titlePeriod}_${levelKo}_감염병_및_질병현황_보고서`;
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) {
      toast({ title: '팝업 차단을 해제해주세요.', variant: 'destructive' });
      return;
    }

    const rowsHtml = targetList.map((r, i) => `
      <tr>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">${i + 1}</td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000; font-weight: bold;">
          ${isStaffMode ? (r.staffDepartment || '교직원') : `${r.grade}-${r.classNum}`}
        </td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">
          ${isStaffMode ? (r.staffPosition || '-') : (r.homeroomTeacherName || '담임교사')}
        </td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000; font-weight: bold;">
          ${r.studentName} ${!isStaffMode && r.studentNum ? `(${r.studentNum}번)` : ''}
        </td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">${r.gender || '-'}</td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000; font-weight: bold; color: #b91c1c;">${r.diseaseName}</td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">${r.isolationStartDate || r.diagnosedAt} ~ ${r.isolationEndDate || '-'}</td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">${r.totalDays || 1}일</td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">
          ${r.status === 'isolated' ? (isStaffMode ? '출근중지' : '등교중지') : (isStaffMode ? '완치(출근)' : '완치(출석)')}
        </td>
        <td style="text-align: center; padding: 6px; border: 1px solid #000;">${r.medicalCertificateSubmitted ? '제출' : '미제출'}</td>
        <td style="padding: 6px; border: 1px solid #000; font-size: 11px;">
          ${r.symptoms || ''} ${r.notes ? `[${r.notes}]` : ''}
        </td>
      </tr>
    `).join('');

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #000; margin: 0; padding: 10px; }
            .header { text-align: center; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #444; }
            .meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f0f0f0; border: 1px solid #000; padding: 6px; text-align: center; }
            .summary-box { margin-top: 15px; border: 1px solid #000; padding: 10px; font-size: 11px; background: #fafafa; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${titlePeriod} ${levelKo} ${isStaffMode ? '감염병 및 질병 현황 대장' : '학생 감염병 및 질병 현황 대장'}</div>
            <div class="subtitle">호치민시한국국제학교 보건실 (총 ${targetList.length}건 / ${isStaffMode ? '질병 발생 교직원만 표기' : '결석 발생 학급만 표기'})</div>
          </div>
          <div class="meta">
            <div>대상: ${levelKo} ${isStaffMode ? '(행정실/교무실/전체 교직원)' : `(${levelKo === '초등' ? '1~6학년' : '7~12학년'})`} · 작성 기준: ${titlePeriod}</div>
            <div>출력일시: ${format(new Date(), 'yyyy-MM-dd HH:mm')}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 70px;">${isStaffMode ? '소속 부서' : '학반'}</th>
                <th style="width: 70px;">${isStaffMode ? '직책' : '담임명'}</th>
                <th style="width: 80px;">${isStaffMode ? '교직원명' : '성명(번호)'}</th>
                <th style="width: 35px;">성별</th>
                <th style="width: 110px;">병명</th>
                <th style="width: 130px;">${isStaffMode ? '병가(격리) 기간' : '결석(격리) 기간'}</th>
                <th style="width: 45px;">일수</th>
                <th style="width: 65px;">상태</th>
                <th style="width: 50px;">소견서</th>
                <th>주요 증상 및 비고</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="11" style="text-align: center; padding: 25px; border: 1px solid #000;">해당 기간에 보고된 ${isStaffMode ? '교직원' : '학생'} 감염병 및 질병 내역이 없습니다.</td></tr>`}
            </tbody>
          </table>
          <div class="summary-box">
            <div style="font-weight: bold; margin-bottom: 4px;">[기간 통계 요약]</div>
            <div>총 발생 인원: ${targetList.length}명 · 현재 ${isStaffMode ? '출근중지(격리)' : '등교중지'}: ${targetList.filter(r => r.status === 'isolated').length}명 · 완치: ${targetList.filter(r => r.status === 'recovered').length}명</div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">※ 본 문서는 학교보건법에 따라 ${isStaffMode ? '교직원 질병 신고 건' : '담임 출석부 및 결석계 병결 건'}을 취합하여 학교장에게 보고하는 법정 양식 대장입니다.</div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      popup.print();
    }, 500);
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Activity className="w-5 h-5 text-rose-600" />
                감염병 및 질병현황
              </CardTitle>
              <span className="text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                월별 대장 · 초·중등·교직원 격리
              </span>
            </div>
            <CardDescription className="text-xs mt-1">
              담임 교사가 출석부 및 결석계에서 병결 처리한 학생과 교직원 건강/질병 신고 내역을 실시간으로 취합하며, 유증상자 발생 학급 및 부서만 핀포인트로 표시합니다.
            </CardDescription>
          </div>

          {/* 초등 / 중등 / 교직원 전환 버튼 */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setSchoolLevel('elementary')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all ${
                schoolLevel === 'elementary'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <School className="w-4 h-4 text-emerald-600" />
              초등 (1~6학년)
            </button>
            <button
              type="button"
              onClick={() => setSchoolLevel('secondary')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all ${
                schoolLevel === 'secondary'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              중등 (7~12학년)
            </button>
            <button
              type="button"
              onClick={() => setSchoolLevel('staff')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all ${
                schoolLevel === 'staff'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-purple-600" />
              교직원
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* ── 1. 핵심 대시보드 통계 카드 ── */}
        <DiseaseStatsCards
          stats={stats}
          isAnnualMode={isAnnualMode}
          selectedMonth={selectedMonth}
          schoolLevel={schoolLevel}
        />

        {/* ── 2. 툴바 (연도/월/연간 선택, 인쇄/엑셀, 검색, 필터) ── */}
        <DiseaseToolbar
          schoolLevel={schoolLevel}
          setSchoolLevel={setSchoolLevel}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          isAnnualMode={isAnnualMode}
          periodLabel={periodLabel}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedDiseaseFilter={selectedDiseaseFilter}
          setSelectedDiseaseFilter={setSelectedDiseaseFilter}
          selectedCategoryFilter={selectedCategoryFilter}
          setSelectedCategoryFilter={setSelectedCategoryFilter}
          isRefreshing={isRefreshing}
          onRefresh={() => loadData(true)}
          onExportExcel={handleExportExcel}
          onPrintReport={handlePrintReport}
          onOpenAddDialog={() => setIsAddDialogOpen(true)}
        />

        {/* ── 3. 감염병 및 결석 학생 명단 테이블 ── */}
        <DiseaseTable
          records={filteredRecords}
          loading={loading}
          periodLabel={periodLabel}
          schoolLevel={schoolLevel}
          onOpenEditDisease={handleOpenEditDisease}
          onQuickStatusChange={handleQuickStatusChange}
          onToggleCertificate={handleToggleCertificate}
          onOpenCertificateDialog={handleOpenCertificateDialog}
          onDelete={handleDelete}
        />
      </CardContent>

      {/* ── 4. 신규 감염병 환자 등록 모달 ── */}
      <DiseaseAddDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        students={students}
        schoolLevel={schoolLevel}
        onSaved={() => loadData(true)}
      />

      {/* ── 5. 질병명 및 분류 직접 수정 모달 ── */}
      <DiseaseEditDialog
        open={isEditDiseaseOpen}
        onOpenChange={setIsEditDiseaseOpen}
        record={editingRecord}
        editDiseaseName={editDiseaseName}
        setEditDiseaseName={setEditDiseaseName}
        editDiseaseCategory={editDiseaseCategory}
        setEditDiseaseCategory={setEditDiseaseCategory}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editCertificateSubmitted={editCertificateSubmitted}
        setEditCertificateSubmitted={setEditCertificateSubmitted}
        editNotes={editNotes}
        setEditNotes={setEditNotes}
        isSaving={isSavingEdit}
        onSave={handleSaveDiseaseEdit}
      />

      {/* ── 6. 소견서 / 진단서 확인 및 직권 관리 모달 ── */}
      <DiseaseCertificateDialog
        open={isCertDialogOpen}
        onOpenChange={setIsCertDialogOpen}
        record={selectedCertRecord}
        onUpdateCertificate={handleUpdateCertificate}
      />
    </Card>
  );
}
