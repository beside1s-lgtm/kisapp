'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, Search, Download } from 'lucide-react';
import type { ApprovalDoc } from '@/lib/types';

export function RegistryTabContent({
  allDocs,
  filteredDocs,
  loadingDocs,
  filterCategory,
  setFilterCategory,
  filterStatus,
  setFilterStatus,
  filterSearch,
  setFilterSearch,
  handleExportCsv,
  router,
  setPreviewDoc,
}: {
  allDocs: ApprovalDoc[];
  filteredDocs: ApprovalDoc[];
  loadingDocs: boolean;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterSearch: string;
  setFilterSearch: (val: string) => void;
  handleExportCsv: () => void;
  router: any;
  setPreviewDoc: (doc: ApprovalDoc | null) => void;
}) {
  return (
    <TabsContent value="registry" className="space-y-3">
      {/* 통계 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-3 shadow-2xs">
          <div className="text-[11px] text-muted-foreground font-bold">전체 제출</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{allDocs.length}건</div>
        </Card>
        <Card className="p-3 shadow-2xs">
          <div className="text-[11px] text-muted-foreground font-bold">승인 완료</div>
          <div className="text-xl font-bold text-green-700 mt-0.5">
            {allDocs.filter(d => d.status === 'approved').length}건
          </div>
        </Card>
        <Card className="p-3 shadow-2xs">
          <div className="text-[11px] text-muted-foreground font-bold">확인서 완료</div>
          <div className="text-xl font-bold text-teal-700 mt-0.5">
            {allDocs.filter(d => d.volunteerFormData?.reportSubmitted || d.reportSubmitted).length}건
          </div>
        </Card>
        <Card className="p-3 shadow-2xs">
          <div className="text-[11px] text-muted-foreground font-bold">결재 대기</div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">
            {allDocs.filter(d => d.status === 'pending').length}건
          </div>
        </Card>
      </div>

      {/* 필터 및 검색 바 */}
      <Card className="p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue placeholder="구분" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 구분</SelectItem>
                <SelectItem value="개인">개인 봉사</SelectItem>
                <SelectItem value="단체">단체 봉사</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-28">
                <SelectValue placeholder="결재상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 상태</SelectItem>
                <SelectItem value="submitted">접수 (수합대기)</SelectItem>
                <SelectItem value="pending">결재 진행 중</SelectItem>
                <SelectItem value="approved">승인 완료</SelectItem>
                <SelectItem value="rejected">반려됨</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="학생명, 기관명 검색"
                className="h-8 text-xs pl-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold"
              onClick={handleExportCsv}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              엑셀(CSV) 다운로드
            </Button>
          </div>
        </div>
      </Card>

      {/* 관리대장 목록 테이블 */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/50 text-[11px] font-bold border-b text-slate-700">
              <tr>
                <th className="p-2.5 text-center w-12">구분</th>
                <th className="p-2.5 w-32">학생명/인원</th>
                <th className="p-2.5 w-20 text-center">학년/반</th>
                <th className="p-2.5">기관명 및 장소</th>
                <th className="p-2.5 w-36">활동 기간</th>
                <th className="p-2.5 text-center w-16">시간</th>
                <th className="p-2.5 text-center w-20">결재상태</th>
                <th className="p-2.5 text-center w-20">확인서</th>
                <th className="p-2.5 text-center w-24">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {loadingDocs ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    조건에 일치하는 봉사활동 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDocs.map(d => {
                  const v = (d.volunteerFormData || d.parentFormData || {}) as any;
                  const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
                  const hasReport = Boolean(v.reportSubmitted || d.reportSubmitted);

                  return (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="p-2.5 text-center">
                        <Badge variant="outline" className={`text-[10px] ${isGroup ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                          {isGroup ? '단체' : '개인'}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-bold">
                        {isGroup
                          ? `${v.groupStudents?.[0]?.name || ''} 외 ${(v.groupStudents?.length || 1) - 1}명`
                          : (v.studentName || d.title)}
                      </td>
                      <td className="p-2.5 text-center text-muted-foreground">
                        {isGroup ? '단체' : (v.gradeClassNumber || `${v.grade || ''}-${v.classNum || ''}`)}
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold truncate max-w-[200px]">{v.institution || '미입력'}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{v.location || ''}</div>
                      </td>
                      <td className="p-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                        {v.period?.startDate} ~ {v.period?.endDate}
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        {v.period?.totalHours || 0}h
                      </td>
                      <td className="p-2.5 text-center">
                        {d.status === 'submitted' && <Badge variant="outline" className="bg-sky-50 text-sky-700 text-[10px]">접수</Badge>}
                        {d.status === 'pending' && <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">대기</Badge>}
                        {d.status === 'approved' && <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px]">승인</Badge>}
                        {d.status === 'rejected' && <Badge variant="outline" className="bg-red-50 text-red-700 text-[10px]">반려</Badge>}
                      </td>
                      <td className="p-2.5 text-center">
                        {hasReport ? (
                          <Badge className="bg-teal-600 text-white text-[10px]">완료</Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs font-bold"
                            onClick={() => router.push(`/documents/${d.id}`)}
                            title="문서 보기"
                          >
                            보기
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => setPreviewDoc(d)}
                            title="A4 인쇄"
                          >
                            인쇄
                          </Button>
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
    </TabsContent>
  );
}
