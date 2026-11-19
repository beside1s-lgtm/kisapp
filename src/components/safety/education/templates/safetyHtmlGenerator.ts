// 학생 안전교육 및 재난대피훈련 붙임문서 HTML 생성기
// [핵심 원칙]
// 1. 안전교육 운영 계획: A4 단 1장에 꽉 차게 완결 (불필요한 2페이지 3~4줄 쪼개짐 원천 차단)
// 2. 재난대피 훈련 계획: 균형 잡힌 2페이지 완결 (1p: 훈련개요/점검표/시간표, 2p: 수칙/층별동선/기대효과)
// 3. 인쇄 시 표 쪼개짐 방지 (page-break-inside: avoid) 및 상하단 10~15mm 안전 여백 보장

import {
  GRADE_HOURS_DATA,
  DEFAULT_PREPARATION_TASKS,
  DEFAULT_TRAINING_TIMETABLE,
  EVACUATION_RULES,
} from './safetyPlanData';
import {
  YearlyPlanTemplateData,
  EvacuationPlanTemplateData,
  DEFAULT_YEARLY_TEMPLATE,
  DEFAULT_EVACUATION_TEMPLATE,
} from '@/lib/safety/templateTypes';

// ─────────────────────────────────────────────────────────────
// 1. 공통 CSS 및 인쇄 표준 스타일
// ─────────────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; }
  
  @page {
    size: A4 portrait;
    margin: 10mm 12mm 10mm 12mm;
  }

  body {
    font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif;
    color: #1e293b;
    background-color: #f1f5f9;
    margin: 0;
    padding: 20px 10px;
    line-height: 1.5;
  }
  
  /* 화면용 카드 스타일 */
  .page {
    max-width: 800px;
    margin: 0 auto 20px auto;
    background: #ffffff;
    padding: 28px 36px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    box-sizing: border-box;
    position: relative;
  }

  /* 1페이지 완결용 A4 규격 컨테이너 */
  .page-single {
    max-width: 800px;
    margin: 0 auto;
    background: #ffffff;
    padding: 24px 34px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    box-sizing: border-box;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  /* 2페이지 분할용 */
  .page-multi {
    page-break-after: always;
    break-after: page;
  }
  .page-multi:last-child {
    page-break-after: avoid;
    break-after: avoid;
    margin-bottom: 0;
  }

  .header-decor {
    height: 3.5px;
    width: 100%;
    background: linear-gradient(to right, #e11d48 70%, #f97316 30%);
    border-radius: 2px;
    margin-bottom: 8px;
  }
  .header-decor-blue {
    height: 3.5px;
    width: 100%;
    background: linear-gradient(to right, #2563eb 70%, #06b6d4 30%);
    border-radius: 2px;
    margin-bottom: 8px;
  }
  .header-title {
    font-size: 19px;
    font-weight: 900;
    text-align: center;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 2px;
  }
  .school-name {
    text-align: right;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 10px;
  }
  .section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #1e293b;
    color: #ffffff;
    font-weight: 800;
    font-size: 11.5px;
    padding: 2px 10px;
    border-radius: 5px;
    margin-top: 10px;
    margin-bottom: 5px;
  }
  .sub-title {
    font-size: 11.5px;
    font-weight: 800;
    color: #0f172a;
    margin: 4px 0 3px 0;
  }
  p, li {
    font-size: 11px;
    line-height: 1.55;
    color: #334155;
    margin: 2px 0;
  }
  .indent-1 { margin-left: 6px; }
  
  table.custom-table {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
    font-size: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table.custom-table th, table.custom-table td {
    border: 1px solid #cbd5e1;
    padding: 3px 4px;
    text-align: center;
  }
  table.custom-table th {
    background-color: #f8fafc;
    font-weight: 700;
    color: #0f172a;
  }
  .notice-box {
    background-color: #fefce8;
    border-left: 3.5px solid #eab308;
    padding: 6px 10px;
    margin: 6px 0;
    border-radius: 4px;
    font-size: 11px;
    color: #713f12;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .info-box {
    background-color: #eff6ff;
    border-left: 3.5px solid #2563eb;
    padding: 6px 10px;
    margin: 6px 0;
    border-radius: 4px;
    font-size: 11px;
    color: #1e3a8a;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .avoid-break {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 12px;
  }
  .print-btn {
    background: #e11d48;
    color: white;
    border: none;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 800;
    border-radius: 7px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(225,29,72,0.3);
    transition: all 0.2s;
  }
  .print-btn:hover { background: #be123c; }
  .print-btn-blue {
    background: #2563eb;
    color: white;
    border: none;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 800;
    border-radius: 7px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(37,99,235,0.3);
    transition: all 0.2s;
  }
  .print-btn-blue:hover { background: #1d4ed8; }

  @media print {
    body {
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .page-single {
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 4mm 6mm !important;
      margin: 0 !important;
      max-width: 100% !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .page-multi {
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 6mm 6mm !important;
      margin: 0 !important;
      max-width: 100% !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .page-multi:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .print-btn-container { display: none !important; }
    table, tr, td, th {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// 2. [서식 1] 2026학년도 학생 안전교육 운영 계획 (기안문 본문)
// ─────────────────────────────────────────────────────────────
export function getYearlyDraftContent(
  year: string,
  semester: string,
  customTpl?: YearlyPlanTemplateData
): string {
  const tpl = customTpl || DEFAULT_YEARLY_TEMPLATE;
  const legal = tpl.legalBasis || '초·중등교육법 제23조 및 학교안전사고 예방 및 보상에 관한 법률 제8조';
  const target = tpl.targetGrades || '초등 1~6학년 전교생';
  const tasks = tpl.tasks && tpl.tasks.length > 0 ? tpl.tasks : DEFAULT_YEARLY_TEMPLATE.tasks;

  const tasksHtml = tasks
    .map(
      (t, idx) =>
        `<p style="line-height: 1.8; margin-bottom: 4px; font-weight: normal; margin-left: 32px;">${idx + 1}) &nbsp;${t.category}: ${t.details}</p>`
    )
    .join('');

  return (
    `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">1. &nbsp;관련: ${legal}</p>` +
    `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">2. &nbsp;${year}학년도 학생 안전교육 운영 계획을 붙임과 같이 수립하여 실시하고자 합니다.</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">가. &nbsp;운영 기간: ${year}. 3. ~ ${parseInt(year) + 1}. 2. (연중)</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">나. &nbsp;대상: ${target}</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">다. &nbsp;주요 내용</p>` +
    tasksHtml +
    `<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 24px; margin-bottom: 6px; line-height: 1.8;" class="attachment-table">` +
    `<tbody>` +
    `<tr><td style="vertical-align: top; width: 36px; border: none; padding: 0 8px 3px 0; white-space: nowrap; font-weight: normal;">붙임</td><td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal;">1. &nbsp;${year}학년도 학생 안전교육 운영 계획 1부. &nbsp;&nbsp;끝.</td></tr>` +
    `</tbody></table>`
  );
}

// ─────────────────────────────────────────────────────────────
// 3. [서식 1] 학생 안전교육 운영 계획 붙임문서 (★ A4 1장에 꽉 차게 100% 완결 ★)
// ─────────────────────────────────────────────────────────────
export function generateYearlyPlanAttachmentHtml(
  year: string,
  semester: string,
  customTpl?: YearlyPlanTemplateData
): string {
  const tpl = customTpl || DEFAULT_YEARLY_TEMPLATE;
  const goals = tpl.goals && tpl.goals.length > 0 ? tpl.goals : DEFAULT_YEARLY_TEMPLATE.goals;
  const effects = tpl.expectedEffects && tpl.expectedEffects.length > 0 ? tpl.expectedEffects : DEFAULT_YEARLY_TEMPLATE.expectedEffects;
  const tasks = tpl.tasks && tpl.tasks.length > 0 ? tpl.tasks : DEFAULT_YEARLY_TEMPLATE.tasks;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${year}학년도 학생 안전교육 운영 계획</title>
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>

  <!-- A4 단 1장 완결 컨테이너 (여백 낭비 및 2페이지 쪼개짐 원천 차단) -->
  <div class="page-single">
    <div class="header-decor"></div>
    <div class="header-title">${year}학년도 학생 안전교육 운영 계획</div>
    <div class="school-name">호치민시한국국제학교 (초등)</div>

    <!-- 1. 목적 -->
    <div class="section-badge" style="margin-top: 4px;">1 &nbsp;목 적</div>
    ${goals.map((g) => `<p class="indent-1">• ${g}</p>`).join('')}

    <!-- 2. 방침 -->
    <div class="section-badge">2 &nbsp;방 침</div>
    ${tasks.map((t, idx) => `<p class="indent-1">${String.fromCharCode(44032 + idx)}. <strong>${t.category}:</strong> ${t.details}</p>`).join('')}

    <!-- 3. 시수표 (컴팩트하게 최적화) -->
    <div class="section-badge">3 &nbsp;안전교육 7대 표준 영역별 기준 시수 및 학년별 편성표</div>
    <p class="indent-1" style="font-size: 10px; color: #64748b; margin-bottom: 3px;">
      ※ 초등 1~6학년 전 학년 연간 51~52차시 편성 (교육부 안전교육 기준 100% 충족)
    </p>

    <table class="custom-table avoid-break" style="margin-bottom: 6px;">
      <thead>
        <tr>
          <th rowspan="2" style="width: 12%;">구분</th>
          <th colspan="7">안전교육 7대 표준 영역</th>
          <th rowspan="2" style="width: 11%;">연간<br/>합계</th>
        </tr>
        <tr style="font-size: 9.5px;">
          <th>생활안전</th>
          <th>교통안전</th>
          <th>폭력·신변</th>
          <th>약물·중독</th>
          <th>재난안전</th>
          <th>직업안전</th>
          <th>응급처치</th>
        </tr>
        <tr style="background-color: #f1f5f9; font-weight: 800; color: #be123c;">
          <td>기준시수</td>
          <td>12</td>
          <td>11</td>
          <td>8</td>
          <td>10</td>
          <td>6</td>
          <td>2</td>
          <td>2</td>
          <td>51~52</td>
        </tr>
      </thead>
      <tbody>
        ${GRADE_HOURS_DATA.map(
          (g) => `
          <tr>
            <td rowspan="2" style="font-weight: 700; background: #fafafa;">${g.grade}학년</td>
            <td>${g.semester1.life}</td>
            <td>${g.semester1.traffic}</td>
            <td>${g.semester1.violence}</td>
            <td>${g.semester1.drugCyber}</td>
            <td>${g.semester1.disaster}</td>
            <td>${g.semester1.job}</td>
            <td>${g.semester1.firstAid}</td>
            <td rowspan="2" style="font-weight: 800; background: #f8fafc;">${
              g.semester1.life +
              g.semester1.traffic +
              g.semester1.violence +
              g.semester1.drugCyber +
              g.semester1.disaster +
              g.semester1.job +
              g.semester1.firstAid +
              g.semester2.life +
              g.semester2.traffic +
              g.semester2.violence +
              g.semester2.drugCyber +
              g.semester2.disaster +
              g.semester2.job +
              g.semester2.firstAid
            }차시</td>
          </tr>
          <tr style="background: #ffffff; color: #475569;">
            <td>${g.semester2.life}</td>
            <td>${g.semester2.traffic}</td>
            <td>${g.semester2.violence}</td>
            <td>${g.semester2.drugCyber}</td>
            <td>${g.semester2.disaster}</td>
            <td>${g.semester2.job}</td>
            <td>${g.semester2.firstAid}</td>
          </tr>
        `
        ).join('')}
      </tbody>
    </table>

    <!-- 4. 재난대피 훈련 및 가정연계 지도 계획 (2열 컴팩트 배치) -->
    <div class="section-badge">4 &nbsp;재난대피 훈련 및 가정연계 지도 계획</div>
    <div class="avoid-break" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 3px;">
      <div>
        <div class="sub-title">가. 재난대피 훈련 계획 (연 2회)</div>
        <table class="custom-table" style="margin: 0;">
          <thead>
            <tr><th>구분</th><th>시기</th><th>훈련 내용</th><th>방법</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 700;">지진대피</td>
              <td>1학기 (5월)</td>
              <td style="text-align: left;">${tpl.evacuationSummary?.earthquake || '지진 발생 시 행동요령 숙달'}</td>
              <td rowspan="2">전교 방송 및<br/>실제 대피로<br/>이동 훈련</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">화재대피</td>
              <td>2학기 (10월)</td>
              <td style="text-align: left;">${tpl.evacuationSummary?.fire || '화재 대피 및 소화기 사용법'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div class="sub-title">나. 가정 연계 안전지도 계획</div>
        <table class="custom-table" style="margin: 0;">
          <thead>
            <tr><th>구분</th><th>시기</th><th>지도 내용</th><th>방법</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 700;">폭염사고</td>
              <td>여름방학 전</td>
              <td style="text-align: left;">${tpl.homeLinkSummary?.heatwave || '무더위 상식, 외출 전/후 수칙'}</td>
              <td rowspan="2">가정통신문<br/>발송 및<br/>온라인 안내</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">가정생활</td>
              <td>겨울방학 전</td>
              <td style="text-align: left;">${tpl.homeLinkSummary?.homeLiving || '전기안전, 낙상, 화상 예방'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 5. 기대 효과 -->
    <div class="section-badge">5 &nbsp;기대 효과</div>
    <div class="avoid-break" style="margin-top: 1px;">
      ${effects.map((e) => `<p class="indent-1">○ ${e}</p>`).join('')}
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 4. [서식 2] 2026학년도 재난(지진/화재) 대피 훈련 실시 계획 (기안문 본문)
// ─────────────────────────────────────────────────────────────
export function getEvacuationDraftContent(
  year: string,
  semester: string,
  disasterType: string,
  dateTime: string,
  location: string,
  customTpl?: EvacuationPlanTemplateData
): string {
  const month = semester.includes('2학기') ? '10' : '5';
  const tpl = customTpl || DEFAULT_EVACUATION_TEMPLATE;
  const legal = tpl.legalBasis || `${year}학년도 학생 안전교육 운영 계획`;

  return (
    `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">1. &nbsp;관련: ${legal}</p>` +
    `<p style="line-height: 1.8; margin-bottom: 8px; font-weight: normal; margin-left: 0px;">2. &nbsp;${year}학년도 초등교육과정 및 안전교육 운영 계획에 의거하여, ${month}월 재난대피훈련을 다음과 같이 실시하고자 합니다.</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">가. &nbsp;일 &nbsp; 시: ${dateTime}</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">나. &nbsp;장 &nbsp; 소: ${location}</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">다. &nbsp;내 &nbsp; 용: ${disasterType} 대피 훈련 사전교육 및 전교생 실제 대피로 이동 훈련</p>` +
    `<p style="line-height: 1.8; margin-bottom: 6px; font-weight: normal; margin-left: 16px;">라. &nbsp;세부 내용: 붙임 참조</p>` +
    `<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 24px; margin-bottom: 6px; line-height: 1.8;" class="attachment-table">` +
    `<tbody>` +
    `<tr><td style="vertical-align: top; width: 36px; border: none; padding: 0 8px 3px 0; white-space: nowrap; font-weight: normal;">붙임</td><td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal;">1. &nbsp;${year}학년도 ${disasterType} 대피 훈련 실시 계획 1부. &nbsp;&nbsp;끝.</td></tr>` +
    `</tbody></table>`
  );
}

// ─────────────────────────────────────────────────────────────
// 5. [서식 2] 재난대피 훈련 계획 붙임문서 (균형 잡힌 2페이지 완결)
// ─────────────────────────────────────────────────────────────
export function generateEvacuationPlanAttachmentHtml(
  year: string,
  semester: string,
  disasterType: string,
  dateTime: string,
  location: string,
  customTpl?: EvacuationPlanTemplateData
): string {
  const month = semester.includes('2학기') ? '10' : '5';
  const tpl = customTpl || DEFAULT_EVACUATION_TEMPLATE;
  const objectives = tpl.objectives && tpl.objectives.length > 0 ? tpl.objectives : DEFAULT_EVACUATION_TEMPLATE.objectives;
  const guidelines = tpl.guidelines && tpl.guidelines.length > 0 ? tpl.guidelines : DEFAULT_EVACUATION_TEMPLATE.guidelines;
  const prepTasks = tpl.prepTasks && tpl.prepTasks.length > 0 ? tpl.prepTasks : DEFAULT_PREPARATION_TASKS;
  const timeTable = tpl.timeTable && tpl.timeTable.length > 0 ? tpl.timeTable : DEFAULT_TRAINING_TIMETABLE;
  const rules = tpl.rules && tpl.rules.length > 0 ? tpl.rules : EVACUATION_RULES;
  const floorRoutes = tpl.floorRoutes || DEFAULT_EVACUATION_TEMPLATE.floorRoutes;
  const effects = tpl.expectedEffects && tpl.expectedEffects.length > 0 ? tpl.expectedEffects : DEFAULT_EVACUATION_TEMPLATE.expectedEffects;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${year}학년도 ${disasterType} 대피 훈련 실시 계획</title>
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn-blue" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>

  <!-- ═══════════════════════════════════════════════════════ -->
  <!-- 📄 페이지 1: 훈련 개요, 목적/방침, 사전준비표, 당일 타임테이블 -->
  <!-- ═══════════════════════════════════════════════════════ -->
  <div class="page page-multi">
    <div class="header-decor-blue"></div>
    <div class="header-title">${year}학년도 ${disasterType} 대피 훈련 실시 계획</div>
    <div class="school-name">${year}. ${month}. &nbsp;|&nbsp; 호치민시한국국제학교 (초등) &nbsp;|&nbsp; 1 / 2</div>

    <div class="section-badge">1 &nbsp;훈련 개요</div>
    <div class="info-box avoid-break">
      <div>• <strong>일 &nbsp; 시 :</strong> &nbsp;${dateTime}</div>
      <div>• <strong>장 &nbsp; 소 :</strong> &nbsp;${location}</div>
      <div>• <strong>대 &nbsp; 상 :</strong> &nbsp;초등 1~6학년 전교생 및 교직원 전원</div>
      <div>• <strong>내 &nbsp; 용 :</strong> &nbsp;${disasterType} 발생 시 행동 요령 사전교육 및 실제 지정 대피로 이동 훈련</div>
    </div>

    <div class="avoid-break" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
      <div>
        <div class="sub-title">가. 훈련 목적 및 근거</div>
        ${objectives.map((o) => `<p class="indent-1">• ${o}</p>`).join('')}
        <p class="indent-1">• 근거: ${tpl.legalBasis || `${year}학년도 호치민시한국국제학교 초등교육과정`}</p>
      </div>

      <div>
        <div class="sub-title">나. 기본 방침</div>
        ${guidelines.map((g) => `<p class="indent-1">• ${g.replace(/\{disasterType\}/g, disasterType)}</p>`).join('')}
      </div>
    </div>

    <div class="section-badge">2 &nbsp;사전 준비 목록 및 점검표</div>
    <table class="custom-table avoid-break">
      <thead>
        <tr>
          <th style="width: 8%;">순</th>
          <th style="width: 22%;">구 분</th>
          <th style="width: 44%;">내 용</th>
          <th style="width: 14%;">추진일정</th>
          <th style="width: 12%;">담당</th>
        </tr>
      </thead>
      <tbody>
        ${prepTasks.map(
          (t, idx) => `
          <tr>
            <td>${t.no || idx + 1}</td>
            <td style="font-weight: 700;">${t.title}</td>
            <td style="text-align: left;">${t.content}</td>
            <td>${t.schedule}</td>
            <td style="font-weight: 600;">${t.manager}</td>
          </tr>
        `
        ).join('')}
      </tbody>
    </table>

    <div class="section-badge">3 &nbsp;당일 일정 및 타임테이블</div>
    <table class="custom-table avoid-break">
      <thead>
        <tr>
          <th style="width: 8%;">순</th>
          <th style="width: 22%;">구 분</th>
          <th style="width: 16%;">시 간</th>
          <th style="width: 38%;">내 용</th>
          <th style="width: 16%;">담당</th>
        </tr>
      </thead>
      <tbody>
        ${timeTable.map(
          (t, idx) => `
          <tr>
            <td>${t.no || idx + 1}</td>
            <td style="font-weight: 700;">${t.stage}</td>
            <td style="font-weight: 800; color: #2563eb;">${t.time}</td>
            <td style="text-align: left;">${t.content}</td>
            <td>${t.manager}</td>
          </tr>
        `
        ).join('')}
      </tbody>
    </table>

    <div style="text-align: right; font-size: 10px; color: #94a3b8; margin-top: 8px;">
      [다음 페이지에 대피 행동요령 및 층별 대피 동선 계속]
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════ -->
  <!-- 📄 페이지 2: 대피 방법 8대 수칙, 층별 대피 동선, 기대효과   -->
  <!-- ═══════════════════════════════════════════════════════ -->
  <div class="page page-multi">
    <div class="header-decor-blue"></div>
    <div class="header-title">${year}학년도 ${disasterType} 대피 행동요령 및 대피동선</div>
    <div class="school-name">호치민시한국국제학교 (초등) &nbsp;|&nbsp; 2 / 2</div>

    <div class="section-badge">4 &nbsp;대피 방법 8대 수칙</div>
    <div class="notice-box avoid-break" style="margin-bottom: 10px; line-height: 1.65;">
      ${rules.map((r) => `<div style="margin: 2px 0;">${r}</div>`).join('')}
    </div>

    <div class="section-badge">5 &nbsp;초등 본관 층별 대피 동선 및 집결지 안내</div>
    
    <div class="avoid-break" style="display: flex; flex-direction: column; gap: 7px; margin: 6px 0;">
      <!-- 1층 집결지 -->
      <div style="border: 1.5px solid #2563eb; border-radius: 7px; padding: 8px 12px; background: #eff6ff;">
        <div style="font-weight: 800; color: #1e40af; font-size: 12px; margin-bottom: 2px;">
          [1층 대피 집결지]
        </div>
        <div style="font-size: 11px; line-height: 1.55; color: #1e293b;">
          ${floorRoutes.floor1Assembly.split('|').map((part) => `• ${part.trim()}`).join('<br/>')}
        </div>
      </div>

      <!-- 2층 대피 동선 -->
      <div style="border: 1.5px solid #059669; border-radius: 7px; padding: 8px 12px; background: #ecfdf5;">
        <div style="font-weight: 800; color: #065f46; font-size: 12px; margin-bottom: 2px;">
          [2층 대피 동선 (1, 2, 3학년 교실)]
        </div>
        <div style="font-size: 11px; line-height: 1.55; color: #1e293b;">
          ${floorRoutes.floor2Routes.split('|').map((part) => `• ${part.trim()}`).join('<br/>')}
        </div>
      </div>

      <!-- 3층 대피 동선 -->
      <div style="border: 1.5px solid #d97706; border-radius: 7px; padding: 8px 12px; background: #fffbeb;">
        <div style="font-weight: 800; color: #92400e; font-size: 12px; margin-bottom: 2px;">
          [3층 대피 동선 (4, 5, 6학년 교실)]
        </div>
        <div style="font-size: 11px; line-height: 1.55; color: #1e293b;">
          ${floorRoutes.floor3Routes.split('|').map((part) => `• ${part.trim()}`).join('<br/>')}
        </div>
      </div>
    </div>

    <div class="section-badge" style="margin-top: 10px;">6 &nbsp;기대 효과</div>
    <div class="avoid-break">
      ${effects.map((e) => `<p class="indent-1">○ ${e}</p>`).join('')}
    </div>
  </div>
</body>
</html>`;
}
