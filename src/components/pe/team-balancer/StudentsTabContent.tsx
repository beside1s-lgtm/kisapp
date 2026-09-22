'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import type { Student } from '@/lib/pe/types';

interface Candidate {
  student: Student;
  score?: { totalScore: number; scores: { item: string; score: number }[] };
}

export function StudentsTabContent({
  studentSearchTerm,
  setStudentSearchTerm,
  candidateList,
  filteredCandidates,
  handleGetScoutingReport,
}: {
  studentSearchTerm: string;
  setStudentSearchTerm: (val: string) => void;
  candidateList: Candidate[];
  filteredCandidates: Candidate[];
  handleGetScoutingReport: (student: Student) => void;
}) {
  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden p-2 space-y-1.5">
      {/* 상단 검색 & 카운터 바 */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-white rounded-lg border border-slate-200 shrink-0">
        <div className="relative flex-1 max-w-[200px]">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            id="input-student-search"
            placeholder="학생 이름 검색..."
            value={studentSearchTerm}
            onChange={(e) => setStudentSearchTerm(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] font-bold text-slate-700">
            전체 {candidateList.length}명
          </Badge>
        </div>
      </div>

      {/* 학생 목록 테이블 (화면 꽉 차게 내부 스크롤) */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-y-auto overscroll-contain">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow className="h-7">
              <TableHead className="w-10 text-center text-[10px] font-black p-1">순위</TableHead>
              <TableHead className="text-[10px] font-black p-1">이름</TableHead>
              <TableHead className="text-[10px] font-black p-1 text-center">반</TableHead>
              <TableHead className="text-[10px] font-black p-1 text-center">성별</TableHead>
              <TableHead className="text-[10px] font-black p-1 text-center">능력치</TableHead>
              <TableHead className="w-12 text-right text-[10px] font-black p-1 pr-2">AI분석</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.map((c, idx) => {
              const score = c.score?.totalScore || 0;
              return (
                <TableRow key={c.student.id} className="h-8 hover:bg-indigo-50/50">
                  <TableCell className="text-center font-bold text-[10px] text-slate-400 p-1">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-bold text-xs p-1 text-slate-900">
                    {c.student.name}
                  </TableCell>
                  <TableCell className="text-center text-[11px] p-1 text-slate-600">
                    {c.student.grade}-{c.student.classNum}
                  </TableCell>
                  <TableCell className="text-center text-[10px] p-1 text-slate-500">
                    {c.student.gender}
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <Badge
                      variant={score >= 80 ? 'default' : score >= 50 ? 'secondary' : 'outline'}
                      className="font-black text-[10px] px-1.5 py-0 h-4.5"
                    >
                      {score}점
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right p-1 pr-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-indigo-600 hover:bg-indigo-50 btn-ai-scouting"
                      onClick={() => handleGetScoutingReport(c.student)}
                      title="AI 스카우팅 리포트"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
