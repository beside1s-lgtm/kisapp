'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  saveSportsClub,
  deleteSportsClub,
  updateSportsClub,
} from '@/lib/services/peService';
import type { Student, SportsClub } from '@/lib/pe/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Trash2,
  Users2,
  Save,
  Loader2,
  X,
  Search,
  UserPlus,
  UserMinus,
  Check,
  UserCheck,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SportsClubManagementProps {
  allStudents: Student[];
  sportsClubs: SportsClub[];
  onClubUpdate: () => void;
}

export default function SportsClubManagement({
  allStudents,
  sportsClubs,
  onClubUpdate,
}: SportsClubManagementProps) {
  const { user } = useAuth();
  const school = 'KISH';
  const { toast } = useToast();
  const [selectedClub, setSelectedClub] = useState<SportsClub | null>(null);
  const [clubName, setClubName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedStudents, setSearchedStudents] = useState<Student[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (selectedClub) {
      setClubName(selectedClub.name);
      setSelectedStudentIds(new Set(selectedClub.memberIds || []));
    } else {
      setClubName('');
      setSelectedStudentIds(new Set());
    }
    // 클럽 전환 시 검색 상태 초기화
    setSearchTerm('');
    setSearchedStudents([]);
    setHasSearched(false);
  }, [selectedClub]);

  const handleSelectClub = (club: SportsClub | null) => {
    setSelectedClub(club);
  };

  // 현재 클럽에 소속된 멤버 목록 (정렬: 학년 > 반 > 번호 > 이름)
  const currentMembers = useMemo(() => {
    return allStudents
      .filter((student) => selectedStudentIds.has(student.id))
      .sort((a, b) => {
        const gDiff = (Number(a.grade) || 0) - (Number(b.grade) || 0);
        if (gDiff !== 0) return gDiff;
        const cDiff = (Number(a.classNum) || 0) - (Number(b.classNum) || 0);
        if (cDiff !== 0) return cDiff;
        const nA = Number(a.studentNum) || 0;
        const nB = Number(b.studentNum) || 0;
        if (nA !== nB) return nA - nB;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [allStudents, selectedStudentIds]);

  // 학생 검색 실행
  const handleSearch = () => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      setSearchedStudents([]);
      setHasSearched(false);
      return;
    }

    const filtered = allStudents.filter((student) => {
      const nameMatch = student.name.toLowerCase().includes(query);
      const gradeClassMatch = `${student.grade}-${student.classNum}`.includes(query);
      return nameMatch || gradeClassMatch;
    });

    setSearchedStudents(filtered);
    setHasSearched(true);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchedStudents([]);
    setHasSearched(false);
  };

  const handleAddStudent = (student: Student) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.add(student.id);
      return next;
    });
    toast({
      title: '멤버 추가 완료',
      description: `${student.name} 학생이 클럽 멤버로 추가되었습니다.`,
    });
  };

  const handleRemoveStudent = (student: Student) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(student.id);
      return next;
    });
    toast({
      title: '멤버 제외 완료',
      description: `${student.name} 학생이 클럽 멤버에서 제외되었습니다.`,
    });
  };

  const handleSaveClub = async () => {
    if (!school || !clubName.trim()) {
      toast({
        variant: 'destructive',
        title: '클럽 이름을 입력해주세요.',
      });
      return;
    }
    setIsProcessing(true);
    try {
      const memberIds = Array.from(selectedStudentIds);
      if (selectedClub) {
        await updateSportsClub(school, selectedClub.id, {
          name: clubName.trim(),
          memberIds,
        });
        toast({ title: '클럽 정보가 수정되었습니다.' });
      } else {
        await saveSportsClub(school, clubName.trim(), memberIds);
        toast({ title: '새로운 스포츠 클럽이 생성되었습니다.' });
      }
      onClubUpdate();
      handleSelectClub(null);
    } catch (error) {
      console.error('Failed to save sports club:', error);
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: '클럽 정보 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClub = async () => {
    if (!school || !selectedClub) return;
    setIsProcessing(true);
    try {
      await deleteSportsClub(school, selectedClub.id);
      toast({ title: '클럽이 삭제되었습니다.' });
      onClubUpdate();
      handleSelectClub(null);
    } catch (error) {
      console.error('Failed to delete sports club:', error);
      toast({ variant: 'destructive', title: '삭제 실패' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader className="px-0 pt-0 pb-3">
        <CardTitle className="text-xl">스포츠 클럽 관리</CardTitle>
        <CardDescription>
          여러 반의 학생들을 모아 스포츠 클럽을 만들고 관리합니다. 생성된 클럽은
          '학생별 분석' 탭에서 학급처럼 선택하여 분석할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 좌측: 클럽 목록 */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>클럽 목록</span>
                <Badge variant="outline" className="font-normal text-xs">
                  총 {sportsClubs.length}개
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <Button
                className="w-full h-9 justify-center"
                variant={selectedClub === null ? 'default' : 'outline'}
                onClick={() => handleSelectClub(null)}
              >
                <Plus className="mr-2 h-4 w-4" /> 새 클럽 만들기
              </Button>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {sportsClubs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    등록된 스포츠 클럽이 없습니다.
                  </div>
                ) : (
                  sportsClubs.map((club) => {
                    const isSelected = selectedClub?.id === club.id;
                    const memberCount = club.memberIds?.length || 0;
                    return (
                      <Button
                        key={club.id}
                        variant={isSelected ? 'secondary' : 'ghost'}
                        className={`w-full justify-between h-9 px-3 text-sm ${
                          isSelected ? 'font-semibold border border-primary/20 bg-primary/10' : ''
                        }`}
                        onClick={() => handleSelectClub(club)}
                      >
                        <span className="flex items-center truncate mr-2">
                          <Users2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{club.name}</span>
                        </span>
                        <Badge
                          variant={isSelected ? 'default' : 'secondary'}
                          className="text-[11px] px-1.5 py-0 shrink-0 font-normal"
                        >
                          {memberCount}명
                        </Badge>
                      </Button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: 새 클럽 만들기 또는 클럽 수정 */}
        <div className="md:col-span-2">
          <Card className="border shadow-sm">
            {/* 캡처 이미지의 상단 우측 빨간 박스 위치: 클럽 저장 및 삭제 버튼 */}
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>{selectedClub ? '클럽 수정' : '새 클럽 만들기'}</span>
                  {selectedClub && (
                    <Badge variant="outline" className="text-xs font-normal">
                      ID: {selectedClub.name}
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {selectedClub && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                        disabled={isProcessing}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        클럽 삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          정말로 이 클럽을 삭제하시겠습니까?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          이 작업은 되돌릴 수 없습니다. 클럽 정보만 삭제되며,
                          학생들의 측정 기록 데이터는 보존됩니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteClub}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  size="sm"
                  className="h-8 text-xs px-3 shadow-sm"
                  onClick={handleSaveClub}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {selectedClub ? '변경사항 저장' : '클럽 저장'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* 1. 클럽 이름 입력 */}
              <div className="space-y-1.5">
                <Label htmlFor="club-name" className="text-xs font-medium">
                  클럽 이름
                </Label>
                <Input
                  id="club-name"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="예: 축구 대표팀"
                  className="h-9 text-sm"
                />
              </div>

              {/* 2. 추가할 학생 검색 및 멤버 추가 영역 */}
              <div className="space-y-2 p-3 bg-muted/30 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    새 멤버 추가 (학생 검색)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    학생 이름을 검색하여 [+ 추가] 버튼을 누르세요
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="추가할 학생 이름으로 검색..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!e.target.value.trim()) {
                          setSearchedStudents([]);
                          setHasSearched(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                      className="pl-8 h-9 text-sm bg-background"
                    />
                    {searchTerm && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={handleClearSearch}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-3 shrink-0"
                    onClick={handleSearch}
                  >
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    검색
                  </Button>
                </div>

                {/* 검색 결과 표시 영역 */}
                {hasSearched && (
                  <div className="border rounded-md bg-background overflow-hidden mt-2">
                    <div className="px-3 py-1.5 bg-muted/60 text-[11px] font-medium text-muted-foreground border-b flex justify-between items-center">
                      <span>검색 결과: {searchedStudents.length}명</span>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >
                        결과 닫기
                      </button>
                    </div>
                    {searchedStudents.length === 0 ? (
                      <div className="text-center py-5 text-xs text-muted-foreground">
                        '{searchTerm}' 학생을 찾을 수 없습니다.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y">
                        {searchedStudents.map((student) => {
                          const isAlreadyMember = selectedStudentIds.has(student.id);
                          return (
                            <div
                              key={student.id}
                              className="px-3 py-2 flex items-center justify-between hover:bg-muted/40 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-foreground">
                                  {student.name}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
                                  {student.grade}학년 {student.classNum}반{' '}
                                  {student.studentNum ? `${student.studentNum}번` : ''}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                                  {student.gender}
                                </Badge>
                              </div>
                              <div>
                                {isAlreadyMember ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-[11px] font-normal text-muted-foreground bg-muted"
                                  >
                                    <Check className="mr-1 h-3 w-3 text-emerald-600" />
                                    소속됨
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2.5 border-primary/40 text-primary hover:bg-primary/10"
                                    onClick={() => handleAddStudent(student)}
                                  >
                                    <UserPlus className="mr-1 h-3 w-3" />
                                    멤버 추가
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. 현재 클럽 멤버 명단 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    클럽 멤버 명단
                  </Label>
                  <span className="text-xs font-semibold text-primary">
                    총 {currentMembers.length}명
                  </span>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/90 z-10">
                        <TableRow className="h-8">
                          <TableHead className="w-16 text-center text-xs py-1">학년</TableHead>
                          <TableHead className="w-16 text-center text-xs py-1">반</TableHead>
                          <TableHead className="w-16 text-center text-xs py-1">번호</TableHead>
                          <TableHead className="text-xs py-1">이름</TableHead>
                          <TableHead className="w-16 text-center text-xs py-1">성별</TableHead>
                          <TableHead className="w-20 text-center text-xs py-1">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentMembers.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-8 text-xs text-muted-foreground"
                            >
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <Users2 className="h-6 w-6 text-muted-foreground/50" />
                                <span>소속된 멤버가 없습니다.</span>
                                <span className="text-[11px]">
                                  위의 검색창에서 학생 이름을 검색하여 멤버를 추가해주세요.
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          currentMembers.map((student) => (
                            <TableRow key={student.id} className="h-9 hover:bg-muted/40">
                              <TableCell className="text-center text-xs py-1 font-medium">
                                {student.grade}
                              </TableCell>
                              <TableCell className="text-center text-xs py-1 font-medium">
                                {student.classNum}
                              </TableCell>
                              <TableCell className="text-center text-xs py-1 text-muted-foreground">
                                {student.studentNum || '-'}
                              </TableCell>
                              <TableCell className="text-xs py-1 font-semibold text-foreground">
                                {student.name}
                              </TableCell>
                              <TableCell className="text-center text-xs py-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] py-0 px-1 font-normal ${
                                    student.gender === '남'
                                      ? 'border-blue-200 text-blue-700 bg-blue-50/50 dark:bg-blue-950/30'
                                      : 'border-rose-200 text-rose-700 bg-rose-50/50 dark:bg-rose-950/30'
                                  }`}
                                >
                                  {student.gender}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-xs py-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveStudent(student)}
                                >
                                  <UserMinus className="mr-1 h-3 w-3" />
                                  제외
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* 하단 보조 액션 바 */}
              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>선택된 멤버: {currentMembers.length}명</span>
                <Button
                  size="sm"
                  className="h-8 text-xs px-4"
                  onClick={handleSaveClub}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {selectedClub ? '변경사항 저장' : '클럽 생성'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
