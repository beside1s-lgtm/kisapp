'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getTeacherRegistryDocuments } from '@/lib/services/documentService';
import { ApprovalDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Search, Calendar, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from 'xlsx';

export default function TeacherRegistryPage() {
  const { user, profile } = useAuth();
  const [allDocs, setAllDocs] = useState<ApprovalDoc[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<ApprovalDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 필터 상태 (조회 버튼 클릭 시 적용)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  // 입력 필드 임시 상태
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempCategoryFilter, setTempCategoryFilter] = useState('전체');

  const handleSearch = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setSearchTerm(tempSearchTerm);
    setCategoryFilter(tempCategoryFilter);
  };

  const fetchDocuments = async () => {
    if (!user?.email || !profile) return;
    setIsLoading(true);
    try {
      const data = await getTeacherRegistryDocuments(user.email, profile.isAdmin || false);
      setAllDocs(data);
      setFilteredDocs(data);
    } catch (error) {
      console.error('Error fetching teacher registry docs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user, profile]);

  // 필터링 적용 로직
  useEffect(() => {
    startTransition(() => {
      let result = [...allDocs];

      // 1. 기간 필터링 (문서 완료일 completedAt 또는 복무 날짜 기준)
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

      // 2. 대상자(기안자 이름) 검색 필터링
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        result = result.filter(
          (doc) =>
            doc.requesterName.toLowerCase().includes(term) ||
            doc.requesterEmail?.toLowerCase().includes(term) ||
            doc.docNo.toLowerCase().includes(term)
        );
      }

      // 3. 구분 필터링 (전체 / 휴가 / 출장 / 초과근무)
      if (categoryFilter && categoryFilter !== '전체') {
        result = result.filter((doc) => {
          if (categoryFilter === '출장') {
            return doc.docType === 'teacher-duty' && doc.teacherDutyData?.mainType === '출장';
          }
          if (categoryFilter === '휴가') {
            return doc.docType === 'teacher-duty' && doc.teacherDutyData?.mainType !== '출장';
          }
          if (categoryFilter === '초과근무') {
            return doc.docType === 'teacher-overtime';
          }
          return true;
        });
      }

      setFilteredDocs(result);
    });
  }, [startDate, endDate, searchTerm, categoryFilter, allDocs]);

  // 엑셀(XLSX) 다운로드 기능
  const handleDownloadXlsx = () => {
    if (filteredDocs.length === 0) return;

    // 헤더 정의
    const headers = ['문서번호', '구분', '기안자', '직위', '기간/일시', '사유/목적지', '최종결재일'];
    
    // 로우 데이터 매핑
    const rows = filteredDocs.map((doc) => {
      let category = '';
      let dateText = '';
      let detailText = '';

      if (doc.docType === 'teacher-duty') {
        const duty = doc.teacherDutyData;
        category = duty?.detailType || duty?.subType || duty?.mainType || '복무';
        const start = duty?.startDate || '';
        const end = duty?.endDate || '';
        const days = duty?.totalDays ? `${duty.totalDays}일` : '';
        dateText = `${start} ~ ${end} (${days})`;
        
        const destination = duty?.destination ? `[목적지: ${duty.destination}] ` : '';
        const reason = duty?.reason || '';
        detailText = `${destination}${reason}`;
      } else if (doc.docType === 'teacher-overtime') {
        const overtime = doc.teacherOvertimeData;
        category = '초과근무';
        const date = overtime?.date || '';
        const start = overtime?.startTime || '';
        const end = overtime?.endTime || '';
        const hours = overtime?.totalHours ? `${overtime.totalHours}시간` : '';
        dateText = `${date} (${start} ~ ${end}) [${hours}]`;
        
        detailText = overtime?.reason || '';
      }

      const completedDate = doc.completedAt ? format(new Date(doc.completedAt), 'yyyy-MM-dd HH:mm') : '';

      return [
        doc.docNo,
        category,
        doc.requesterName,
        doc.requesterRole,
        dateText,
        detailText,
        completedDate
      ];
    });

    const data = [headers, ...rows];

    // 워크북 및 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '신청내역');

    // 셀 너비 자동 조절
    const max_cols = headers.length;
    const wscols = [];
    for (let i = 0; i < max_cols; i++) {
      let max_len = headers[i].length;
      for (let j = 0; j < rows.length; j++) {
        const val = rows[j][i] ? String(rows[j][i]).length : 0;
        if (val > max_len) max_len = val;
      }
      wscols.push({ wch: max_len + 5 });
    }
    worksheet['!cols'] = wscols;

    const formattedDate = format(new Date(), 'yyyyMMdd');
    XLSX.writeFile(workbook, `교원서비스_신청내역_${formattedDate}.xlsx`);
  };

  const getDocTypeBadge = (doc: ApprovalDoc) => {
    if (doc.docType === 'teacher-duty') {
      const type = doc.teacherDutyData?.detailType || doc.teacherDutyData?.subType || doc.teacherDutyData?.mainType || '복무';
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          {type}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        초과근무
      </span>
    );
  };

  const getPeriodText = (doc: ApprovalDoc) => {
    if (doc.docType === 'teacher-duty') {
      const duty = doc.teacherDutyData;
      return `${duty?.startDate} ~ ${duty?.endDate} (${duty?.totalDays}일)`;
    }
    const overtime = doc.teacherOvertimeData;
    return `${overtime?.date} (${overtime?.startTime} ~ ${overtime?.endTime}) [${overtime?.totalHours}시간]`;
  };

  const getDetailText = (doc: ApprovalDoc) => {
    if (doc.docType === 'teacher-duty') {
      const duty = doc.teacherDutyData;
      const dest = duty?.destination ? `[${duty.destination}] ` : '';
      return `${dest}${duty?.reason || ''}`;
    }
    return doc.teacherOvertimeData?.reason || '';
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">목록을 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      {/* 타이틀 및 액션 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">교원 서비스 신청 내역 조회</h2>
          <p className="text-sm text-gray-500 mt-1">최종 승인이 완료된 복무 신청서 및 초과근무 신청 내역을 조회합니다.</p>
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
              <SelectItem value="휴가">휴가</SelectItem>
              <SelectItem value="출장">출장</SelectItem>
              <SelectItem value="초과근무">초과근무</SelectItem>
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
            <Search className="h-3 w-3" /> 대상자 / 문서번호 검색
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="기안자 이름, 이메일, 문서번호 검색..."
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

      {/* 결과 정보 및 상태 */}
      <div className="flex items-center justify-between text-sm text-gray-500 px-1">
        <div>
          총 <span className="font-semibold text-gray-900">{filteredDocs.length}</span> 건의 신청서 내역이 검색되었습니다.
        </div>
        {isPending && <span className="text-xs text-primary animate-pulse font-semibold">필터링 적용 중...</span>}
      </div>

      {/* 테이블 목록 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-700 uppercase border-b">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold">문서번호</th>
                <th scope="col" className="px-6 py-4 font-bold">구분</th>
                <th scope="col" className="px-6 py-4 font-bold">기안자</th>
                <th scope="col" className="px-6 py-4 font-bold">직위</th>
                <th scope="col" className="px-6 py-4 font-bold">기간 / 일시</th>
                <th scope="col" className="px-6 py-4 font-bold">사유 / 목적지</th>
                <th scope="col" className="px-6 py-4 font-bold">최종승인일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">
                    조회 조건에 부합하는 교원 서비스 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-950 font-mono text-xs">
                      {doc.docNo}
                    </td>
                    <td className="px-6 py-4">
                      {getDocTypeBadge(doc)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {doc.requesterName}
                    </td>
                    <td className="px-6 py-4">
                      {doc.requesterRole}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">
                      {getPeriodText(doc)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={getDetailText(doc)}>
                      {getDetailText(doc)}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {doc.completedAt ? format(new Date(doc.completedAt), 'yyyy-MM-dd HH:mm') : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
