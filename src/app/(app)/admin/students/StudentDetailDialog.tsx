'use client';

import { Bus, Calendar, Edit3, GraduationCap, Plus, Search, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { linkMasterStudentSiblings, unlinkMasterStudentSibling } from '@/lib/services/masterStudentService';
import type { MasterStudent } from '@/lib/types/masterStudent';

/**
 * 학생 1인 4-in-1 통합 프로필 상세 모달 (학학년도 아카이브 누적 조회 지원).
 *
 * admin/students/page.tsx의 Dialog(isDetailDialogOpen) 블록을 그대로
 * 옮긴 것으로, selectedStudent 등 상태와 수정/삭제/전학 처리 로직은
 * 전부 부모(page.tsx)에 남아 있고 이 컴포넌트는 순수하게 마크업만
 * 담당한다 (동작 변경 없음).
 */
export interface StudentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudent: MasterStudent;
  selectedAcademicYear: number;
  setSelectedAcademicYear: (year: number) => void;
  currentSiblings: MasterStudent[];
  siblingCandidates: MasterStudent[];
  siblingSearchQuery: string;
  setSiblingSearchQuery: (value: string) => void;
  onEditStudent: (student: MasterStudent) => void;
  onDeleteStudent: (student: MasterStudent) => void;
  onPurgeStudent: (student: MasterStudent) => void;
}

export function StudentDetailDialog({
  open,
  onOpenChange,
  selectedStudent,
  selectedAcademicYear,
  setSelectedAcademicYear,
  currentSiblings,
  siblingCandidates,
  siblingSearchQuery,
  setSiblingSearchQuery,
  onEditStudent,
  onDeleteStudent,
  onPurgeStudent,
}: StudentDetailDialogProps) {
  const { toast } = useToast();

  const currentYearNum = new Date().getFullYear();
  const historyList = selectedStudent.academicHistory || [];
  const selectedHist = historyList.find(h => h.academicYear === selectedAcademicYear);

  const displayGradeStr = selectedHist ? selectedHist.grade : selectedStudent.grade;
  const displayClassStr = selectedHist ? selectedHist.classNum : selectedStudent.classNum;
  const displayNumStr = selectedHist ? selectedHist.studentNum : selectedStudent.studentNum;
  const isArchivedYear = selectedAcademicYear !== currentYearNum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="rounded-2xl border-2 border-indigo-200 shadow-sm shrink-0 bg-white" style={{ width: '2cm', height: '2cm' }}>
                {selectedStudent.photoUrl ? (
                  <AvatarImage src={selectedStudent.photoUrl} alt={selectedStudent.name} className="object-cover rounded-2xl" />
                ) : (
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 font-extrabold text-sm rounded-2xl">
                    {selectedStudent.name.slice(0, 2)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>{selectedStudent.name} 학생 통합 마스터 프로필</span>
                  <Badge className="bg-indigo-600 text-white text-xs font-bold">
                    {displayGradeStr}학년 {displayClassStr}반 {displayNumStr ? `${displayNumStr}번` : ''}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                  계정 ID: {selectedStudent.studentEmail}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => onEditStudent(selectedStudent)} className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <Edit3 className="mr-1 h-3.5 w-3.5" /> 정보 수정
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDeleteStudent(selectedStudent)} className="h-8 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50" title="실수 삭제 복구 가능 (휴지통 보관)">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> 삭제(휴지통)
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPurgeStudent(selectedStudent)} className="h-8 text-xs font-bold border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400" title="전학/자퇴: 스쿨버스 좌석 반환, 방과후 취소, 계정 영구 삭제">
                전학 처리
              </Button>
            </div>
          </div>

          {/* 학학년도 선택 셀렉터 바 - 누적 이력 아카이브 뷰어 */}
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-3 rounded-xl mt-3 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-indigo-200 whitespace-nowrap">📅 조회 학학년도 선택:</span>
                <Select value={String(selectedAcademicYear)} onValueChange={(val) => setSelectedAcademicYear(parseInt(val, 10))}>
                  <SelectTrigger className="h-8 text-xs bg-white text-slate-900 font-bold border-0 w-60 shadow-xs focus:ring-2 focus:ring-amber-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value={String(currentYearNum)} className="text-xs font-bold text-indigo-950">
                      {currentYearNum}학년도 ({selectedStudent.grade}학년 - 현재 학학년도)
                    </SelectItem>
                    {historyList.map(h => (
                      <SelectItem key={h.academicYear} value={String(h.academicYear)} className="text-xs font-semibold text-slate-800">
                        {h.academicYear}학년도 ({h.grade}학년 {h.classNum}반 - 아카이브 기록)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isArchivedYear ? (
                <Badge className="bg-amber-400 text-amber-950 font-black text-xs px-2.5 py-0.5 shadow-xs">
                  {selectedAcademicYear}학년도 과거 아카이브 데이터 세트 조회 중
                </Badge>
              ) : (
                <Badge className="bg-indigo-700/80 text-indigo-100 font-bold text-[11px] px-2 py-0.5">
                  {currentYearNum}학년도 현재 학적 기준
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-indigo-200/90 font-medium">
              💡 <strong>과거 학년도 기록 조회 방법</strong>: 상단 드롭다운에서 원하는 학학년도를 선택하면, 해당 학년도 당시의 <strong>[출결 서류], [교외체험학습 승인서], [방과후 수강이력], [스쿨버스 지정 노선]</strong>이 그대로 전환되어 조회됩니다.
            </p>
          </div>
        </DialogHeader>

        {/* 5개 탭 메인 메뉴 */}
        <Tabs defaultValue="profile" className="w-full mt-3">
          <TabsList className="grid grid-cols-5 w-full bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="profile" className="text-xs font-bold whitespace-nowrap">기본 인적사항</TabsTrigger>
            <TabsTrigger value="afterschool" className="text-xs font-bold whitespace-nowrap">방과후 & 청구</TabsTrigger>
            <TabsTrigger value="bus" className="text-xs font-bold whitespace-nowrap">스쿨버스 노선</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs font-bold whitespace-nowrap">출결 & 체험학습</TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-bold whitespace-nowrap text-purple-700">과거 학적 이력 ({historyList.length})</TabsTrigger>
          </TabsList>

          {/* Tab 1: 기본 인적사항 */}
          <TabsContent value="profile" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">학생 이메일 계정 (학부모 겸용 고유 ID)</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{selectedStudent.studentEmail}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">보호자 연락처</span>
                <span className="font-bold text-slate-800 text-sm">{selectedStudent.contact || '미등록'}</span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                <span className="text-indigo-700 block mb-1 font-semibold">현재 선택된 학학년도 학적</span>
                <span className="font-bold text-indigo-950 text-sm">
                  {selectedAcademicYear}학년도 ({displayGradeStr}학년 {displayClassStr}반 {displayNumStr ? `${displayNumStr}번` : ''})
                  {isArchivedYear && <span className="ml-1.5 text-xs text-amber-700 font-bold">(아카이브 기록)</span>}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-1">성별 / 승차권 카드 번호</span>
                <span className="font-bold text-slate-800">
                  {selectedStudent.gender === 'Male' ? '남성' : '여성'} {selectedStudent.kisbusNo ? `(카드: ${selectedStudent.kisbusNo})` : ''}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 block mb-1">등하교 목적지</span>
              <span className="font-medium text-slate-800">{selectedStudent.address || '등록된 목적지 정보가 없습니다.'}</span>
            </div>

            {/* 형제·자매 (가족) 연결 관리 */}
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-purple-950 flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-purple-700" /> 형제·자매 연결 관리 (스쿨버스 자동 연동)
                </h5>
                {currentSiblings.length > 0 && (
                  <Badge className="bg-purple-600 text-white font-bold text-[10px]">
                    {currentSiblings.length + 1}남매 (가족 연결됨)
                  </Badge>
                )}
              </div>

              {/* 연결된 형제자매 목록 */}
              {currentSiblings.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-slate-500 text-[11px] font-semibold block">현재 연결된 형제·자매:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentSiblings.map(sib => (
                      <div key={sib.studentId || sib.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-purple-200/80 shadow-xs">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 rounded-full bg-purple-100 text-purple-800 text-xs font-bold shrink-0">
                            <AvatarFallback>{sib.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{sib.name}</span>
                            <span className="text-[10px] text-muted-foreground">{sib.grade}학년 {sib.classNum}반 · {sib.contact}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (!confirm(`${sib.name} 학생과의 형제자매 연결을 해제하시겠습니까?`)) return;
                            try {
                              await unlinkMasterStudentSibling(sib.studentId || sib.id!);
                              toast({ title: "형제자매 연결 해제 완료" });
                            } catch (e) {
                              toast({ title: "해제 실패", variant: "destructive" });
                            }
                          }}
                        >
                          연결 해제
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-[11px]">
                  현재 연결된 형제·자매가 없습니다. 아래에서 학생을 검색하여 가족으로 연결하세요.
                </p>
              )}

              {/* 형제자매 검색 및 추가 폼 */}
              <div className="pt-2 border-t border-purple-200/60 space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="연결할 형제·자매 학생 이름 또는 이메일 검색..."
                    value={siblingSearchQuery}
                    onChange={(e) => setSiblingSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-white"
                  />
                </div>

                {siblingCandidates.length > 0 && (
                  <div className="bg-white border border-purple-200 rounded-lg p-1 space-y-1 shadow-md">
                    {siblingCandidates.map(cand => (
                      <div
                        key={cand.studentId || cand.id}
                        className="flex items-center justify-between p-2 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                        onClick={async () => {
                          try {
                            await linkMasterStudentSiblings([selectedStudent.studentId || selectedStudent.id!, cand.studentId || cand.id!]);
                            setSiblingSearchQuery('');
                            toast({ title: "형제자매 연결 완료", description: `${cand.name} 학생과 가족으로 연결되었습니다.` });
                          } catch (e: any) {
                            toast({ title: "연결 실패", description: e.message, variant: "destructive" });
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{cand.name}</span>
                          <span className="text-[10px] text-muted-foreground">{cand.grade}학년 {cand.classNum}반 · {cand.studentEmail}</span>
                        </div>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-purple-700 border-purple-300">
                          <Plus className="w-3 h-3 mr-1" /> 연결하기
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: 방과후 수강 & 청구 현황 */}
          <TabsContent value="afterschool" className="space-y-3 pt-4">
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2">
              <h5 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                <GraduationCap className="h-4 w-4" /> 방과후 수강 및 납부 요약
              </h5>
              <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                <span className="text-slate-600">수강 중인 강좌 수:</span>
                <span className="font-bold text-emerald-800">{selectedStudent.afterschoolSummary?.enrolledCourseIds?.length || 0}개 강좌</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">총 청구 수강료:</span>
                <span className="font-black text-emerald-900 text-sm">
                  {(selectedStudent.afterschoolSummary?.totalTuition || 0).toLocaleString()}원
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: 스쿨버스 노선 & 목적지 */}
          <TabsContent value="bus" className="space-y-3 pt-4">
            <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-xs space-y-2">
              <h5 className="font-bold text-sky-900 flex items-center gap-1.5 text-sm">
                <Bus className="h-4 w-4" /> 등하교 버스 노선 및 목적지 정보
              </h5>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-white/80 p-2.5 rounded-lg border border-sky-100">
                  <span className="text-slate-500 block">배정된 스쿨버스</span>
                  <span className="font-bold text-sky-900">{selectedStudent.busSummary?.assignedBusName || '자가 귀가'}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-sky-100">
                  <span className="text-slate-500 block">좌석 번호</span>
                  <span className="font-bold text-sky-900">{selectedStudent.busSummary?.assignedSeatNumber ? `${selectedStudent.busSummary.assignedSeatNumber}번` : '미배정'}</span>
                </div>
                <div className="col-span-2 bg-white/80 p-2.5 rounded-lg border border-sky-100">
                  <span className="text-slate-500 block">등/하교 목적지 정류장 (거주지 연동)</span>
                  <span className="font-bold text-sky-900">{selectedStudent.address || selectedStudent.busSummary?.morningDestinationId || '미등록'}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 4: 출결 & 체험학습 */}
          <TabsContent value="attendance" className="space-y-3 pt-4">
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-2">
              <h5 className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                <Calendar className="h-4 w-4" /> 출결 및 체험학습 서류 요약
              </h5>
              <p className="text-slate-600">
                누적 결석/지각 기록 및 체험학습 승인 서류가 이 계정과 통합 동기화되어 관리됩니다.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
