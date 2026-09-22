'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, FileDown, Plus, Trash2, Loader2 } from "lucide-react";
import type { SchoolHistoryEntry, PreSchoolImmunization, PostSchoolImmunization, HealthExam, OtherExam } from '@/lib/pe/types';

const IMMUNIZATION_DISEASES = [
  "디프테리아", "백일해", "파상풍", "홍역", "볼거리(유행성이하선염)", "풍진",
  "폴리오(소아마비)", "결핵", "일본뇌염", "수두", "B형 간염", "신종인플루엔자A(H1N1)", "기타"
];

export interface InputForm {
  residentRegistrationNumber: string;
  guardianName: string;
  bloodType: string;
  officialSchoolName: string;
  teacherName: string;
  schoolHistory: SchoolHistoryEntry[];
  preSchoolImmunizations: PreSchoolImmunization;
  postSchoolImmunizations: PostSchoolImmunization[];
  healthExams: Record<string, { general?: HealthExam; dental?: HealthExam }>;
  otherExams: OtherExam[];
}

export function InputTabContent({
  inputForm,
  setInputForm,
  generalInstitutions,
  dentalInstitutions,
  isUploading,
  handleDownloadExamTemplate,
  handleBulkExamUpload,
  handleSaveRecord,
}: {
  inputForm: InputForm;
  setInputForm: (form: InputForm) => void;
  generalInstitutions: string[];
  dentalInstitutions: string[];
  isUploading: boolean;
  handleDownloadExamTemplate: () => void;
  handleBulkExamUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveRecord: () => void;
}) {
  return (
    <TabsContent value="input" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 인적사항 */}
        <Card className="border border-border/70">
          <CardHeader className="bg-muted/10 pb-3 border-b">
            <CardTitle className="text-base font-bold text-foreground">인적사항 및 재학이력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>주민등록번호</Label>
                <Input
                  placeholder="주민번호"
                  value={inputForm.residentRegistrationNumber}
                  onChange={e => setInputForm({...inputForm, residentRegistrationNumber: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>보호자 성명</Label>
                <Input
                  placeholder="보호자명"
                  value={inputForm.guardianName}
                  onChange={e => setInputForm({...inputForm, guardianName: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>혈액형</Label>
                <Input
                  placeholder="예: A(+)"
                  value={inputForm.bloodType}
                  onChange={e => setInputForm({...inputForm, bloodType: e.target.value})}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>정식 재학학교명 (현재)</Label>
                <Input
                  value={inputForm.officialSchoolName}
                  onChange={e => setInputForm({...inputForm, officialSchoolName: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>담임교사명 (현재 학년)</Label>
              <Input
                value={inputForm.teacherName}
                onChange={e => setInputForm({...inputForm, teacherName: e.target.value})}
              />
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <Label className="font-bold">과거 재학이력 이력 (누적 관리)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInputForm({
                      ...inputForm,
                      schoolHistory: [...inputForm.schoolHistory, { schoolName: "", grade: "", classNum: "", studentNum: "", teacherName: "" }]
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> 추가
                </Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead>학교명</TableHead>
                      <TableHead className="w-16">학년</TableHead>
                      <TableHead className="w-16">반</TableHead>
                      <TableHead className="w-16">번호</TableHead>
                      <TableHead>담임명</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inputForm.schoolHistory.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={h.schoolName} onChange={e => {
                          const list = [...inputForm.schoolHistory];
                          list[i].schoolName = e.target.value;
                          setInputForm({...inputForm, schoolHistory: list});
                        }} /></TableCell>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={h.grade} onChange={e => {
                          const list = [...inputForm.schoolHistory];
                          list[i].grade = e.target.value;
                          setInputForm({...inputForm, schoolHistory: list});
                        }} /></TableCell>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={h.classNum} onChange={e => {
                          const list = [...inputForm.schoolHistory];
                          list[i].classNum = e.target.value;
                          setInputForm({...inputForm, schoolHistory: list});
                        }} /></TableCell>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={h.studentNum} onChange={e => {
                          const list = [...inputForm.schoolHistory];
                          list[i].studentNum = e.target.value;
                          setInputForm({...inputForm, schoolHistory: list});
                        }} /></TableCell>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={h.teacherName} onChange={e => {
                          const list = [...inputForm.schoolHistory];
                          list[i].teacherName = e.target.value;
                          setInputForm({...inputForm, schoolHistory: list});
                        }} /></TableCell>
                        <TableCell className="p-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            setInputForm({
                              ...inputForm,
                              schoolHistory: inputForm.schoolHistory.filter((_, idx) => idx !== i)
                            });
                          }}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 예방접종 현황 */}
        <Card className="border border-border/70">
          <CardHeader className="bg-muted/10 pb-3 border-b">
            <CardTitle className="text-base font-bold text-foreground">전염병 예방접종 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 max-h-[500px] overflow-y-auto">

            {/* 가. 취학전 예방접종 */}
            <div>
              <Label className="font-bold block mb-2">가. 취학전 예방접종 (접종여부 체크)</Label>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead>질병명</TableHead>
                      <TableHead className="text-center w-12">1차</TableHead>
                      <TableHead className="text-center w-12">2차</TableHead>
                      <TableHead className="text-center w-12">3차</TableHead>
                      <TableHead className="text-center w-12">4차</TableHead>
                      <TableHead className="text-center w-12">5차</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {IMMUNIZATION_DISEASES.map(d => {
                      const checks = inputForm.preSchoolImmunizations[d] || [false, false, false, false, false];
                      return (
                        <TableRow key={d}>
                          <TableCell className="py-1.5 text-xs font-semibold">{d}</TableCell>
                          {[0, 1, 2, 3, 4].map(idx => (
                            <TableCell key={idx} className="p-1.5 text-center">
                              <Checkbox
                                checked={checks[idx]}
                                onCheckedChange={(checked) => {
                                  const nextPre = { ...inputForm.preSchoolImmunizations };
                                  const targetArr = [...(nextPre[d] || [false, false, false, false, false])];
                                  targetArr[idx] = !!checked;
                                  nextPre[d] = targetArr;
                                  setInputForm({ ...inputForm, preSchoolImmunizations: nextPre });
                                }}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 나. 취학후 예방접종 */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <Label className="font-bold">나. 취학후 예방접종 (누적기록)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInputForm({
                      ...inputForm,
                      postSchoolImmunizations: [...inputForm.postSchoolImmunizations, { diseaseName: "", grade: "", date: "" }]
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> 추가
                </Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead>전염병명</TableHead>
                      <TableHead className="w-24">학년</TableHead>
                      <TableHead className="w-32">접종일자</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inputForm.postSchoolImmunizations.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={item.diseaseName} onChange={e => {
                          const list = [...inputForm.postSchoolImmunizations];
                          list[i].diseaseName = e.target.value;
                          setInputForm({...inputForm, postSchoolImmunizations: list});
                        }} /></TableCell>
                        <TableCell className="p-1"><Input className="h-8 text-xs" value={item.grade} onChange={e => {
                          const list = [...inputForm.postSchoolImmunizations];
                          list[i].grade = e.target.value;
                          setInputForm({...inputForm, postSchoolImmunizations: list});
                        }} /></TableCell>
                        <TableCell className="p-1"><Input className="h-8 text-xs" type="date" value={item.date} onChange={e => {
                          const list = [...inputForm.postSchoolImmunizations];
                          list[i].date = e.target.value;
                          setInputForm({...inputForm, postSchoolImmunizations: list});
                        }} /></TableCell>
                        <TableCell className="p-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            setInputForm({
                              ...inputForm,
                              postSchoolImmunizations: inputForm.postSchoolImmunizations.filter((_, idx) => idx !== i)
                            });
                          }}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 건강검진 및 구강검진 */}
      <Card className="border border-border/70">
        <CardHeader className="bg-muted/10 pb-3 border-b flex flex-wrap justify-between items-center gap-2">
          <div>
            <CardTitle className="text-base font-bold text-foreground">학년별 건강검진 / 구강검진 결과 입력</CardTitle>
            <CardDescription>검진일자와 보건선생님이 지정한 검진기관을 학년별로 등록합니다. 우측 버튼을 통해 엑셀 일괄 등록을 할 수 있습니다.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadExamTemplate}><FileDown className="h-4 w-4 mr-1" /> 일괄 양식 다운로드</Button>
            <Button variant="outline" size="sm" onClick={() => document.getElementById("exam-bulk-upload")?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileUp className="h-4 w-4 mr-1" />}
              일괄 등록 업로드
            </Button>
            <input type="file" id="exam-bulk-upload" accept=".xlsx" className="hidden" onChange={handleBulkExamUpload} />
          </div>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          <div className="min-w-[600px] border rounded-md">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-24">학년</TableHead>
                  <TableHead className="text-center" colSpan={2}>일반 건강검진</TableHead>
                  <TableHead className="text-center" colSpan={2}>구강검진</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-xs">검진일자</TableHead>
                  <TableHead className="text-xs">검진기관 (일반)</TableHead>
                  <TableHead className="text-xs">검진일자</TableHead>
                  <TableHead className="text-xs">검진기관 (구강)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["1", "2", "3", "4", "5", "6"].map(grade => {
                  const gData = inputForm.healthExams[grade] || {};
                  return (
                    <TableRow key={grade}>
                      <TableCell className="font-semibold text-xs text-center">{grade}학년</TableCell>
                      {/* 일반건강검진 */}
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={gData.general?.date || ""}
                          onChange={e => {
                            const exams = { ...inputForm.healthExams };
                            if (!exams[grade]) exams[grade] = {};
                            exams[grade].general = { date: e.target.value, institution: exams[grade].general?.institution || "" };
                            setInputForm({...inputForm, healthExams: exams});
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={gData.general?.institution || ""}
                          onValueChange={v => {
                            const exams = { ...inputForm.healthExams };
                            if (!exams[grade]) exams[grade] = {};
                            exams[grade].general = { date: exams[grade].general?.date || "", institution: v };
                            setInputForm({...inputForm, healthExams: exams});
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="지정 기관 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {generalInstitutions.map(inst => (
                              <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* 구강검진 */}
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={gData.dental?.date || ""}
                          onChange={e => {
                            const exams = { ...inputForm.healthExams };
                            if (!exams[grade]) exams[grade] = {};
                            exams[grade].dental = { date: e.target.value, institution: exams[grade].dental?.institution || "" };
                            setInputForm({...inputForm, healthExams: exams});
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={gData.dental?.institution || ""}
                          onValueChange={v => {
                            const exams = { ...inputForm.healthExams };
                            if (!exams[grade]) exams[grade] = {};
                            exams[grade].dental = { date: exams[grade].dental?.date || "", institution: v };
                            setInputForm({...inputForm, healthExams: exams});
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="지정 기관 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {dentalInstitutions.map(inst => (
                              <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 별도검사 현황 */}
      <Card className="border border-border/70">
        <CardHeader className="bg-muted/10 pb-3 border-b flex justify-between items-center flex-row">
          <div>
            <CardTitle className="text-base font-bold text-foreground">라. 별도검사 현황 (누적기록)</CardTitle>
            <CardDescription>시력검사, 소변검사 등 별도로 실시한 임시 검사 항목을 누가기록합니다.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInputForm({
                ...inputForm,
                otherExams: [...inputForm.otherExams, { date: "", examName: "", institution: "" }]
              });
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> 추가
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-48">검사일자</TableHead>
                  <TableHead>검사명</TableHead>
                  <TableHead>검사기관</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inputForm.otherExams.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="p-1"><Input className="h-8 text-xs" type="date" value={item.date} onChange={e => {
                      const list = [...inputForm.otherExams];
                      list[i].date = e.target.value;
                      setInputForm({...inputForm, otherExams: list});
                    }} /></TableCell>
                    <TableCell className="p-1"><Input className="h-8 text-xs" value={item.examName} onChange={e => {
                      const list = [...inputForm.otherExams];
                      list[i].examName = e.target.value;
                      setInputForm({...inputForm, otherExams: list});
                    }} /></TableCell>
                    <TableCell className="p-1"><Input className="h-8 text-xs" value={item.institution} onChange={e => {
                      const list = [...inputForm.otherExams];
                      list[i].institution = e.target.value;
                      setInputForm({...inputForm, otherExams: list});
                    }} /></TableCell>
                    <TableCell className="p-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        setInputForm({
                          ...inputForm,
                          otherExams: inputForm.otherExams.filter((_, idx) => idx !== i)
                        });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 저장 단추 */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="default" className="w-full sm:w-[150px] font-bold text-md" onClick={handleSaveRecord}>
          건강기록부 저장
        </Button>
      </div>
    </TabsContent>
  );
}
