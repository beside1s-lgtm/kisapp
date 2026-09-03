'use client';
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  saveHealthStudentRecord,
  getHealthExamInstitutions,
  saveHealthExamInstitutions,
  getHealthSchoolSetting,
  saveHealthSchoolSetting,
  bulkUpdateHealthExams
} from '@/lib/services/healthService';
import { exportToExcel } from '@/lib/services/peService';
import type { Student, MeasurementItem, MeasurementRecord, SchoolHistoryEntry, PreSchoolImmunization, PostSchoolImmunization, HealthExam, OtherExam } from '@/lib/pe/types';
import { getPapsGrade, calculatePapsScore } from '@/lib/pe/paps';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { FileUp, FileDown, Plus, Trash2, Loader2, Edit3, Search, Settings2, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { parseExcel, cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast as useToastLocal } from "@/hooks/use-toast";

// ── 건강기록부 설정 패널 (접기/펼치기) ──────────────────────
function HealthConfigPanel({
  school,
  schoolConfig,
  onConfigChange,
}: {
  school: string;
  schoolConfig: { officialSchoolName: string; showGuardian: boolean; showBloodType: boolean };
  onConfigChange: (cfg: { officialSchoolName: string; showGuardian: boolean; showBloodType: boolean }) => void;
}) {
  const { toast } = useToastLocal();
  const [open, setOpen] = useState(false);
  const [localName, setLocalName] = useState(schoolConfig.officialSchoolName);
  const [localGuardian, setLocalGuardian] = useState(schoolConfig.showGuardian);
  const [localBloodType, setLocalBloodType] = useState(schoolConfig.showBloodType);
  const [saving, setSaving] = useState(false);

  // schoolConfig 변경 시 동기화
  useEffect(() => {
    setLocalName(schoolConfig.officialSchoolName);
    setLocalGuardian(schoolConfig.showGuardian);
    setLocalBloodType(schoolConfig.showBloodType);
  }, [schoolConfig]);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    try {
      await saveHealthSchoolSetting(school, {
        officialSchoolName: localName.trim() || undefined,
        healthRecord_showGuardian: localGuardian,
        healthRecord_showBloodType: localBloodType,
      });
      onConfigChange({ officialSchoolName: localName.trim(), showGuardian: localGuardian, showBloodType: localBloodType });
      toast({ title: "✅ 건강기록부 설정 저장", description: "설정이 저장되었습니다." });
      setOpen(false);
    } catch {
      toast({ variant: "destructive", title: "설정 저장 실패" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/5 overflow-hidden no-print">
      {/* 헤더 (항상 표시) */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-green-500/10 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏥</span>
          <span className="font-semibold text-sm">건강기록부 설정</span>
          {schoolConfig.officialSchoolName && (
            <span className="text-xs text-muted-foreground ml-1">— {schoolConfig.officialSchoolName}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:flex gap-2">
            <span className={cn("px-1.5 py-0.5 rounded text-[10px]", schoolConfig.showGuardian ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-muted text-muted-foreground")}>
              보호자 {schoolConfig.showGuardian ? "ON" : "OFF"}
            </span>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px]", schoolConfig.showBloodType ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-muted text-muted-foreground")}>
              혈액형 {schoolConfig.showBloodType ? "ON" : "OFF"}
            </span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* 펼쳐진 설정 내용 */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-green-500/20 space-y-4">
          {/* 정식 학교 명칭 */}
          <div className="space-y-1.5">
            <Label htmlFor="hc-official-name" className="text-sm font-medium">정식 학교 명칭</Label>
            <p className="text-xs text-muted-foreground">건강기록부에 표시될 학교의 공식 명칭을 입력합니다. (예: 호치민한국국제학교)</p>
            <Input
              id="hc-official-name"
              placeholder="예: 호치민한국국제학교"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              className="max-w-sm h-8 text-sm"
            />
          </div>
          {/* 토글 옵션 */}
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center justify-between gap-4 min-w-[200px]">
              <div>
                <Label className="text-sm">보호자 성명 표시</Label>
                <p className="text-xs text-muted-foreground">출력 시 보호자 항목 표시</p>
              </div>
              <Switch checked={localGuardian} onCheckedChange={setLocalGuardian} />
            </div>
            <div className="flex items-center justify-between gap-4 min-w-[200px]">
              <div>
                <Label className="text-sm">혈액형 표시</Label>
                <p className="text-xs text-muted-foreground">출력 시 혈액형 항목 표시</p>
              </div>
              <Switch checked={localBloodType} onCheckedChange={setLocalBloodType} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />저장 중...</> : "설정 저장"}
          </Button>
        </div>
      )}
    </div>
  );
}



const IMMUNIZATION_DISEASES = [
  "디프테리아", "백일해", "파상풍", "홍역", "볼거리(유행성이하선염)", "풍진",
  "폴리오(소아마비)", "결핵", "일본뇌염", "수두", "B형 간염", "신종인플루엔자A(H1N1)", "기타"
];

// 학년 목록 (초1 ~ 고3)
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

export function HealthRecordManagement({
  students,
  items,
  records,
  onUpdate
}: {
  students: Student[];
  items: MeasurementItem[];
  records: MeasurementRecord[];
  onUpdate: () => void;
}) {
  const { user } = useAuth(); const school = 'KISH';
  const { toast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"input" | "output">("input");

  // 검색/필터 상태
  const [searchName, setSearchName] = useState<string>("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("all");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");

  // 기관 설정 팝업 상태
  const [isInstDialogOpen, setIsInstDialogOpen] = useState<boolean>(false);
  const [generalInstInput, setGeneralInstInput] = useState<string>("");
  const [dentalInstInput, setDentalInstInput] = useState<string>("");
  const [generalInstitutions, setGeneralInstitutions] = useState<string[]>([]);
  const [dentalInstitutions, setDentalInstitutions] = useState<string[]>([]);

  // 건강검진 일괄 업로드 상태
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 출력 화면 즉석 수정 상태 (수정된 셀 값들 보존용)
  const [editedPreview, setEditedPreview] = useState<Record<string, string>>({});
  // 출력 항목 제어 상태
  const [printOptions, setPrintOptions] = useState({
    profile: true,
    immunization: true,
    growth: true,
    ability: true,
    exams: true,
    others: true
  });

  // 학교 전체 설정 (건강기록부 설정)
  const [schoolConfig, setSchoolConfig] = useState<{
    officialSchoolName: string;
    showGuardian: boolean;
    showBloodType: boolean;
  }>({
    officialSchoolName: "",
    showGuardian: true,
    showBloodType: true,
  });

  // 학교 설정 로드
  useEffect(() => {
    async function loadSchoolConfig() {
      if (!school) return;
      const sData = await getHealthSchoolSetting(school);
      if (sData) {
        setSchoolConfig({
          officialSchoolName: sData.officialSchoolName ?? "",
          showGuardian: sData.healthRecord_showGuardian !== false,
          showBloodType: sData.healthRecord_showBloodType !== false,
        });
      }
    }
    loadSchoolConfig();
  }, [school]);

  // 선택된 학생 객체
  const currentStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // 입력 폼 상태 (선택된 학생이 바뀔 때 마다 초기화)
  const [inputForm, setInputForm] = useState<{
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
  }>({
    residentRegistrationNumber: "",
    guardianName: "",
    bloodType: "",
    officialSchoolName: "",
    teacherName: "",
    schoolHistory: [],
    preSchoolImmunizations: {},
    postSchoolImmunizations: [],
    healthExams: {},
    otherExams: []
  });

  // 기관 리스트 불러오기
  useEffect(() => {
    async function loadInstitutions() {
      if (school) {
        const insts = await getHealthExamInstitutions(school);
        setGeneralInstitutions(insts.general || []);
        setDentalInstitutions(insts.dental || []);
      }
    }
    loadInstitutions();
  }, [school]);

  // 학생 변경 시 폼 상태 리셋
  useEffect(() => {
    if (currentStudent) {
      // 취학전 예방접종 기본값 생성 (체크박스 구조용)
      const defaultPreSchool: PreSchoolImmunization = {};
      IMMUNIZATION_DISEASES.forEach(d => {
        defaultPreSchool[d] = currentStudent.preSchoolImmunizations?.[d] || [false, false, false, false, false];
      });

      setInputForm({
        residentRegistrationNumber: currentStudent.residentRegistrationNumber || "",
        guardianName: currentStudent.guardianName || "",
        bloodType: currentStudent.bloodType || "",
        // 학생 개별 설정 → 없으면 학교 전체 설정 officialSchoolName 사용
        officialSchoolName: currentStudent.officialSchoolName || schoolConfig.officialSchoolName || currentStudent.school || "",
        teacherName: currentStudent.teacherName || "",
        schoolHistory: currentStudent.schoolHistory || [],
        preSchoolImmunizations: defaultPreSchool,
        postSchoolImmunizations: currentStudent.postSchoolImmunizations || [],
        healthExams: currentStudent.healthExams || {},
        otherExams: currentStudent.otherExams || []
      });
      setEditedPreview({}); // 즉석 수정 내역 초기화
    }
  }, [currentStudent]);

  // 학생 리스트 필터링
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (searchName && !s.name.includes(searchName)) return false;
      if (selectedGradeFilter !== "all" && s.grade !== selectedGradeFilter) return false;
      if (selectedClassFilter !== "all" && s.classNum !== selectedClassFilter) return false;
      return true;
    }).sort((a,b) => {
      if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
      if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
      return parseInt(a.studentNum) - parseInt(b.studentNum);
    });
  }, [students, searchName, selectedGradeFilter, selectedClassFilter]);

  // 필터용 학년/반 리스트
  const { gradesList, classList } = useMemo(() => {
    const grades = [...new Set(students.map(s => String(s.grade || '')).filter(Boolean))].sort((a,b) => parseInt(a) - parseInt(b));
    const classes = selectedGradeFilter !== "all" 
      ? [...new Set(students.filter(s => s.grade === selectedGradeFilter).map(s => String(s.classNum || '')).filter(Boolean))].sort((a,b) => parseInt(a) - parseInt(b))
      : [];
    return { gradesList: grades, classList: classes };
  }, [students, selectedGradeFilter]);

  // 건강검진 기관 저장
  const handleSaveInstitutions = async () => {
    if (!school) return;
    await saveHealthExamInstitutions(school, {
      general: generalInstitutions,
      dental: dentalInstitutions
    });
    toast({ title: "기관 설정 저장 완료" });
  };

  // 건강기록부 전체 정보 저장
  const handleSaveRecord = async () => {
    if (!school || !selectedStudentId) return;
    try {
      await saveHealthStudentRecord(selectedStudentId, {
        residentRegistrationNumber: inputForm.residentRegistrationNumber,
        guardianName: inputForm.guardianName,
        bloodType: inputForm.bloodType,
        officialSchoolName: inputForm.officialSchoolName,
        teacherName: inputForm.teacherName,
        schoolHistory: inputForm.schoolHistory,
        preSchoolImmunizations: inputForm.preSchoolImmunizations,
        postSchoolImmunizations: inputForm.postSchoolImmunizations,
        healthExams: inputForm.healthExams,
        otherExams: inputForm.otherExams
      });
      onUpdate();
      toast({ title: "저장 완료", description: "학생 건강기록부 정보가 정상 저장되었습니다." });
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    }
  };

  // 1. 신체의 발달상황 데이터 계산 연동
  const parsedGrowthData = useMemo(() => {
    if (!currentStudent) return {};
    const result: Record<string, { height?: number; weight?: number; bmiGrade?: string; stdWeightGrade?: string }> = {};

    const currentSchoolLevel = currentStudent.school.includes("중") 
      ? "중" 
      : (currentStudent.school.includes("고") ? "고" : "초");

    // 학생 측정 기록 필터링
    const studentRecords = records.filter(r => r.studentId === currentStudent.id);
    const history = currentStudent.schoolHistory || [];

    ALL_GRADES_LIST.forEach(g => {
      if (!g.key.startsWith(currentSchoolLevel)) return;
      // 1. 학년도 연도 매칭 또는 추정
      // history에서 동일 학년에 부합하는 연도 찾기
      const historyMatch = history.find(h => {
        const isElementary = g.key.startsWith("초") && h.grade === g.gradeNum && parseInt(h.grade) <= 6;
        const isMiddle = g.key.startsWith("중") && h.grade === g.gradeNum && parseInt(h.grade) <= 3;
        const isHigh = g.key.startsWith("고") && h.grade === g.gradeNum && parseInt(h.grade) <= 3;
        // 단순 추정이지만, 학생 정보 상에 초/중/고 구분이 학교 유형에 종속되므로
        // 여기서는 학년 일치로 필터링
        return h.grade === g.gradeNum;
      });

      let recordsForGrade = studentRecords;
      if (historyMatch) {
        // 이력이 존재하면 정해진 학년의 기록들 사용
        // 대략적으로 해당 학년 시점의 데이터 필터링
        // (실제 데이터 기록의 날짜와 학년도 연도 매칭)
      }

      // 간단하게 폴백: 키/몸무게 측정 결과들 중, 
      // PAPS 신장/체중 종목의 학년별 연동 데이터 추출
      // 체육 성장 기록 시스템 내 기록은 r.item === '신장', '체중' 또는 '체질량지수(BMI)'
      const 신장기록 = studentRecords.filter(r => (r.item.includes("신장") || r.item.includes("키")));
      const 체중기록 = studentRecords.filter(r => (r.item.includes("체중") || r.item.includes("몸무게")));

      // 각 학년별 측정 수치 분배 (측정 당시 학년 데이터가 r에 저장되므로, 
      // 만약 store 상의 학생이 현재 6학년이고, 기록 시점의 학생 학년 정보는 s?.grade 로 records 쿼리할 때 매칭)
      // 여기서는 학생의 기록 중 해당 학년('grade') 시점에 찍힌 최신 기록을 찾는다.
      const matchHeight = 신장기록.find(r => {
        // 기록의 연도로 학년을 역산하거나, 또는 기록 저장 시점의 s?.grade에 매칭
        // 여기서는 단순화하여 학생의 기록 중 r.value 가 그 학년의 정상 키 범위인지를 대략 보고 넣거나, 
        // 혹은 기록 입력 시점에 s.grade가 records에 백업되어 있으므로, 
        // studentId 에 매핑된 records 중 기록 연도를 s.schoolHistory 연도와 대조
        const recordYear = new Date(r.date).getFullYear();
        const currentYear = new Date().getFullYear();
        const diff = currentYear - recordYear;
        const targetGradeInt = parseInt(currentStudent.grade) - diff;
        return targetGradeInt.toString() === g.gradeNum;
      });

      const matchWeight = 체중기록.find(r => {
        const recordYear = new Date(r.date).getFullYear();
        const currentYear = new Date().getFullYear();
        const diff = currentYear - recordYear;
        const targetGradeInt = parseInt(currentStudent.grade) - diff;
        return targetGradeInt.toString() === g.gradeNum;
      });

      if (matchHeight || matchWeight) {
        const hVal = matchHeight?.value || matchHeight?.height;
        const wVal = matchWeight?.value || matchWeight?.weight;
        let bmiText = "정상체중";
        if (hVal && wVal) {
          const bmi = wVal / ((hVal / 100) * (hVal / 100));
          if (bmi < 18.5) bmiText = "저체중";
          else if (bmi >= 25) bmiText = "비만";
          else if (bmi >= 23) bmiText = "과체중";
        }

        result[g.key] = {
          height: hVal,
          weight: wVal,
          bmiGrade: bmiText,
          stdWeightGrade: "정상체중"
        };
      }
    });

    return result;
  }, [currentStudent, records]);

  // 2. 신체의 능력 데이터 계산 연동 (PAPS 세부 종목별 자동 매칭)
  const parsedAbilityData = useMemo(() => {
    if (!currentStudent) return {};
    const result: Record<string, {
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
    }> = {};

    const currentSchoolLevel = currentStudent.school.includes("중") 
      ? "중" 
      : (currentStudent.school.includes("고") ? "고" : "초");

    const studentRecords = records.filter(r => r.studentId === currentStudent.id);

    ALL_GRADES_LIST.forEach(g => {
      if (!g.key.startsWith(currentSchoolLevel)) return;
      // 해당 학년도의 기록 필터링
      const gradeRecords = studentRecords.filter(r => {
        const recordYear = new Date(r.date).getFullYear();
        const currentYear = new Date().getFullYear();
        const diff = currentYear - recordYear;
        const targetGradeInt = parseInt(currentStudent.grade) - diff;
        return targetGradeInt.toString() === g.gradeNum;
      });

      if (gradeRecords.length === 0) return;

      // 각 체력 요소별 종목 필터링 (최신 기록 1개씩만)
      const getFactorInfo = (keywords: string[]) => {
        const match = gradeRecords.filter(r => keywords.some(kw => r.item.includes(kw))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (!match) return null;
        const grade = getPapsGrade(match.item, currentStudent, match.value);
        const score = calculatePapsScore(match.item, currentStudent, match.value);
        return { value: match.value, grade: grade ? `${grade}등급` : "-", score: score || 0 };
      };

      const shuttleRun = getFactorInfo(["왕복오래달리기"]);
      const runWalk1000 = getFactorInfo(["1000m", "오래달리기-걷기"]);
      const runWalk1600 = getFactorInfo(["1600m"]);
      const runWalk1200 = getFactorInfo(["1200m"]);
      const stepTest = getFactorInfo(["스텝"]);
      const sitAndReach = getFactorInfo(["앉아윗몸앞으로굽히기", "앉아윗몸 앞으로 굽히기"]);
      const totalFlexibility = getFactorInfo(["종합유연성"]);
      const pushUps = getFactorInfo(["팔굽혀펴기"]);
      const sitUps = getFactorInfo(["윗몸 말아올리기", "윗몸말아올리기", "윗몸일으키기"]);
      const gripHanging = getFactorInfo(["악력", "매달리기"]);
      const run50m = getFactorInfo(["50m"]);
      const standingLongJump = getFactorInfo(["제자리"]);
      const bodyFat = getFactorInfo(["체지방률", "BMI", "체질량지수"]);

      // 대표 PAPS 점수 계산용 (기본 5개 요소 대표값 활용)
      const repCardio = shuttleRun || runWalk1000 || runWalk1600 || runWalk1200 || stepTest;
      const repFlex = sitAndReach || totalFlexibility;
      const repStrength = sitUps || pushUps || gripHanging;
      const repSpeed = run50m || standingLongJump;

      let totalPapsScore = 0;
      let count = 0;
      [repCardio, repFlex, repStrength, repSpeed].forEach(f => {
        if (f) {
          totalPapsScore += f.score;
          count++;
        }
      });

      let finalGrade = "-";
      let finalScore = 0;
      if (count > 0) {
        finalScore = (totalPapsScore / (count * 20)) * 100;
        if (finalScore >= 80) finalGrade = "1등급";
        else if (finalScore >= 60) finalGrade = "2등급";
        else if (finalScore >= 40) finalGrade = "3등급";
        else if (finalScore >= 20) finalGrade = "4등급";
        else finalGrade = "5등급";
      }

      result[g.key] = {
        shuttleRunVal: shuttleRun ? `${shuttleRun.value}회` : undefined,
        runWalk1000Val: runWalk1000 ? `${runWalk1000.value}` : undefined,
        runWalk1600Val: runWalk1600 ? `${runWalk1600.value}` : undefined,
        runWalk1200Val: runWalk1200 ? `${runWalk1200.value}` : undefined,
        stepTestVal: stepTest ? `${stepTest.value}` : undefined,
        sitAndReachVal: sitAndReach ? `${sitAndReach.value}cm` : undefined,
        totalFlexibilityVal: totalFlexibility ? `${totalFlexibility.value}점` : undefined,
        pushUpsVal: pushUps ? `${pushUps.value}회` : undefined,
        sitUpsVal: sitUps ? `${sitUps.value}회` : undefined,
        gripHangingVal: gripHanging ? `${gripHanging.value}` : undefined,
        run50mVal: run50m ? `${run50m.value}초` : undefined,
        standingLongJumpVal: standingLongJump ? `${standingLongJump.value}cm` : undefined,
        bodyFatVal: bodyFat ? `${bodyFat.value}%` : undefined,
        totalScore: count > 0 ? Math.round(finalScore) : undefined,
        totalGrade: finalGrade !== "-" ? finalGrade : undefined
      };
    });

    return result;
  }, [currentStudent, records]);

  // 건강검진 결과 일괄 업로드 파서
  const handleBulkExamUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      setIsUploading(true);
      try {
        const uploadedData = await parseExcel<any>(file);
        if (uploadedData.length === 0) throw new Error("데이터가 없습니다.");

        let updateCount = 0;
        await Promise.all(students.map(async (student) => {
          // 해당 학생의 업로드 레코드 찾기
          const matchedExams = uploadedData.filter(row => 
            row.학년 === student.grade && 
            row.반 === student.classNum && 
            row.번호 === student.studentNum && 
            row.이름 === student.name
          );

          if (matchedExams.length > 0) {
            const currentExams = student.healthExams || {};
            matchedExams.forEach(row => {
              const gradeKey = student.grade;
              if (!currentExams[gradeKey]) currentExams[gradeKey] = {};
              
              const type = row.검진구분 === "구강" ? "dental" : "general";
              currentExams[gradeKey][type] = {
                date: row.검진일자 || format(new Date(), 'yyyy-MM-dd'),
                institution: row.검진기관 || ""
              };
            });

            await saveHealthStudentRecord(student.id, { healthExams: currentExams });
            updateCount++;
          }
        }));

        onUpdate();
        toast({ title: "검진결과 일괄 등록 성공", description: `${updateCount}명의 검진 내역이 반영되었습니다.` });
      } catch (err: any) {
        toast({ variant: "destructive", title: "업로드 실패", description: err.message || "파일 형식을 확인해주세요." });
      } finally {
        setIsUploading(false);
      }
    }
    event.target.value = "";
  };

  // 일괄 등록 양식 엑셀 다운로드
  const handleDownloadExamTemplate = () => {
    const headers = ["학년", "반", "번호", "이름", "검진구분", "검진일자", "검진기관"];
    const demoData = students.slice(0, 3).map(s => ({
      "학년": s.grade,
      "반": s.classNum,
      "번호": s.studentNum,
      "이름": s.name,
      "검진구분": "일반",
      "검진일자": format(new Date(), 'yyyy-MM-dd'),
      "검진기관": generalInstitutions[0] || "비나헬스케어"
    }));
    exportToExcel("건강검진_결과_일괄입력_양식.xlsx", demoData);
  };

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

  // 미리보기 데이터 기준 건강기록부 엑셀 내보내기
  const handleExportPreviewToExcel = () => {
    if (!currentStudent) return;
    const wb = XLSX.utils.book_new();
    
    // 이중 어레이(AOA)로 양식 구성
    const aoa: any[][] = [
      ["학 생 건 강 기 록 부"],
      [],
      ["1. 인적사항"],
      ["성명", currentStudent.name, "성별", currentStudent.gender, "주민등록번호", editedPreview['profile-rrn'] || currentStudent.residentRegistrationNumber || "",
       ...(schoolConfig.showBloodType ? ["혈액형", editedPreview['profile-blood'] || currentStudent.bloodType || ""] : []),
       ...(schoolConfig.showGuardian ? ["보호자", editedPreview['profile-guardian'] || currentStudent.guardianName || ""] : [])],
      ["학교", "학년", "반", "번호", "담임교사명"]
    ];

    // 인적 이력
    const history = inputForm.schoolHistory;
    for (let i = 0; i < 5; i++) {
      const h = history[i];
      aoa.push([
        h?.schoolName || "",
        h?.grade ? `${h.grade}학년` : "",
        h?.classNum ? `${h.classNum}반` : "",
        h?.studentNum ? `${h.studentNum}번` : "",
        h?.teacherName || ""
      ]);
    }

    aoa.push([], ["2. 예방접종 현황"], ["대상전염병", "1차", "2차", "3차", "4차", "5차"]);
    IMMUNIZATION_DISEASES.forEach(d => {
      const checks = inputForm.preSchoolImmunizations[d] || [false, false, false, false, false];
      aoa.push([
        d,
        checks[0] ? "O" : "",
        checks[1] ? "O" : "",
        checks[2] ? "O" : "",
        checks[3] ? "O" : "",
        checks[4] ? "O" : ""
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    
    // 셀 병합 설정
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } } // 제목 가로 병합
    ];

    XLSX.utils.book_append_sheet(wb, ws, "건강기록부");
    XLSX.writeFile(wb, `${currentStudent.name}_건강기록부_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "엑셀 다운로드 완료" });
  };

  return (
    <Card className="shadow-lg border border-border/80">
      <CardHeader className="bg-muted/10 border-b">
        <CardTitle className="premium-gradient-text text-xl">학생 건강기록부 관리</CardTitle>
        <CardDescription>학생의 인적사항, 전염병 예방접종 및 PAPS 측정 결과를 통합하여 건강기록부를 작성하고 관리합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        
        {/* ── 건강기록부 설정 (상단 고정) ── */}
        <HealthConfigPanel
          school={school ?? ""}
          schoolConfig={schoolConfig}
          onConfigChange={setSchoolConfig}
        />

        {/* 학생 선택 및 필터 */}
        <div className="flex flex-wrap items-center gap-2 bg-muted/20 p-3 rounded-xl border border-border/50 no-print">
          <Select value={selectedGradeFilter} onValueChange={(v) => { setSelectedGradeFilter(v); setSelectedClassFilter("all"); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="학년 필터" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 학년</SelectItem>
              {gradesList.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter} disabled={selectedGradeFilter === "all"}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="반 필터" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 반</SelectItem>
              {classList.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="학생 이름 검색..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-full sm:w-[250px] font-bold text-primary border-primary/30">
              <SelectValue placeholder="대상 학생을 선택해주세요" />
            </SelectTrigger>
            <SelectContent>
              {filteredStudents.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.grade}학년 {s.classNum}반 {s.studentNum}번 {s.name} ({s.gender})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="ml-auto gap-2" onClick={() => setIsInstDialogOpen(true)}>
            <Settings2 className="h-4 w-4" /> 지정 검진기관 설정
          </Button>
        </div>

        {currentStudent ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 no-print">
              <TabsTrigger value="input" className="text-base font-bold">1. 건강기록부 정보 입력</TabsTrigger>
              <TabsTrigger value="output" className="text-base font-bold">2. 인쇄 및 미리보기 (출력)</TabsTrigger>
            </TabsList>

            {/* 입력 탭 */}
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

            {/* 출력 탭 */}
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
          </Tabs>
        ) : (
          <div className="h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Search className="h-10 w-10 opacity-30" />
            <span>건강기록부를 관리할 학생을 선택해 주세요.</span>
          </div>
        )}
      </CardContent>

      {/* 지정 검진기관 설정 다이얼로그 */}
      <Dialog open={isInstDialogOpen} onOpenChange={setIsInstDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>학교 지정 검진기관 설정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 일반검진 기관 */}
            <div className="space-y-2">
              <Label className="font-bold">일반 건강검진 지정 기관</Label>
              <div className="flex gap-2">
                <Input value={generalInstInput} onChange={e => setGeneralInstInput(e.target.value)} placeholder="검진기관명 입력..." />
                <Button size="sm" onClick={() => {
                  if (generalInstInput.trim() && !generalInstitutions.includes(generalInstInput.trim())) {
                    setGeneralInstitutions([...generalInstitutions, generalInstInput.trim()]);
                    setGeneralInstInput("");
                  }
                }}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {generalInstitutions.map(inst => (
                  <Badge key={inst} variant="secondary" className="gap-1.5 px-2 py-1">
                    {inst}
                    <button className="text-destructive font-black text-xs" onClick={() => setGeneralInstitutions(generalInstitutions.filter(x => x !== inst))}>x</button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* 구강검진 기관 */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="font-bold">구강검진 지정 기관</Label>
              <div className="flex gap-2">
                <Input value={dentalInstInput} onChange={e => setDentalInstInput(e.target.value)} placeholder="치과명 입력..." />
                <Button size="sm" onClick={() => {
                  if (dentalInstInput.trim() && !dentalInstitutions.includes(dentalInstInput.trim())) {
                    setDentalInstitutions([...dentalInstitutions, dentalInstInput.trim()]);
                    setDentalInstInput("");
                  }
                }}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {dentalInstitutions.map(inst => (
                  <Badge key={inst} variant="secondary" className="gap-1.5 px-2 py-1">
                    {inst}
                    <button className="text-destructive font-black text-xs" onClick={() => setDentalInstitutions(dentalInstitutions.filter(x => x !== inst))}>x</button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">취소</Button></DialogClose>
            <Button onClick={() => { handleSaveInstitutions(); setIsInstDialogOpen(false); }}>저장 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
        @media print {
          /* 헤더, 사이드바, 필터, 탭 전환 버튼, 인쇄 버튼 등 웹 UI 숨김 */
          .no-print,
          .print-hidden,
          header,
          footer,
          nav,
          aside,
          button,
          [role="tablist"],
          .tabs-list {
            display: none !important;
          }

          /* 배경색 및 텍스트 강제 지정 */
          body {
            background-color: white !important;
            color: black !important;
          }

          /* 대시보드 내부 레이아웃의 마진/패딩 제거 */
          main,
          .container,
          .w-full,
          div {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          /* 인쇄 대상 영역 A4 맞춤 설정 */
          #health-record-print-area {
            display: block !important;
            width: 100% !important;
            max-width: 800px !important;
            min-width: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }

          /* 테이블의 모든 테두리를 인쇄 시 검은색 뚜렷한 실선으로 강제 지정 */
          #health-record-print-area table {
            border-collapse: collapse !important;
            width: 100% !important;
            border: 1px solid black !important;
          }

          #health-record-print-area th,
          #health-record-print-area td {
            border: 1px solid black !important;
            color: black !important;
            padding: 4px 6px !important;
          }

          /* 인쇄 시 옅은 회색 음영은 유지하여 시인성 확보 */
          #health-record-print-area .bg-muted\\/10,
          #health-record-print-area .bg-muted\\/20,
          #health-record-print-area .bg-muted\\/5 {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 페이지 브레이크 제어 */
          h4, h5, p, table, tr {
            page-break-inside: avoid;
          }

          /* A4 세로 규격 설정 */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      `}</style>
    </Card>
  );
}

// 뱃지 컴포넌트 간이 정의 (ui 패널에서 수혈)
function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
      {children}
    </span>
  );
}
