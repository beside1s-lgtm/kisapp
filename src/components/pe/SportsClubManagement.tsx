'use client';
import { useState, useEffect } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Trash2,
  Users2,
  Save,
  Loader2,
  X,
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
} from "@/components/ui/alert-dialog"

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
  const { user } = useAuth(); const school = 'KISH';
  const { toast } = useToast();
  const [selectedClub, setSelectedClub] = useState<SportsClub | null>(null);
  const [clubName, setClubName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedClub) {
      setClubName(selectedClub.name);
      setSelectedStudentIds(new Set(selectedClub.memberIds));
    }
  }, [selectedClub]);

  const handleSelectClub = (club: SportsClub | null) => {
    setSelectedClub(club);
    if (club) {
      setClubName(club.name);
      setSelectedStudentIds(new Set(club.memberIds));
    } else {
      setClubName('');
      setSelectedStudentIds(new Set());
    }
  };

  const handleToggleStudent = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(studentId);
      } else {
        newSet.delete(studentId);
      }
      return newSet;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
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
        // Update existing club
        await updateSportsClub(school, selectedClub.id, { name: clubName, memberIds });
        toast({ title: '클럽 정보가 수정되었습니다.' });
      } else {
        // Create new club
        await saveSportsClub(school, clubName, memberIds);
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
  
  const filteredStudents = allStudents.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>스포츠 클럽 관리</CardTitle>
        <CardDescription>
          여러 반의 학생들을 모아 스포츠 클럽을 만들고 관리합니다. 생성된 클럽은
          '학생별 분석' 탭에서 학급처럼 선택하여 분석할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>클럽 목록</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full mb-4"
                onClick={() => handleSelectClub(null)}
              >
                <Plus className="mr-2 h-4 w-4" /> 새 클럽 만들기
              </Button>
              <div className="space-y-2">
                {sportsClubs.map((club) => (
                  <Button
                    key={club.id}
                    variant={
                      selectedClub?.id === club.id ? 'secondary' : 'ghost'
                    }
                    className="w-full justify-start"
                    onClick={() => handleSelectClub(club)}
                  >
                    <Users2 className="mr-2 h-4 w-4" />
                    {club.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedClub ? '클럽 수정' : '새 클럽 만들기'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="club-name">클럽 이름</Label>
                <Input
                  id="club-name"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="예: 축구 대표팀"
                />
              </div>
              <div className="space-y-2">
                <Label>클럽 멤버 선택</Label>
                <div className='flex items-center gap-2'>
                    <Input
                        type="text"
                        placeholder="학생 이름으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && <Button size="icon" variant="ghost" onClick={() => setSearchTerm('')}><X className="h-4 w-4"/></Button>}
                </div>
                <div className="border rounded-md h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                            onCheckedChange={handleToggleAll}
                          />
                        </TableHead>
                        <TableHead>학년</TableHead>
                        <TableHead>반</TableHead>
                        <TableHead>이름</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow
                          key={student.id}
                          onClick={() => handleToggleStudent(student.id, !selectedStudentIds.has(student.id))}
                          className="cursor-pointer"
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedStudentIds.has(student.id)}
                              onCheckedChange={(checked) => handleToggleStudent(student.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell>{student.grade}</TableCell>
                          <TableCell>{student.classNum}</TableCell>
                          <TableCell>{student.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-sm text-muted-foreground">
                  총 {selectedStudentIds.size}명 선택됨
                </div>
              </div>
              <div className="flex justify-between">
                <div>
                    {selectedClub && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isProcessing}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    클럽 삭제
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>정말로 이 클럽을 삭제하시겠습니까?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        이 작업은 되돌릴 수 없습니다. 클럽 정보만 삭제되며, 학생 데이터는 유지됩니다.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteClub}>삭제</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
                <Button onClick={handleSaveClub} disabled={isProcessing}>
                  {isProcessing && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
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
