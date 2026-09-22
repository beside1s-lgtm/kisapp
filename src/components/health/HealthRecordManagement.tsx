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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { parseExcel } from "@/lib/utils";
import * as XLSX from "xlsx";
import { HealthConfigPanel } from './record-management/HealthConfigPanel';
import { InputTabContent } from './record-management/InputTabContent';
import { OutputTabContent } from './record-management/OutputTabContent';
import { InstitutionDialog } from './record-management/InstitutionDialog';

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
            <InputTabContent
              inputForm={inputForm}
              setInputForm={setInputForm}
              generalInstitutions={generalInstitutions}
              dentalInstitutions={dentalInstitutions}
              isUploading={isUploading}
              handleDownloadExamTemplate={handleDownloadExamTemplate}
              handleBulkExamUpload={handleBulkExamUpload}
              handleSaveRecord={handleSaveRecord}
            />

            {/* 출력 탭 */}
            <OutputTabContent
              printOptions={printOptions}
              setPrintOptions={setPrintOptions}
              handleExportPreviewToExcel={handleExportPreviewToExcel}
              currentStudent={currentStudent}
              schoolConfig={schoolConfig}
              inputForm={inputForm}
              parsedGrowthData={parsedGrowthData}
              parsedAbilityData={parsedAbilityData}
              editedPreview={editedPreview}
              setEditedPreview={setEditedPreview}
            />
          </Tabs>
        ) : (
          <div className="h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Search className="h-10 w-10 opacity-30" />
            <span>건강기록부를 관리할 학생을 선택해 주세요.</span>
          </div>
        )}
      </CardContent>

      {/* 지정 검진기관 설정 다이얼로그 */}
      <InstitutionDialog
        isInstDialogOpen={isInstDialogOpen}
        setIsInstDialogOpen={setIsInstDialogOpen}
        generalInstInput={generalInstInput}
        setGeneralInstInput={setGeneralInstInput}
        generalInstitutions={generalInstitutions}
        setGeneralInstitutions={setGeneralInstitutions}
        dentalInstInput={dentalInstInput}
        setDentalInstInput={setDentalInstInput}
        dentalInstitutions={dentalInstitutions}
        setDentalInstitutions={setDentalInstitutions}
        handleSaveInstitutions={handleSaveInstitutions}
      />
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
