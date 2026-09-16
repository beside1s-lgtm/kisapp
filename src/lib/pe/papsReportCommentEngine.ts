/**
 * @fileOverview PAPS 학생 건강체력평가 개인별 결과 통지표 - 맞춤형 멘트 생성 엔진
 * 사전에 검증된 교육용 표준 멘트 풀에서 학생의 학년, 성별, 종목별 등급(1~5등급) 및 BMI를 분석하여
 * 우수 요인 심화 스포츠 추천과 취약 요인 놀이형 개선 멘트를 1:1로 정밀 조합합니다.
 */

import type { Student, MeasurementItem, MeasurementRecord } from './types';
import { getPapsGrade, calculatePapsScore } from './paps';

export interface PapsFactorEvaluation {
  factor: '심폐지구력' | '유연성' | '근력/근지구력' | '순발력' | '체질량지수(BMI)';
  itemName: string;
  value: number;
  unit: string;
  grade: number; // 1~5등급
  score: number; // 1~4점 (20점 만점 환산)
}

export interface PapsStudentReportData {
  student: Student;
  academicYear: string;
  measuredDate: string;
  evaluations: PapsFactorEvaluation[];
  totalScore: number; // 20점 만점
  finalGrade: string; // 1~5등급
  evaluatedCount: number;

  // 4대 맞춤형 생성 멘트
  overallComment: string; // [영역 1] 종합 등급별 총평
  strengthPraise: string; // [영역 2] 최고 성취 요인 칭찬
  advancedSportsGuide: string; // [영역 3-1] 우수 요인 심화 스포츠 추천 (1~2등급)
  playfulImprovementGuide: string; // [영역 3-2] 취약 요인 놀이/스포츠형 개선 처방 (4~5등급)
  bmiHealthGuide: string; // [영역 4] BMI 연계 체형 & 생활 가이드
}

const papsFactorsMap: Record<string, '심폐지구력' | '유연성' | '근력/근지구력' | '순발력' | '체질량지수(BMI)'> = {
  '왕복오래달리기': '심폐지구력',
  '오래달리기': '심폐지구력',
  '스텝검사': '심폐지구력',
  '윗몸 말아올리기': '근력/근지구력',
  '윗몸말아올리기': '근력/근지구력',
  '팔굽혀펴기': '근력/근지구력',
  '무릎 대고 팔굽혀펴기': '근력/근지구력',
  '악력': '근력/근지구력',
  '앉아윗몸앞으로굽히기': '유연성',
  '50m 달리기': '순발력',
  '50m달리기': '순발력',
  '제자리 멀리뛰기': '순발력',
  '제자리멀리뛰기': '순발력',
  '체질량지수(BMI)': '체질량지수(BMI)',
};

// ==========================================
// [영역 1] 종합 등급별 총평 멘트 풀
// ==========================================
const OVERALL_COMMENTS: Record<number, string[]> = {
  1: [
    "기초 체력 전 영역에서 매우 탁월한 신체 발달과 최상위권의 체력 수준을 나타내고 있습니다. 현재의 우수한 신체 밸런스를 꾸준히 유지할 수 있도록 다양한 전문 스포츠 활동을 적극 권장합니다.",
    "5대 체력 요인이 균형 있게 최고 수준으로 발달한 모범적인 체력 상태입니다. 활발한 신체 활동과 바른 생활 습관이 돋보이며, 학교 대표 스포츠 활동에서도 뛰어난 역량이 기대됩니다.",
  ],
  2: [
    "전반적으로 고르고 양호한 체력 수준을 형성하고 있습니다. 일상적인 학교 체육과 신체 활동에 적극적으로 참여하고 있으며, 기초 건강 상태가 매우 안정적입니다.",
    "대부분의 체력 종목에서 우수한 성취를 보이며 건강한 신체 발달을 이루고 있습니다. 조금만 더 지구력과 유연성을 보강하면 1등급으로의 도약이 충분히 가능합니다.",
  ],
  3: [
    "성장기 기초 체력이 표준적인 수준을 잘 유지하고 있습니다. 다만 특정 영역에 편중되지 않도록 일상 속에서 다양한 기초 운동을 꾸준히 병행하면 상위 등급으로의 향상이 기대됩니다.",
    "기본적인 신체 활동 능력을 원만하게 갖추고 있습니다. 방과 후 가벼운 유산소 운동과 근력 보강을 꾸준히 실천하면 더욱 활기찬 학교생활을 영위할 수 있습니다.",
  ],
  4: [
    "성장기 건강 체력 증진을 위한 지속적인 관심과 규칙적인 신체 활동 참여가 권장됩니다. 무리한 운동보다는 일상생활 속에서 친구 및 가족과 함께 즐길 수 있는 신체 놀이부터 시작해 보세요.",
    "체력 저하로 인해 쉽게 피로를 느낄 수 있으므로 기초 체력 다지기가 필요합니다. 하루 30분 이상 가볍게 땀을 흘리는 규칙적인 운동 습관을 형성하도록 격려해 주세요.",
  ],
  5: [
    "기초 체력 전반에 걸쳐 체계적인 보강과 체력 증진 프로그램 참여가 시급히 요구됩니다. 학교 체육 수업과 더불어 가정에서도 매일 규칙적인 유산소 운동과 체력 관리를 적극 실천해 주시기 바랍니다.",
    "건강 체력 유지와 바른 성장을 위해 꾸준한 체력 단련이 필수적인 상태입니다. 조급해하지 않고 놀이 중심의 신체 활동부터 점진적으로 운동량을 늘려나가는 것을 권장합니다.",
  ],
};

// ==========================================
// [영역 2] 최고 성취 요인 칭찬 멘트 풀
// ==========================================
const STRENGTH_PRAISE_MAP: Record<string, string> = {
  '심폐지구력': "심폐 기능과 전신 스태미나가 뛰어나 장시간의 운동이나 활동에도 지치지 않는 왕성한 활력과 강한 인내심을 보여주고 있습니다.",
  '유연성': "관절의 가동 범위와 신체 유연성이 뛰어나 부상 위험이 적고, 다양한 신체 동작을 부드럽고 자연스럽게 소화하는 장점이 있습니다.",
  '근력/근지구력': "상체와 코어 근력이 단단하게 발달하여 바른 자세 유지와 힘을 쓰는 복합 신체 동작에서 탁월한 기량을 발휘합니다.",
  '순발력': "순간적인 반응 속도와 점프력, 민첩성이 매우 돋보이며 빠르고 날렵한 움직임을 요구하는 스포츠 활동에서 두각을 나타냅니다.",
  '체질량지수(BMI)': "신장과 체중의 비율이 이상적인 표준 체형을 이루고 있어, 체력 발달에 가장 적합한 건강한 신체 기반을 갖추고 있습니다.",
};

// ==========================================
// [영역 3-1] 우수 요인 심화 스포츠 추천 (1~2등급, 학년 수준별 세분화)
// ==========================================
function getAdvancedSportsGuide(factor: string, grade: number): string {
  const isHighGrade = grade >= 5; // 5~6학년 고학년

  switch (factor) {
    case '심폐지구력':
      return isHighGrade
        ? "탁월한 심폐 기능을 바탕으로 인터벌 러닝이나 셔틀런 페이스 조절 훈련을 병행하면 심폐 한계를 더욱 높일 수 있습니다. 축구, 농구, 장거리 수영, 배구 등 활동량이 많은 교내외 스포츠 클럽 활동을 적극 추천합니다."
        : "우수한 심폐 지구력을 발전시키기 위해 왕복 달리기 챌린지나 키즈 러닝 클럽, 수영 레슨을 추천합니다. 축구 풋살 클럽이나 줄넘기 급수 도전 등을 통해 심폐 능력을 즐겁게 강화할 수 있습니다.";

    case '유연성':
      return isHighGrade
        ? "관절 가동 범위가 매우 넓어 부상 방지에 유리한 조건을 갖추고 있습니다. 체조, 요가, 필라테스 동작이나 기계체조의 응용 동작을 통해 유연성에 근력을 결합한 '동적 가동성(Mobility)'을 키우면 기량이 배가됩니다."
        : "부드러운 신체 조건을 더욱 살릴 수 있도록 태권도 품새, 리듬 체조, 방송댄스, 발레/현대무용 활동을 추천합니다. 유연성을 바탕으로 한 표현 활동에서 뛰어난 두각을 나타낼 수 있습니다.";

    case '근력/근지구력':
      return isHighGrade
        ? "코어와 상체 지지력이 탄탄하므로 맨몸 운동 난이도를 높여 정자세 턱걸이(풀업), 중량 스쿼트, 딥스 등에 도전해 보세요. 볼더링(실내 클라이밍), 기계체조, 유도처럼 전신 근협응력을 요구하는 종목에서 두각을 나타낼 수 있습니다."
        : "단단한 코어 힘을 바탕으로 어린이 인공암벽 클라이밍, 철봉 정복 챌린지, 키즈 기계체조 활동을 추천합니다. 전신 근력을 협응시키는 운동을 통해 골격 성장을 촉진할 수 있습니다.";

    case '순발력':
      return isHighGrade
        ? "폭발적인 탄력과 반응성을 보유하고 있어 플라이오메트릭(박스 점프, 바운딩 훈련) 훈련을 적용하면 점프력과 대시 속도를 극대화할 수 있습니다. 배드민턴, 육상 단거리, 배구 스파이크, 넷볼, 킨볼 동작에서 뛰어난 기량을 발휘하기 좋습니다."
        : "뛰어난 순발력과 민첩성을 극대화하기 위해 배드민턴 랠리, 태권도 겨루기 스텝 훈련, 트랙 단거리 스프린트, 피구 공격수 활동 등을 추천합니다. 빠른 판단력과 움직임이 빛날 수 있습니다.";

    default:
      return "표준 체력 전 영역이 우수하게 발달하고 있으므로, 축구·농구·배구·배드민턴 등 다양한 구기 스포츠 클럽에 참여하여 전술 이해도와 팀워크를 키워보길 권장합니다.";
  }
}

// ==========================================
// [영역 3-2] 취약 요인 흥미 중심 처방 멘트 (4~5등급, 학년 수준별 세분화)
// ==========================================
function getPlayfulImprovementGuide(factor: string, grade: number): string {
  const isHighGrade = grade >= 5;

  switch (factor) {
    case '심폐지구력':
      return isHighGrade
        ? "반복적인 달리기보다는 신나는 비트 음악에 맞춘 '음악 줄넘기 챌린지', 친구들과 팀을 이뤄 즐기는 풋살·피구 게임, 주말 한강/공원 자전거 라이딩처럼 즐겁게 숨이 차는 유산소 놀이부터 가볍게 시작해 보세요."
        : "지루한 달리기 대신 신나는 음악에 맞춘 줄넘기 놀이, 얼음땡·꼬리잡기 등 친구들과 뛰노는 전신 놀이, 트램펄린(방방) 타기처럼 자연스럽게 숨이 차는 신체 놀이를 추천합니다.";

    case '유연성':
      return isHighGrade
        ? "무리하게 몸을 숙이면 통증과 거부감이 생길 수 있으므로, 따뜻한 샤워 직후 음악을 들으며 동물 흉내 내기(고양이·개구리 자세), 폼롤러 전신 이완 마사지, 유튜브 스트레칭 챌린지를 통해 매일 10분씩 몸을 부드럽게 늘려주는 습관을 들여보세요."
        : "몸을 억지로 굽히기보다 목욕 후 가족과 함께하는 '동물 자세 스트레칭 놀이(기린 목 늘리기, 고양이 허리 펴기)', 훌라후프 놀이 등을 통해 놀이처럼 유연성을 길러주세요.";

    case '근력/근지구력':
      return isHighGrade
        ? "단순 반복 운동 대신 클라이밍 볼더링 체험, 학교 놀이터 철봉 오래 매달리기 배틀, 친구와 손바닥 밀치기 게임 등 흥미 위주의 근력 놀이를 추천합니다. 가정에서는 벽에 등을 대고 버티는 '투명 의자 버티기 내기'나 플랭크 챌린지도 좋은 시작입니다."
        : "힘든 팔굽혀펴기 대신 놀이터 정글짐 오르기, 철봉 매달려 초 세기 시합, 베개 밀치기 놀이, 계단 두 칸씩 리듬 타고 오르기 등 재미있는 놀이 속에서 자연스럽게 팔과 다리 힘을 키울 수 있습니다.";

    case '순발력':
      return isHighGrade
        ? "측정 종목에 대한 부담을 줄이기 위해 트램펄린 점프, 댄스 챌린지(K-POP 안무 배우기), 반응 속도 터치 게임(탭 라이트), 배드민턴 셔틀콕 튕기기 등 순간적인 리듬감과 탄력을 쓰는 흥미 활동을 권장합니다."
        : "반응 속도를 키우는 '신호등 점프 놀이', 트램펄린(점핑 파크) 놀이, 제자리 뜀뛰기 게임, 탁구공 튕겨 받기 등 놀이형 반응 훈련을 통해 순발력에 대한 자신감을 심어주세요.";

    default:
      return "기초 체력 향상을 위해 가족과 함께하는 저녁 식후 30분 산책, 주말 배드민턴 치기, 줄넘기 100개 챌린지 등 일상 속 작은 신체 활동 루틴부터 실천해 보세요.";
  }
}

// ==========================================
// [영역 4] BMI 연계 생활 & 체형 가이드 세분화
// ==========================================
function getBmiHealthGuide(bmiValue: number, gender: string): string {
  if (!bmiValue || bmiValue === 0) {
    return "성장기 균형 잡힌 영양 섭취와 규칙적인 수면 습관을 통해 건강한 신체 발달 기반을 튼튼히 유지해 주세요.";
  }

  // 대략적인 소아청소년 비만도 기준 (초등 4~6학년 일반 기준: 14 미만 저체중, 23 이상 과체중, 25 이상 비만)
  if (bmiValue >= 24) {
    return "체중 감량을 '힘든 운동'으로 접근하기보다 주말 가족 트레킹, 댄스 게임(저스트 댄스 등), 수영 등 관절에 부담이 적고 칼로리 소모가 큰 신체 놀이를 규칙적인 가족 루틴으로 만들어 주세요. 기름진 야식과 탄산음료를 줄이는 건강한 식습관도 함께 권장합니다.";
  }
  if (bmiValue >= 22) {
    return "체격이 다부지고 건장한 편이므로, 활동량이 많은 구기 스포츠와 유산소 신체 활동을 통해 근육량을 늘리고 체지방을 건강하게 관리해 주시기 바랍니다.";
  }
  if (bmiValue <= 14.5) {
    return "에너지 소모 대비 섭취량이 부족할 수 있으므로, 규칙적인 세 끼 식사와 함께 양질의 단백질 간식(달걀, 우유, 견과류)을 보충하고 코어 자극 운동(브릿지, 네발기기 자세)을 통해 골격과 근육이 바르게 자리잡도록 도와주세요.";
  }
  return "신장과 체중의 비율이 안정적인 표준 체형을 유지하고 있습니다. 규칙적인 아침 식사와 하루 8시간 이상의 충분한 숙면을 통해 성장기 건강 밸런스를 계속 유지해 주세요.";
}

/**
 * 개별 학생의 PAPS 리포트 전체 데이터 및 4대 멘트를 자동 생성
 */
export function buildPapsStudentReport(
  student: Student,
  allItems: MeasurementItem[],
  allRecords: MeasurementRecord[],
  academicYear: string = '2026'
): PapsStudentReportData {
  const studentRecords = allRecords.filter(r => r.studentId === student.id);
  const evaluations: PapsFactorEvaluation[] = [];

  const factors: ('심폐지구력' | '유연성' | '근력/근지구력' | '순발력' | '체질량지수(BMI)')[] = [
    '심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)'
  ];

  let totalScore = 0;
  let evaluatedCount = 0;
  let latestDate = '-';

  factors.forEach(f => {
    // 해당 요인에 해당하는 종목 찾기
    const matchingItems = allItems.filter(i => {
      const mappedFactor = papsFactorsMap[i.name] || i.category;
      return mappedFactor === f;
    });

    let bestRec: MeasurementRecord | null = null;
    let matchedItem: MeasurementItem | null = null;

    for (const item of matchingItems) {
      const recs = studentRecords.filter(r => r.item === item.name || (r as any).itemId === item.id);
      if (recs.length > 0) {
        const latest = recs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (!bestRec || new Date(latest.date) > new Date(bestRec.date)) {
          bestRec = latest;
          matchedItem = item;
        }
      }
    }

    if (bestRec) {
      const rec = bestRec;
      const itemName: string = matchedItem ? matchedItem.name : rec.item;
      const unit: string = matchedItem ? matchedItem.unit : '';
      const rawGrade = getPapsGrade(itemName, student, rec.value);
      const rawScore = calculatePapsScore(itemName, student, rec.value);
      const grade = rawGrade !== null ? rawGrade : 0;
      const score = rawScore !== null ? rawScore : 0;
      
      evaluations.push({
        factor: f,
        itemName,
        value: rec.value,
        unit,
        grade,
        score
      });

      totalScore += score;
      if (grade > 0) evaluatedCount++;
      if (rec.date > latestDate) {
        latestDate = rec.date;
      }
    } else {
      // 미측정 항목
      evaluations.push({
        factor: f,
        itemName: f === '체질량지수(BMI)' ? '체질량지수(BMI)' : f === '심폐지구력' ? '왕복오래달리기' : f === '유연성' ? '앉아윗몸앞으로굽히기' : f === '근력/근지구력' ? '악력' : '50m달리기',
        value: 0,
        unit: '',
        grade: 0,
        score: 0
      });
    }
  });

  // 최종 등급 산출 (100점 만점 기준: 1등급 80점↑, 2등급 60점↑, 3등급 40점↑, 4등급 20점↑, 5등급 20점↓)
  let finalGradeNum = 5;
  let finalGradeText = '-';
  if (evaluatedCount > 0) {
    if (totalScore >= 80) { finalGradeNum = 1; finalGradeText = '1등급'; }
    else if (totalScore >= 60) { finalGradeNum = 2; finalGradeText = '2등급'; }
    else if (totalScore >= 40) { finalGradeNum = 3; finalGradeText = '3등급'; }
    else if (totalScore >= 20) { finalGradeNum = 4; finalGradeText = '4등급'; }
    else { finalGradeNum = 5; finalGradeText = '5등급'; }
  }

  // [영역 1] 종합 총평 멘트
  const commentList = OVERALL_COMMENTS[finalGradeNum] || OVERALL_COMMENTS[3];
  const charSum = (student.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const overallComment = commentList[charSum % commentList.length];

  // [영역 2] 최고 성취 요인 & [영역 3-1] 우수 심화 요인
  // 등급이 가장 좋은(숫자가 작은) 요인 추출 (1~2등급 우선)
  const validEvals = evaluations.filter(e => e.grade >= 1 && e.grade <= 5);
  const sortedByBest = [...validEvals].sort((a, b) => a.grade - b.grade);
  const bestEval = sortedByBest[0];

  const strengthPraise = bestEval && bestEval.grade <= 3
    ? STRENGTH_PRAISE_MAP[bestEval.factor] || STRENGTH_PRAISE_MAP['심폐지구력']
    : "기초 체력의 전반적인 기반을 갖추고 있으며, 지속적인 운동을 통해 잠재력을 발휘할 수 있습니다.";

  const studentGradeNum = Number(student.grade) || 5;
  const bestFactorForAdv = bestEval && bestEval.grade <= 2 ? bestEval.factor : (bestEval?.factor || '심폐지구력');
  const advancedSportsGuide = getAdvancedSportsGuide(bestFactorForAdv, studentGradeNum);

  // [영역 3-2] 최저/취약 요인 (4~5등급 우선) 놀이형 개선 멘트
  const sortedByWorst = [...validEvals].sort((a, b) => b.grade - a.grade);
  const worstEval = sortedByWorst[0];
  const worstFactor = worstEval && worstEval.grade >= 3 ? worstEval.factor : '심폐지구력';
  const playfulImprovementGuide = getPlayfulImprovementGuide(worstFactor, studentGradeNum);

  // [영역 4] BMI 가이드
  const bmiEval = evaluations.find(e => e.factor === '체질량지수(BMI)');
  const bmiHealthGuide = getBmiHealthGuide(bmiEval?.value || 0, student.gender || '남');

  return {
    student,
    academicYear,
    measuredDate: latestDate !== '-' ? latestDate : new Date().toISOString().split('T')[0],
    evaluations,
    totalScore,
    finalGrade: finalGradeText,
    evaluatedCount,
    overallComment,
    strengthPraise,
    advancedSportsGuide,
    playfulImprovementGuide,
    bmiHealthGuide,
  };
}
