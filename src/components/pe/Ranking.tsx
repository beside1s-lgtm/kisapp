
"use client";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { calculateRanks } from '@/lib/services/peService';
import { Student, MeasurementItem, MeasurementRecord, SportsClub } from '@/lib/pe/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crown, Medal, Trophy } from "lucide-react";

type RankedStudent = {
  rank: number;
  id: string;
  name: string;
  grade: string;
  classNum: string;
  studentNum: string;
  value: string;
};

interface RankingProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  sportsClubs: SportsClub[];
}

function HallOfFame({ allItems, allRecords, allStudents, sportsClubs }: RankingProps) {
  const { user } = useAuth(); const school = 'KISH';
  const [hofGrade, setHofGrade] = useState<string>("all");
  
  const grades = useMemo(() => 
    [...new Set(allStudents.map(s => String(s.grade || '')).filter(Boolean))].sort((a, b) => parseInt(a) - parseInt(b)),
    [allStudents]
  );

  const hallOfFameData = useMemo(() => {
    if (!school) return [];
    
    const measurementWeekItems = allItems.filter(item => item.isMeasurementWeek && !item.isArchived && !item.isDeactivated);
    if (measurementWeekItems.length === 0) return [];
    
    // 클럽 또는 학년 필터 적용
    let studentsToRank = allStudents;
    if (hofGrade !== 'all') {
      studentsToRank = allStudents.filter(s => s.grade === hofGrade);
    }
    
    const allRanks = calculateRanks(school, allItems, allRecords, studentsToRank);
    const studentMap = new Map(allStudents.map(s => [s.id, s]));

    return measurementWeekItems.map(item => {
      const itemRanks = allRanks[item.name] || [];
      const top3 = itemRanks.slice(0, 3).map((rankInfo: any) => {
        const student = studentMap.get(rankInfo.studentId);
        return {
          rank: rankInfo.rank,
          name: student?.name || '알 수 없음',
          value: `${rankInfo.value}${item.unit}`,
          grade: student?.grade,
          classNum: student?.classNum
        };
      });
      return { itemName: item.name, topStudents: top3 };
    });

  }, [allItems, allRecords, allStudents, school, hofGrade]);

  if (hallOfFameData.length === 0) {
    return (
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Trophy />
            명예의 전당
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            '종목 관리' 탭에서 측정 주간으로 설정된 종목이 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-amber-50/80 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 backdrop-blur-sm shadow-sm overflow-hidden">
       <CardHeader className="bg-amber-100/50 pb-4 border-b border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-400 font-black">
              <Trophy className="text-amber-600" />
              우리 학교 명예의 전당
            </CardTitle>
            <CardDescription className="text-amber-800 font-bold opacity-90">
              {hofGrade === 'all' ? '전체 학년' : `${hofGrade}학년`} 1~3위 학생입니다.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/20 p-1.5 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm">
            <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 px-2 uppercase tracking-widest shrink-0">필터</span>
            <Select value={hofGrade} onValueChange={setHofGrade}>
              <SelectTrigger className="w-[120px] h-8 bg-transparent border-none shadow-none focus:ring-0 font-bold text-amber-900 dark:text-amber-200">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">전체 학년</SelectItem>
                {grades.map(g => (
                  <SelectItem key={g} value={g} className="font-bold">{g}학년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
            {hallOfFameData.map(({ itemName, topStudents }) => (
                <div key={itemName} className="p-4 rounded-lg bg-background border border-amber-100 dark:border-amber-800 shadow-sm flex flex-col gap-3">
                    <div className="bg-amber-100 dark:bg-amber-900/50 self-center px-3 py-1 rounded-full text-amber-900 dark:text-amber-200 font-black text-sm">
                      {itemName}
                    </div>
                    {topStudents.length > 0 ? (
                        <ul className="space-y-2">
                            {topStudents.map((student: any, index: number) => (
                                <li key={index} className="flex items-center justify-between text-sm p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                                    <div className="flex flex-col">
                                      <span className="flex items-center font-bold">
                                          {index === 0 && <Crown className="w-4 h-4 text-yellow-500 mr-1.5"/>}
                                          {index === 1 && <Medal className="w-4 h-4 text-slate-400 mr-1.5"/>}
                                          {index === 2 && <Trophy className="w-4 h-4 text-amber-600 mr-1.5"/>}
                                          {index + 1}위 {student.name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground ml-5">{student.grade}학년 {student.classNum}반</span>
                                    </div>
                                    <span className="font-black text-primary">{student.value}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                       <p className="text-xs text-center text-muted-foreground py-4">기록이 없습니다.</p>
                    )}
                </div>
            ))}
        </CardContent>
    </Card>
  )
}

export default function Ranking({
  allStudents,
  allItems,
  allRecords,
  sportsClubs,
}: RankingProps) {
  const { user } = useAuth(); const school = 'KISH';

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("all");
  const [selectedItem, setSelectedItem] = useState("");
  const [rankedStudents, setRankedStudents] = useState<RankedStudent[]>([]);

  const grades = useMemo(
    () => [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a)-parseInt(b)),
    [allStudents]
  );
  
  // Filter for active items only
  const activeItems = useMemo(() => allItems.filter(item => !item.isArchived && !item.isDeactivated), [allItems]);


  useEffect(() => {
    if (school && (selectedGrade || selectedClubId !== 'all') && selectedItem) {
      let filteredStudents = allStudents;
      if (selectedClubId !== 'all') {
        const club = sportsClubs.find(c => c.id === selectedClubId);
        if (club) filteredStudents = allStudents.filter(s => club.memberIds.includes(s.id));
      } else {
        filteredStudents = allStudents.filter(s => s.grade === selectedGrade);
      }

      const ranksByItem = calculateRanks(
        school,
        allItems,
        allRecords,
        filteredStudents
      );
      const itemRanks = ranksByItem[selectedItem];
      const itemInfo = allItems.find((i) => i.name === selectedItem);

      if (itemRanks && itemInfo) {
        const studentMap = new Map(allStudents.map((s) => [s.id, s]));
        const sortedRankedStudents = itemRanks
          .map((rankInfo: any) => {
            const student = studentMap.get(rankInfo.studentId);
            if (!student) return null;
            return {
              rank: rankInfo.rank,
              id: student.id,
              name: student.name,
              grade: student.grade,
              classNum: student.classNum,
              studentNum: student.studentNum,
              value:
                itemInfo.recordType === "level"
                  ? rankInfo.value === 1
                    ? "상"
                    : rankInfo.value === 2
                    ? "중"
                    : "하"
                  : `${rankInfo.value}${itemInfo.unit}`,
            };
          })
          .filter((s: any): s is RankedStudent => s !== null);

        setRankedStudents(sortedRankedStudents);
      } else {
        setRankedStudents([]);
      }
    } else {
      setRankedStudents([]);
    }
  }, [school, selectedGrade, selectedItem, allStudents, allItems, allRecords]);

  if (!school) return null;

  return (
    <div className="space-y-6">
      <HallOfFame allItems={allItems} allRecords={allRecords} allStudents={allStudents} sportsClubs={sportsClubs} />
      <Card className="bg-transparent shadow-none border-none">
        <CardHeader>
          <CardTitle>종목별 순위 조회</CardTitle>
          <CardDescription>
            학년과 종목을 선택하여 전체 학생 순위를 확인합니다. 종목별 우수
            학생과 부진 학생을 쉽게 파악할 수 있습니다.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <Select value={selectedClubId} onValueChange={v => { setSelectedClubId(v); if(v !== 'all') setSelectedGrade(''); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="클럽 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 클럽</SelectItem>
                {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); if(v !== '') setSelectedClubId('all'); }}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}학년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedItem}
              onValueChange={setSelectedItem}
              disabled={!selectedGrade}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="종목 선택" />
              </SelectTrigger>
              <SelectContent>
                {activeItems.map((item) => (
                  <SelectItem key={item.id} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>등수</TableHead>
                <TableHead>학년</TableHead>
                <TableHead>반</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>기록</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedStudents.length > 0 ? (
                rankedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-bold">{student.rank}등</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell>{student.classNum}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.value}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    조회할 학년과 종목을 선택해주세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
