'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TabsContent } from "@/components/ui/tabs";
import { FileDown, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student } from '@/lib/pe/types';
import type { InputForm } from './InputTabContent';

const IMMUNIZATION_DISEASES = [
  "디프테리아", "백일해", "파상풍", "홍역", "볼거리(유행성이하선염)", "풍진",
  "폴리오(소아마비)", "결핵", "일본뇌염", "수두", "B형 간염", "신종인플루엔자A(H1N1)", "기타"
];

const ALL_GRADES_LIST = [
  { key: "초1", label: "초등 1학년", gradeNum: "1" },
  { key: "초2", label: "초등 2학년", gradeNum: "2" },
  { key: "초3", label: "초등 3학년", gradeNum: "3" },
  { key: "초4", label: "초등 4학년", gradeNum: "4" },
  { key: "초5", label: "초등 5학년", gradeNum: "5" },
  { key: "초6", label: "초등 6학년", gradeNum: "6" },
  { key: "중1", label: "중등 1학년", gradeNum: "1" },
  { key: "중2", label: "중등 2학년", gradeNum: "2" },
  { key: "중3", label: "중등 3학년", gradeNum: "3" },
  { key: "고1", label: "고등 1학년", gradeNum: "1" },
  { key: "고2", label: "고등 2학년", gradeNum: "2" },
  { key: "고3", label: "고등 3학년", gradeNum: "3" }
];

export interface PrintOptions {
  profile: boolean;
  immunization: boolean;
  growth: boolean;
  ability: boolean;
  exams: boolean;
  others: boolean;
}

export interface GrowthDataEntry {
  height?: number;
  weight?: number;
  bmiGrade?: string;
  stdWeightGrade?: string;
}

export interface AbilityDataEntry {
  shuttleRunVal?: string;
  runWalk1000Val?: string;
  runWalk1600Val?: string;
  runWalk1200Val?: string;
  stepTestVal?: string;
  sitAndReachVal?: string;
  totalFlexibilityVal?: string;
  pushUpsVal?: string;
  sitUpsVal?: string;
  gripHangingVal?: string;
  run50mVal?: string;
  standingLongJumpVal?: string;
  bodyFatVal?: string;
  totalScore?: number;
  totalGrade?: string;
}

export function OutputTabContent({
  printOptions,
  setPrintOptions,
  handleExportPreviewToExcel,
  currentStudent,
  schoolConfig,
  inputForm,
  parsedGrowthData,
  parsedAbilityData,
  editedPreview,
  setEditedPreview,
}: {
  printOptions: PrintOptions;
  setPrintOptions: (opts: PrintOptions) => void;
  handleExportPreviewToExcel: () => void;
  currentStudent: Student;
  schoolConfig: { officialSchoolName: string; showGuardian: boolean; showBloodType: boolean };
  inputForm: InputForm;
  parsedGrowthData: Record<string, GrowthDataEntry>;
  parsedAbilityData: Record<string, AbilityDataEntry>;
  editedPreview: Record<string, string>;
  setEditedPreview: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  // 미리보기용 실시간 에디터 셀 컴포넌트
  const EditableCell = ({
    fieldKey,
    defaultValue,
    className
  }: {
    fieldKey: string;
    defaultValue: string;
    className?: string;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(defaultValue);

    useEffect(() => {
      setVal(defaultValue);
    }, [defaultValue]);

    const handleBlur = () => {
      setIsEditing(false);
      setEditedPreview(prev => ({ ...prev, [fieldKey]: val }));
    };

    if (isEditing) {
      return (
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => e.key === 'Enter' && handleBlur()}
          className="w-full h-full border border-primary p-0.5 text-center text-xs"
          autoFocus
        />
      );
    }

    const currentVal = editedPreview[fieldKey] !== undefined ? editedPreview[fieldKey] : defaultValue;

    return (
      <td
        className={cn("cursor-pointer hover:bg-primary/10 whitespace-nowrap text-center text-xs border border-border px-1 py-1.5", className)}
        onDoubleClick={() => setIsEditing(true)}
      >
        {currentVal || "-"}
      </td>
    );
  };

  return (
    <TabsContent value="output" className="space-y-6">

      {/* 출력 제어 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl border border-border/80 no-print">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-sm font-black mr-2">출력 항목 제어:</span>
          <div className="flex items-center space-x-2">
            <Checkbox id="opt-profile" checked={printOptions.profile} onCheckedChange={c => setPrintOptions({...printOptions, profile: !!c})} />
            <label htmlFor="opt-profile" className="text-xs font-bold cursor-pointer">1. 인적사항</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="opt-immunization" checked={printOptions.immunization} onCheckedChange={c => setPrintOptions({...printOptions, immunization: !!c})} />
            <label htmlFor="opt-immunization" className="text-xs font-bold cursor-pointer">2. 예방접종</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="opt-growth" checked={printOptions.growth} onCheckedChange={c => setPrintOptions({...printOptions, growth: !!c})} />
            <label htmlFor="opt-growth" className="text-xs font-bold cursor-pointer">3. 발달상황</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="opt-ability" checked={printOptions.ability} onCheckedChange={c => setPrintOptions({...printOptions, ability: !!c})} />
            <label htmlFor="opt-ability" className="text-xs font-bold cursor-pointer">4. 신체능력</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="opt-exams" checked={printOptions.exams} onCheckedChange={c => setPrintOptions({...printOptions, exams: !!c})} />
            <label htmlFor="opt-exams" className="text-xs font-bold cursor-pointer">5. 건강검진</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="opt-others" checked={printOptions.others} onCheckedChange={c => setPrintOptions({...printOptions, others: !!c})} />
            <label htmlFor="opt-others" className="text-xs font-bold cursor-pointer">6. 별도검사</label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportPreviewToExcel}><FileDown className="h-4 w-4" /> 엑셀 다운로드</Button>
          <Button className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> 인쇄하기</Button>
        </div>
      </div>

      {/* 건강기록부 미리보기 프레임 */}
      <div className="bg-white text-black p-6 sm:p-10 rounded-lg shadow border border-border border-double overflow-x-auto min-w-[700px] print:p-0 print:border-none print:shadow-none" id="health-record-print-area">
        <div className="max-w-[800px] mx-auto space-y-8">

          <div className="text-center font-headline font-black text-3xl tracking-[1.5rem] border-b-2 border-black pb-4">
            학 생 건 강 기 록 부
          </div>

          {/* 1. 인적사항 */}
          {printOptions.profile && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold">1. 인적사항</h4>
              <table className="w-full border-collapse border border-black text-xs">
                <tbody>
                  <tr>
                    <td className="border border-black bg-muted/20 px-2 py-2 font-bold text-center w-20">성명</td>
                    <td className="border border-black px-2 py-2 text-center w-28">{currentStudent.name}</td>
                    <td className="border border-black bg-muted/20 px-2 py-2 font-bold text-center w-16">성별</td>
                    <td className="border border-black px-2 py-2 text-center w-16">{currentStudent.gender}</td>
                    <td className="border border-black bg-muted/20 px-2 py-2 font-bold text-center w-28">주민등록번호</td>
                    <EditableCell fieldKey="profile-rrn" defaultValue={currentStudent.residentRegistrationNumber || ""} className="w-36" />
                    {schoolConfig.showBloodType && (
                      <>
                        <td className="border border-black bg-muted/20 px-2 py-2 font-bold text-center w-20">혈액형</td>
                        <EditableCell fieldKey="profile-blood" defaultValue={currentStudent.bloodType || "-"} className="w-20" />
                      </>
                    )}
                    {schoolConfig.showGuardian && (
                      <>
                        <td className="border border-black bg-muted/20 px-2 py-2 font-bold text-center w-20">보호자</td>
                        <EditableCell fieldKey="profile-guardian" defaultValue={currentStudent.guardianName || "-"} className="w-24" />
                      </>
                    )}
                  </tr>
                </tbody>
              </table>

              {/* 재학 및 담임교사 이력 (초1~고3) */}
              <table className="w-full border-collapse border border-black text-xs mt-2">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-1/3">학교</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-16">학년</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-20">반(이수학과)</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-16">번호</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center">담임명</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const h = inputForm.schoolHistory[idx];
                    return (
                      <tr key={idx}>
                        <EditableCell fieldKey={`hist-school-${idx}`} defaultValue={h?.schoolName || (idx === 0 ? inputForm.officialSchoolName : "")} />
                        <EditableCell fieldKey={`hist-grade-${idx}`} defaultValue={h?.grade ? `${h.grade}학년` : (idx === 0 && currentStudent ? `${currentStudent.grade}학년` : "")} className="text-center" />
                        <EditableCell fieldKey={`hist-class-${idx}`} defaultValue={h?.classNum ? `${h.classNum}반` : (idx === 0 && currentStudent ? `${currentStudent.classNum}반` : "")} className="text-center" />
                        <EditableCell fieldKey={`hist-num-${idx}`} defaultValue={h?.studentNum ? `${h.studentNum}번` : (idx === 0 && currentStudent ? `${currentStudent.studentNum}번` : "")} className="text-center" />
                        <EditableCell fieldKey={`hist-teacher-${idx}`} defaultValue={h?.teacherName || (idx === 0 ? inputForm.teacherName : "")} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 2. 전염병 예방접종 */}
          {printOptions.immunization && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold">2. 전염병 예방접종</h4>
              <p className="text-xs font-semibold">가. 취학전 예방접종</p>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-1.5 font-bold text-center" rowSpan={2}>대상전염병</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center" colSpan={5}>접종여부</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-20" rowSpan={2}>비 고</th>
                  </tr>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-1 font-bold text-center w-16">1차</th>
                    <th className="border border-black px-2 py-1 font-bold text-center w-16">2차</th>
                    <th className="border border-black px-2 py-1 font-bold text-center w-16">3차</th>
                    <th className="border border-black px-2 py-1 font-bold text-center w-16">4차</th>
                    <th className="border border-black px-2 py-1 font-bold text-center w-16">5차</th>
                  </tr>
                </thead>
                <tbody>
                  {IMMUNIZATION_DISEASES.map(d => {
                    const checks = inputForm.preSchoolImmunizations[d] || [false, false, false, false, false];
                    return (
                      <tr key={d}>
                        <td className="border border-black px-2 py-1.5 font-semibold">{d}</td>
                        {[0, 1, 2, 3, 4].map(idx => (
                          <td key={idx} className="border border-black text-center py-1">
                            {checks[idx] ? "O" : "-"}
                          </td>
                        ))}
                        <td className="border border-black px-2 py-1.5 text-center">-</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="text-xs font-semibold mt-4">나. 취학후 예방접종</p>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-1.5 font-bold text-center">대상전염병</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-1/3">학교/학년</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center w-1/3">접종일자</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, idx) => {
                    const post = inputForm.postSchoolImmunizations[idx];
                    return (
                      <tr key={idx}>
                        <EditableCell fieldKey={`post-disease-${idx}`} defaultValue={post?.diseaseName || ""} />
                        <EditableCell fieldKey={`post-grade-${idx}`} defaultValue={post?.grade || ""} />
                        <EditableCell fieldKey={`post-date-${idx}`} defaultValue={post?.date || ""} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. 건강검사 실시현황 - 가. 신체의 발달상황 */}
          {printOptions.growth && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold">3. 건강검사 실시현황</h4>
              <p className="text-xs font-semibold">가. 신체의 발달상황 (PAPS 신장/체중 연동)</p>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-2 font-bold text-center" colSpan={2} rowSpan={2}>구분</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={6}>초등학교</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={3}>중학교</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={3}>고등학교</th>
                  </tr>
                  <tr className="bg-muted/10">
                    {["1", "2", "3", "4", "5", "6", "1", "2", "3", "1", "2", "3"].map((g, i) => (
                      <th key={i} className="border border-black p-1 font-bold text-center w-10">{g}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 font-semibold text-center" colSpan={2}>키(cm)</td>
                    {ALL_GRADES_LIST.map(g => (
                      <EditableCell key={g.key} fieldKey={`growth-h-${g.key}`} defaultValue={parsedGrowthData[g.key]?.height?.toString() || ""} className="text-center" />
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 font-semibold text-center" colSpan={2}>몸무게(kg)</td>
                    {ALL_GRADES_LIST.map(g => (
                      <EditableCell key={g.key} fieldKey={`growth-w-${g.key}`} defaultValue={parsedGrowthData[g.key]?.weight?.toString() || ""} className="text-center" />
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 font-semibold text-center w-16" rowSpan={2}>비만도</td>
                    <td className="border border-black bg-muted/5 p-1 text-center w-16">체질량지수</td>
                    {ALL_GRADES_LIST.map(g => (
                      <EditableCell key={g.key} fieldKey={`growth-bmi-${g.key}`} defaultValue={parsedGrowthData[g.key]?.bmiGrade || ""} className="text-center" />
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 text-center">상대체중</td>
                    {ALL_GRADES_LIST.map(g => (
                      <EditableCell key={g.key} fieldKey={`growth-stdw-${g.key}`} defaultValue={parsedGrowthData[g.key]?.stdWeightGrade || ""} className="text-center" />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 3. 건강검사 실시현황 - 나. 신체의 능력 */}
          {printOptions.ability && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">나. 신체의 능력 (PAPS 체력검사 연동)</p>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-2 font-bold text-center" rowSpan={2}>구분</th>
                    <th className="border border-black px-2 py-2 font-bold text-center" rowSpan={2}>단위</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={3}>초등학교</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={3}>중학교</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={3}>고등학교</th>
                  </tr>
                  <tr className="bg-muted/10">
                    {["4", "5", "6", "1", "2", "3", "1", "2", "3"].map((g, i) => (
                      <th key={i} className="border border-black p-1 font-bold text-center w-14">{g}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 왕복오래달리기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">왕복오래달리기</td>
                    <td className="border border-black text-center">회</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-shuttleRun-${g.key}`} defaultValue={parsedAbilityData[g.key]?.shuttleRunVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 오래달리기-걷기 (1000m) */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">
                      <div className="leading-tight">오래달리기-걷기</div>
                      <div className="text-[9px] text-muted-foreground font-normal">(초5-고3) 1000m (초등)</div>
                    </td>
                    <td className="border border-black text-center">분:초</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-runWalk1000-${g.key}`} defaultValue={parsedAbilityData[g.key]?.runWalk1000Val || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 오래달리기-걷기 (1600m) */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">
                      <div className="leading-tight">오래달리기-걷기</div>
                      <div className="text-[9px] text-muted-foreground font-normal">(초5-고3) 1,600m (중고/남)</div>
                    </td>
                    <td className="border border-black text-center">분:초</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-runWalk1600-${g.key}`} defaultValue={parsedAbilityData[g.key]?.runWalk1600Val || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 오래달리기-걷기 (1200m) */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">
                      <div className="leading-tight">오래달리기-걷기</div>
                      <div className="text-[9px] text-muted-foreground font-normal">(초5-고3) 1,200m (중고/여)</div>
                    </td>
                    <td className="border border-black text-center">분:초</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-runWalk1200-${g.key}`} defaultValue={parsedAbilityData[g.key]?.runWalk1200Val || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 스텝검사 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">스텝검사</td>
                    <td className="border border-black text-center">PEI</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-stepTest-${g.key}`} defaultValue={parsedAbilityData[g.key]?.stepTestVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 앉아윗몸앞으로굽히기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">앉아윗몸앞으로굽히기</td>
                    <td className="border border-black text-center">cm</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-sitAndReach-${g.key}`} defaultValue={parsedAbilityData[g.key]?.sitAndReachVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 종합유연성 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">종합유연성</td>
                    <td className="border border-black text-center">점</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-totalFlexibility-${g.key}`} defaultValue={parsedAbilityData[g.key]?.totalFlexibilityVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* (무릎대고) 팔굽혀펴기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">
                      <div className="leading-tight">(무릎대고) 팔굽혀펴기</div>
                      <div className="text-[9px] text-muted-foreground font-normal">(중.고)</div>
                    </td>
                    <td className="border border-black text-center">회</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-pushUps-${g.key}`} defaultValue={parsedAbilityData[g.key]?.pushUpsVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 윗몸말아올리기, 윗몸일으키기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">윗몸말아올리기, 윗몸일으키기</td>
                    <td className="border border-black text-center">회(회)</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-sitUps-${g.key}`} defaultValue={parsedAbilityData[g.key]?.sitUpsVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 악력, 팔굽혀매달리기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">
                      <div className="leading-tight">악력, 팔굽혀매달리기</div>
                      <div className="text-[9px] text-muted-foreground font-normal">(중고/여)</div>
                    </td>
                    <td className="border border-black text-center">kg(초)</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-gripHanging-${g.key}`} defaultValue={parsedAbilityData[g.key]?.gripHangingVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 50m 달리기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">50m 달리기</td>
                    <td className="border border-black text-center">초</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-run50m-${g.key}`} defaultValue={parsedAbilityData[g.key]?.run50mVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 제자리멀리뛰기 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">제자리멀리뛰기</td>
                    <td className="border border-black text-center">cm</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-standingLongJump-${g.key}`} defaultValue={parsedAbilityData[g.key]?.standingLongJumpVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 체지방률 */}
                  <tr>
                    <td className="border border-black p-1 font-semibold">체지방률</td>
                    <td className="border border-black text-center">%</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-bodyFat-${g.key}`} defaultValue={parsedAbilityData[g.key]?.bodyFatVal || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 체력 점수 */}
                  <tr className="bg-muted/5 font-semibold">
                    <td className="border border-black p-1">체력 점수</td>
                    <td className="border border-black text-center">점</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-score-${g.key}`} defaultValue={parsedAbilityData[g.key]?.totalScore?.toString() || ""} className="text-center" />
                    ))}
                  </tr>
                  {/* 체력 등급 */}
                  <tr className="bg-muted/5 font-semibold">
                    <td className="border border-black p-1">체력 등급</td>
                    <td className="border border-black text-center">등급</td>
                    {ALL_GRADES_LIST.slice(3).map(g => (
                      <EditableCell key={g.key} fieldKey={`ability-grade-${g.key}`} defaultValue={parsedAbilityData[g.key]?.totalGrade || ""} className="text-center" />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 다. 건강검진 현황 */}
          {printOptions.exams && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">다. 건강검진 현황</p>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-2 font-bold text-center" colSpan={2} rowSpan={2}>구분</th>
                    <th className="border border-black px-2 py-1 font-bold text-center" colSpan={6}>초등학교</th>
                    <th className="border border-black px-2 py-1 font-bold text-center">중학교</th>
                    <th className="border border-black px-2 py-1 font-bold text-center">고등학교</th>
                  </tr>
                  <tr className="bg-muted/10">
                    {["1학년", "2학년", "3학년", "4학년", "5학년", "6학년", "1학년", "1학년"].map((h, i) => (
                      <th key={i} className="border border-black p-1 font-bold text-center w-16">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 text-center w-16" rowSpan={2}>건강검진</td>
                    <td className="border border-black bg-muted/5 p-1 text-center w-16">검진일자</td>
                    {["1", "2", "3", "4", "5", "6", "중1", "고1"].map(grade => {
                      const cleanG = grade.replace("중", "").replace("고", "");
                      return (
                        <EditableCell key={grade} fieldKey={`exam-gen-date-${grade}`} defaultValue={inputForm.healthExams[cleanG]?.general?.date || ""} className="text-center" />
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 text-center">검진기관</td>
                    {["1", "2", "3", "4", "5", "6", "중1", "고1"].map(grade => {
                      const cleanG = grade.replace("중", "").replace("고", "");
                      return (
                        <EditableCell key={grade} fieldKey={`exam-gen-inst-${grade}`} defaultValue={inputForm.healthExams[cleanG]?.general?.institution || ""} className="text-center" />
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 text-center" rowSpan={2}>구강검진</td>
                    <td className="border border-black bg-muted/5 p-1 text-center">검진일자</td>
                    {["1", "2", "3", "4", "5", "6", "중1", "고1"].map(grade => {
                      const cleanG = grade.replace("중", "").replace("고", "");
                      return (
                        <EditableCell key={grade} fieldKey={`exam-den-date-${grade}`} defaultValue={inputForm.healthExams[cleanG]?.dental?.date || ""} className="text-center" />
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="border border-black bg-muted/5 p-1 text-center">검진기관</td>
                    {["1", "2", "3", "4", "5", "6", "중1", "고1"].map(grade => {
                      const cleanG = grade.replace("중", "").replace("고", "");
                      return (
                        <EditableCell key={grade} fieldKey={`exam-den-inst-${grade}`} defaultValue={inputForm.healthExams[cleanG]?.dental?.institution || ""} className="text-center" />
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 라. 별도검사 현황 */}
          {printOptions.others && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">라. 별도검사 현황</p>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/10">
                    <th className="border border-black px-2 py-1.5 font-bold text-center">검사일자</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center">검사명</th>
                    <th className="border border-black px-2 py-1.5 font-bold text-center">검사기관</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const other = inputForm.otherExams[idx];
                    return (
                      <tr key={idx}>
                        <EditableCell fieldKey={`other-date-${idx}`} defaultValue={other?.date || ""} />
                        <EditableCell fieldKey={`other-name-${idx}`} defaultValue={other?.examName || ""} />
                        <EditableCell fieldKey={`other-inst-${idx}`} defaultValue={other?.institution || ""} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </TabsContent>
  );
}
