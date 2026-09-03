/**
 * @fileOverview 체육 성장 기록 시스템 - 룰 기반 고속 진단 & 스카우팅 리포트 엔진
 * AI LLM API 호출 지연을 제거하고, 측정 결과값을 즉시 분석하여 고품질 리포트를 0초 만에 생성합니다.
 */

import type { MeasurementItem } from './types';

export interface AbilityScoreInput {
  item: string;
  score: number;
  category?: string;
  value?: number;
  unit?: string;
  grade?: number;
  rank?: number;
  totalInGrade?: number;
}

export interface ScoutingReportResult {
  strengths: string;
  weaknesses: string;
  assessment: string;
  position: string;
  suggestedTrainingMethods: string;
}

export interface DashboardBriefingResult {
  briefing: string;
  advice: string;
}

/**
 * 종목명으로부터 체력 요소를 추출합니다.
 */
function getItemElement(itemName: string): { element: string; elementGroup: string } {
  const norm = itemName.replace(/\s+/g, '');
  if (norm.includes('협응성') || norm.includes('공튀기기') || norm.includes('저글링') || norm.includes('벽패스')) {
    return { element: '협응성 및 감각 조절', elementGroup: 'coordination' };
  }
  if (norm.includes('50m') || norm.includes('제자리멀리뛰기') || norm.includes('서전트') || norm.includes('순발력')) {
    return { element: '순발력 및 스프린트 스피드', elementGroup: 'agility' };
  }
  if (norm.includes('왕복오래달리기') || norm.includes('오래달리기') || norm.includes('스텝') || norm.includes('심폐지구력')) {
    return { element: '심폐지구력 및 전신 스태미나', elementGroup: 'cardio' };
  }
  if (norm.includes('윗몸말아올리기') || norm.includes('팔굽혀펴기') || norm.includes('악력') || norm.includes('근력') || norm.includes('근지구력')) {
    return { element: '근력 및 코어 파워', elementGroup: 'strength' };
  }
  if (norm.includes('앉아윗몸') || norm.includes('유연성') || norm.includes('굽히기')) {
    return { element: '관절 가동 범위 및 유연성', elementGroup: 'flexibility' };
  }
  if (norm.includes('BMI') || norm.includes('체질량')) {
    return { element: '신체 조성 및 체질량 지수', elementGroup: 'bmi' };
  }
  return { element: itemName, elementGroup: 'general' };
}

/**
 * 개별 학생 스카우팅 리포트를 룰 기반으로 즉시 생성합니다.
 */
export function generateStudentScoutingReport(
  studentName: string,
  abilityScores: AbilityScoreInput[],
  allItems: MeasurementItem[]
): ScoutingReportResult {
  // 유효한 측정 데이터가 없는 경우
  if (!abilityScores || abilityScores.length === 0) {
    return {
      strengths: '분석할 데이터가 부족합니다.',
      weaknesses: '분석할 데이터가 부족합니다.',
      assessment: '분석할 데이터가 부족합니다.',
      position: '분석할 데이터가 부족합니다.',
      suggestedTrainingMethods: '분석할 데이터가 부족합니다.',
    };
  }

  // 1. BMI 정보 추출
  const bmiItem = abilityScores.find(a => a.item.includes('BMI') || a.item.includes('체질량'));
  const rawBmi = bmiItem?.value || 0;
  const isHeavyBuild = rawBmi >= 24;

  // 2. BMI를 제외한 순수 체력 종목 점수 정렬
  const physicalScores = abilityScores.filter(a => !a.item.includes('BMI') && !a.item.includes('체질량'));
  
  if (physicalScores.length === 0) {
    return {
      strengths: '분석할 데이터가 부족합니다.',
      weaknesses: '분석할 데이터가 부족합니다.',
      assessment: '분석할 데이터가 부족합니다.',
      position: '분석할 데이터가 부족합니다.',
      suggestedTrainingMethods: '분석할 데이터가 부족합니다.',
    };
  }

  const sorted = [...physicalScores].sort((a, b) => (b.score || 0) - (a.score || 0));
  const topScores = sorted.slice(0, Math.min(2, sorted.length));
  const lowScores = sorted.length > 1 ? sorted.slice(-Math.min(2, sorted.length)).reverse() : [];

  // 각 영역별 대표 점수 계산
  const getGroupScore = (groupName: string) => {
    const items = physicalScores.filter(s => getItemElement(s.item).elementGroup === groupName);
    if (items.length === 0) return 0;
    return items.reduce((acc, cur) => acc + cur.score, 0) / items.length;
  };

  const powerScore = getGroupScore('strength');
  const speedScore = getGroupScore('agility');
  const staminaScore = getGroupScore('cardio');
  const coordScore = getGroupScore('coordination');
  const flexScore = getGroupScore('flexibility');

  // 3. 강점 분석
  const strengthLines = topScores.map(item => {
    const { element } = getItemElement(item.item);
    const scoreText = item.score >= 80 ? '학년 내 최상위권의 뛰어난 능력' : item.score >= 60 ? '안정적이고 우수한 성취' : '양호한 수준';
    const rankInfo = item.rank && item.totalInGrade ? ` (${item.totalInGrade}명 중 ${item.rank}위)` : '';
    const valText = item.value !== undefined ? ` [${item.value}${item.unit || ''}]` : '';
    return `- ${item.item}${valText}: ${element} 영역에서 ${scoreText}${rankInfo}을 보이고 있습니다.`;
  });

  // 4. 보완점 분석
  let weaknessLines: string[] = [];
  if (lowScores.length > 0 && lowScores[0].item !== topScores[0].item) {
    weaknessLines = lowScores
      .filter(item => !topScores.some(t => t.item === item.item))
      .map(item => {
        const { element } = getItemElement(item.item);
        const valText = item.value !== undefined ? ` [${item.value}${item.unit || ''}]` : '';
        return `- ${item.item}${valText}: ${element} 영역이 상대적으로 보완이 필요하며, 집중적인 훈련 시 빠른 향상이 기대됩니다.`;
      });
  }
  if (weaknessLines.length === 0) {
    weaknessLines = ['- 전 종목에서 균형 잡힌 기량을 유지하고 있어 특별한 취약 영역이 관찰되지 않습니다.'];
  }

  // 5. 선수 유형(종합 진단) 및 추천 포지션 판별
  let assessment = '';
  let position = '';
  let training = '';

  // 1) 체격 큼 + 근력/파워 우수 + 스피드 느림 (강수빈 학생 등 파워 앵커형)
  if (isHeavyBuild && (powerScore >= 55 || topScores.some(t => getItemElement(t.item).elementGroup === 'strength')) && speedScore < 65) {
    assessment = `탄탄하고 묵직한 체격과 강한 파워를 바탕으로 골밑과 몸싸움 경합에서 압도적인 힘을 발휘하는 '파워 앵커(Power Anchor)' 유형입니다.`;
    position = '센터 / 파워 포워드(농구), 타깃형 스트라이커 / 센터백(축구), 투포환 / 투원반(육상), 유도/씨름';
    training = '• 관절 부담 없는 심폐 유산소(실내 자전거, 수영 30분) 및 하체 밸런스·순발력 보강 점프 훈련\n• 강점인 상체·코어 파워를 유지하면서 민첩한 발놀림 스텝 훈련 병행';
  }
  // 2) 협응성 우수 (테크니션)
  else if (coordScore >= 70 || topScores.some(t => getItemElement(t.item).elementGroup === 'coordination')) {
    assessment = `정교한 볼 감각과 탁월한 신체 조절 능력을 자랑하는 기술형 '테크니션(Technician)' 유형입니다.`;
    position = '플레이메이커 미드필더(축구), 포인트 가드(농구), 세터(배구), 탁구 / 배드민턴';
    training = '• 세밀한 기술 훈련(볼 핸들링, 숏패스 릴레이) 및 순간 가속력 유지를 위한 10m 인터벌 스프린트\n• 복합 구기 종목 전술 훈련을 통한 공간 인지 능력 강화';
  }
  // 3) 스피드 + 파워 우수 (공격형 파워 플레이어)
  else if (speedScore >= 70 && powerScore >= 70) {
    assessment = `폭발적인 순발력과 탄탄한 파워를 겸비하여 공간을 파괴하는 '공격형 파워 플레이어' 유형입니다.`;
    position = '윙 포워드 / 스트라이커(축구), 스몰 포워드 / 슈팅 가드(농구), 윙 스파이커(배구)';
    training = '• 플라이오메트릭 점프 훈련(박스 점프 10회 3세트) 및 20m 숏 스프린트\n• 고강도 인터벌 러닝을 통한 후반부 체력 유지 훈련';
  }
  // 4) 스피드 우수 (스피드 드리블러)
  else if (speedScore >= 70) {
    assessment = `순간 가속력과 기민한 방향 전환 능력이 돋보이는 '스피드 드리블러' 유형입니다.`;
    position = '윙어(축구), 가드(농구), 단거리 스프린터';
    training = '• 민첩성 사다리 스텝 훈련 및 코어 지지력 강화를 위한 플랭크(30초 3세트)\n• 순간적인 턴과 방향 전환 반응 속도 훈련';
  }
  // 5) 심폐지구력 우수 (엔진형 플레이어)
  else if (staminaScore >= 70) {
    assessment = `지치지 않는 심폐 지구력과 왕성한 활동량으로 경기장을 누비는 '엔진형 플레이어' 유형입니다.`;
    position = '중앙 미드필더 / 풀백(축구), 장거리 육상, 크로스컨트리';
    training = '• 지속주 러닝(15~20분 페이스 유지) 및 셔틀런 점진적 훈련\n• 하체 근지구력 유지를 위한 스쿼트 및 런지';
  }
  // 6) 유연성 우수 (유연형 밸런서)
  else if (flexScore >= 70) {
    assessment = `부드러운 관절 가동성과 유연한 신체 밸런스를 갖춘 '유연형 밸런서' 유형입니다.`;
    position = '체조 / 댄스 스포츠, 리베로(배구), 테크니컬 미드필더(축구)';
    training = '• 유연성을 실전 동작에 연결하는 동적 코어 운동 및 점프 후 안정적 착지 훈련\n• 근력 보강을 위한 밴드 저항 운동 병행';
  }
  // 7) 전반적 균형
  else {
    assessment = `기초 체력 전 영역이 고르게 발달한 '육각형 올라운더' 유형입니다.`;
    position = '올라운드 플레이어(축구/농구), 전술적 다목적 포지션';
    training = '• 전반적인 기초 체력 유지 및 특정 주력 종목 전술 훈련 병행\n• 주 2~3회 인터벌 트레이닝 및 서킷 트레이닝';
  }

  // 약점 훈련 처방 보강
  if (!training) {
    const weakGroups = lowScores.map(w => getItemElement(w.item).elementGroup);
    const trainingPlans: string[] = [];

    if (weakGroups.includes('cardio')) {
      trainingPlans.push('• 심폐지구력 강화: 주 3회 인터벌 달리기(20초 스프린트 후 40초 걷기, 5세트) 및 셔틀런 훈련');
    }
    if (weakGroups.includes('agility')) {
      trainingPlans.push('• 순발력/민첩성 강화: 박스 점프, 버피 점프(10회 3세트) 및 10m 왕복 전력 달리기');
    }
    if (weakGroups.includes('strength')) {
      trainingPlans.push('• 근력/근지구력 보완: 코어 플랭크(30초 3세트), 무릎 푸시업 및 철봉 매달리기');
    }
    if (weakGroups.includes('flexibility')) {
      trainingPlans.push('• 유연성 증진: 운동 전후 햄스트링, 둔근, 어깨 정적 스트레칭 10분 매일 실시');
    }
    training = trainingPlans.join('\n') || '• 기초 체력 증진을 위한 전신 유산소 및 코어 강화 운동 병행';
  }

  return {
    strengths: strengthLines.join('\n'),
    weaknesses: weaknessLines.join('\n'),
    assessment,
    position,
    suggestedTrainingMethods: training,
  };
}

/**
 * 학교/학년/학급 단위 종합 AI 브리핑을 룰 기반으로 즉시 생성합니다.
 */
export function generateDashboardBriefing(params: {
  targetName?: string;
  totalStudents: number;
  papsStats?: {
    averageGrade?: number;
    lowPerformingPercentage?: number;
    gradeDistribution?: Record<string, number>;
  };
  topItems?: { name: string; avgScore?: number; improvement?: number }[];
  weakItems?: { name: string; avgScore?: number }[];
}): DashboardBriefingResult {
  const target = params.targetName || '본 학급/학교';
  const total = params.totalStudents || 0;

  if (total === 0) {
    return {
      briefing: '분석할 데이터가 부족합니다.',
      advice: '분석할 데이터가 부족합니다.',
    };
  }

  const paps = params.papsStats;
  const g1Pct = paps?.gradeDistribution?.['1등급'] || 0;
  const g2Pct = paps?.gradeDistribution?.['2등급'] || 0;
  const g4Pct = paps?.gradeDistribution?.['4등급'] || 0;
  const g5Pct = paps?.gradeDistribution?.['5등급'] || 0;

  const topRatio = (g1Pct + g2Pct).toFixed(1);
  const lowRatio = (g4Pct + g5Pct || paps?.lowPerformingPercentage || 0).toFixed(1);
  const avgGrade = paps?.averageGrade ? paps.averageGrade.toFixed(1) : '3.0';

  const topItemName = params.topItems?.[0]?.name || '왕복오래달리기';
  const weakItemName = params.weakItems?.[0]?.name || '앉아윗몸앞으로굽히기';

  const topElement = getItemElement(topItemName).element;
  const weakElement = getItemElement(weakItemName).element;

  // 1. 브리핑 본문 구성
  let briefingParagraphs: string[] = [];

  briefingParagraphs.push(
    `[${target}] 전체 측정 대상 학생 ${total}명의 체력 측정 결과 분석 현황입니다.`
  );

  if (paps) {
    briefingParagraphs.push(
      `PAPS 종합 평균 등급은 ${avgGrade}등급 수준이며, 1·2등급 우수 학생 비율은 약 ${topRatio}%를 기록하고 있습니다. 저체력군(4·5등급) 비율은 약 ${lowRatio}%로 체계적인 맞춤 관리가 요구됩니다.`
    );
  }

  briefingParagraphs.push(
    `종목별로는 [${topItemName}](${topElement}) 영역에서 가장 높은 성취도를 나타낸 반면, [${weakItemName}](${weakElement}) 영역은 상대적인 보완이 필요한 것으로 분석되었습니다.`
  );

  // 2. 체육 수업 지도 조언(Advice) 구성
  let adviceList: string[] = [];

  adviceList.push(
    `1. 취약 영역 보완: 체육 수업 준비 운동 시 [${weakItemName}] 관련 맞춤형 스트레칭 및 코어 보강 운동(5분)을 상시 루틴으로 운영하세요.`
  );
  adviceList.push(
    `2. 우수 영역 강화: 높은 성취를 보인 [${topItemName}] 역량을 활용하여 소집단 팀 경기 및 협동 신체 활동에 주도적인 역할을 부여하세요.`
  );
  if (parseFloat(lowRatio) > 15) {
    adviceList.push(
      `3. 저체력 학생 집중 케어: 4·5등급 학생들을 위한 점진적 기초 체력 향상 프로그램(계단식 달리기, 단계별 푸시업)을 병행 지도하는 것을 권장합니다.`
    );
  } else {
    adviceList.push(
      `3. 자기주도 건강 관리: 지속적인 기록 갱신 동기부여를 위해 PAPS 성장 차트와 명예의 전당을 활용한 칭찬 체계를 유지하세요.`
    );
  }

  return {
    briefing: briefingParagraphs.join('\n\n'),
    advice: adviceList.join('\n'),
  };
}
