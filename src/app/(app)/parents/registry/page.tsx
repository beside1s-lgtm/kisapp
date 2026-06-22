'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getAttendanceDocuments } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Search, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from 'xlsx';

export default function ParentsRegistryPage() {
  const { user, profile } = useAuth();
  const [allDocs, setAllDocs] = useState<ApprovalDoc[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<ApprovalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 필터 상태 (조회 클릭 시 적용)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  // 입력 필드 임시 상태
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempCategoryFilter, setTempCategoryFilter] = useState('전체');

  const fetchDocuments = async () => {
    if (!user?.email || !profile) return;
    setIsLoading(true);
    try {
      const data = await getAttendanceDocuments(user.email, profile.isAdmin || false);
      setAllDocs(data);
      setFilteredDocs(data);
    } catch (error) {
      console.error('Error fetching parent attendance docs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user, profile]);

  const handleSearch = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setSearchTerm(tempSearchTerm);
    setCategoryFilter(tempCategoryFilter);
  };

  // 필터링 처리
  useEffect(() => {
    startTransition(() => {
      let result = [...allDocs];

      // 1. 기간 필터링
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        result = result.filter((doc) => {
          const docDate = doc.completedAt ? new Date(doc.completedAt) : new Date(doc.createdAt);
          return docDate >= start;
        });
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        result = result.filter((doc) => {
          const docDate = doc.completedAt ? new Date(doc.completedAt) : new Date(doc.createdAt);
          return docDate <= end;
        });
      }

      // 2. 학생 명칭/학년/반/번호 및 문서번호 검색
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        result = result.filter((doc) => {
          const studentName = doc.parentFormData?.studentName || '';
          const gradeClassNumber = doc.parentFormData?.gradeClassNumber || '';
          return (
            studentName.toLowerCase().includes(term) ||
            gradeClassNumber.toLowerCase().includes(term) ||
            doc.docNo.toLowerCase().includes(term)
          );
        });
      }

      // 3. 구분 필터링 (결석계 vs 체험학습)
      if (categoryFilter && categoryFilter !== '전체') {
        result = result.filter((doc) => {
          if (categoryFilter === '결석계') {
            return doc.parentFormData?.type === 'absence';
          }
          if (categoryFilter === '체험학습') {
            return doc.parentFormData?.type === 'field-trip';
          }
          return true;
        });
      }

      setFilteredDocs(result);
    });
  }, [startDate, endDate, searchTerm, categoryFilter, allDocs]);

  // 학년, 반, 번호 안전 파싱 헬퍼
  const parseGradeClassNumber = (gcn: string | undefined) => {
    if (!gcn) return { grade: '-', classroom: '-', number: '-' };
    const parts = gcn.split('-');
    return {
      grade: parts[0] || '-',
      classroom: parts[1] || '-',
      number: parts[2] || '-'
    };
  };

  // 엑셀(XLSX) 다운로드 기능
  const handleDownloadXlsx = () => {
    if (filteredDocs.length === 0) return;

    // 헤더 정의
    const headers = ['학년', '반', '번호', '학생명', '구분', '세부 종류', '기간', '사유/목적', '사용일수', '최종결재일'];

    // 로우 매핑
    const rows = filteredDocs.map((doc) => {
      const gcn = doc.parentFormData?.gradeClassNumber;
      const { grade, classroom, number } = parseGradeClassNumber(gcn);
      
      const type = doc.parentFormData?.type === 'absence' ? '결석계' : '체험학습';
      const subType = doc.parentFormData?.type === 'absence' 
        ? doc.parentFormData?.absenceType || '병결' 
        : doc.parentFormData?.tripType || '체험학습';
      
      let dateText = '';
      let daysText = '';
      let reasonText = '';

      if (doc.parentFormData?.type === 'absence') {
        const period = doc.parentFormData?.absencePeriod;
        dateText = period ? `${period.startDate} ~ ${period.endDate}` : '';
        daysText = period?.totalDays ? `${period.totalDays}일` : '';
        reasonText = doc.parentFormData?.absenceReason || '';
      } else {
        const period = doc.parentFormData?.tripPeriod;
        dateText = period ? `${period.startDate} ~ ${period.endDate}` : '';
        daysText = period?.totalDays ? `${period.totalDays}일` : '';
        reasonText = doc.parentFormData?.purpose || '';
      }

      const completedDate = doc.completedAt ? format(new Date(doc.completedAt), 'yyyy-MM-dd HH:mm') : '';

      return [
        grade,
        classroom,
        number,
        doc.parentFormData?.studentName || '',
        type,
        subType,
        dateText,
        reasonText,
        daysText,
        completedDate
      ];
    });

    const data = [headers, ...rows];

    // 워크북 및 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '출결체험현황');

    // 셀 너비 자동 보정
    const max_cols = headers.length;
    const wscols = [];
    for (let i = 0; i < max_cols; i++) {
      let max_len = headers[i].length;
      for (let j = 0; j < rows.length; j++) {
        const val = rows[j][i] ? String(rows[j][i]).length : 0;
        if (val > max_len) max_len = val;
      }
      wscols.push({ wch: max_len + 4 });
    }
    worksheet['!cols'] = wscols;

    const formattedDate = format(new Date(), 'yyyyMMdd');
    XLSX.writeFile(workbook, `학부모서비스_출결체험내역_${formattedDate}.xlsx`);
  };

  const getDocBadge = (doc: ApprovalDoc) => {
    if (doc.parentFormData?.type === 'absence') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
          결석계 ({doc.parentFormData?.absenceType || '병결'})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
        체험학습 ({doc.parentFormData?.tripType || '여행'})
      </span>
    );
  };

  const getPeriodText = (doc: ApprovalDoc) => {
    const isAbsence = doc.parentFormData?.type === 'absence';
    const period = isAbsence ? doc.parentFormData?.absencePeriod : doc.parentFormData?.tripPeriod;
    return period ? `${period.startDate} ~ ${period.endDate} (${period.totalDays}일)` : '';
  };

  const getReasonText = (doc: ApprovalDoc) => {
    const isAbsence = doc.parentFormData?.type === 'absence';
    return isAbsence ? doc.parentFormData?.absenceReason || '' : doc.parentFormData?.purpose || '';
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">내역을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      {/* 타이틀 및 다운로드 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">출결 및 체험학습 내역 조회</h2>
          <p className="text-sm text-gray-500 mt-1">학부모가 제출하여 승인이 완료된 학생들의 결석계와 체험학습 신청 내역을 조회합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDocuments} className="h-10">
            <RefreshCw className="h-4 w-4 mr-2" /> 새로고침
          </Button>
          <Button
            onClick={handleDownloadXlsx}
            disabled={filteredDocs.length === 0}
            size="sm"
            className="h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" /> 엑셀 다운로드
          </Button>
        </div>
      </div>

      {/* 필터 툴바 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-white rounded-xl border shadow-sm">
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <Search className="h-3 w-3" /> 구분
          </label>
          <Select value={tempCategoryFilter} onValueChange={setTempCategoryFilter}>
            <SelectTrigger className="w-full h-10 border-gray-200 focus:ring-primary focus:border-primary rounded-lg text-sm bg-white">
              <SelectValue placeholder="구분 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="전체">전체</SelectItem>
              <SelectItem value="결석계">결석계</SelectItem>
              <SelectItem value="체험학습">체험학습</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> 시작일
          </label>
          <Input
            type="date"
            value={tempStartDate}
            onChange={(e) => setTempStartDate(e.target.value)}
            className="w-full h-10 border-gray-200 focus:ring-primary focus:border-primary rounded-lg text-sm"
          />
        </div>
        <div className="space-y-1.5 col-span-1 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> 종료일
          </label>
          <Input
            type="date"
            value={tempEndDate}
            onChange={(e) => setTempEndDate(e.target.value)}
            className="w-full h-10 border-gray-200 focus:ring-primary focus:border-primary rounded-lg text-sm"
          />
        </div>
        <div className="space-y-1.5 col-span-1 md:col-span-4">
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
            <Search className="h-3 w-3" /> 학생 검색 (학년/반/번호/이름)
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="학년, 반, 번호 또는 학생명 검색..."
              value={tempSearchTerm}
              onChange={(e) => setTempSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 border-gray-200 focus:ring-primary focus:border-primary rounded-lg text-sm"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          </div>
        </div>
        <div className="col-span-1 md:col-span-2 flex items-end">
          <Button
            onClick={handleSearch}
            className="w-full h-10 font-bold bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm"
          >
            <Search className="h-4 w-4 mr-2" /> 조회
          </Button>
        </div>
      </div>

      {/* 결과 건수 안내 */}
      <div className="flex items-center justify-between text-sm text-gray-500 px-1">
        <div>
          총 <span className="font-semibold text-gray-900">{filteredDocs.length}</span> 건의 출결 내역이 검색되었습니다.
        </div>
        {isPending && <span className="text-xs text-primary animate-pulse font-semibold">필터링 적용 중...</span>}
      </div>

      {/* 테이블 목록 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase border-b">
              <tr>
                <th scope="col" className="px-4 py-4 font-bold text-center w-[6%]">학년</th>
                <th scope="col" className="px-4 py-4 font-bold text-center w-[6%]">반</th>
                <th scope="col" className="px-4 py-4 font-bold text-center w-[6%]">번호</th>
                <th scope="col" className="px-6 py-4 font-bold w-[12%]">이름</th>
                <th scope="col" className="px-6 py-4 font-bold w-[20%]">구분</th>
                <th scope="col" className="px-6 py-4 font-bold w-[22%]">기간</th>
                <th scope="col" className="px-6 py-4 font-bold w-[18%]">사유 / 목적</th>
                <th scope="col" className="px-6 py-4 font-bold w-[10%]">최종결재일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 font-medium">
                    조회 조건에 부합하는 출결/체험학습 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const { grade, classroom, number } = parseGradeClassNumber(doc.parentFormData?.gradeClassNumber);
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 text-center font-semibold text-gray-900">
                        {grade}
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-gray-900">
                        {classroom}
                      </td>
                      <td className="px-4 py-4 text-center font-semibold text-gray-900">
                        {number}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {doc.parentFormData?.studentName || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {getDocBadge(doc)}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                        {getPeriodText(doc)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={getReasonText(doc)}>
                        {getReasonText(doc)}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {doc.completedAt ? format(new Date(doc.completedAt), 'yyyy-MM-dd') : ''}
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
