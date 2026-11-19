// 2026학년도 재난(지진/화재) 대피 훈련 실시 계획 기안문 및 붙임문서 HTML 렌더러

import {
  DEFAULT_PREPARATION_TASKS,
  DEFAULT_TRAINING_TIMETABLE,
  EVACUATION_RULES,
} from './safetyPlanData';

export interface EvacuationPlanFormState {
  year: number; // 2026
  disasterType: '지진' | '화재'; // '지진' | '화재'
  docNo: string; // "Kish -초등-146"
  docDate: string; // "2026. 05. 06."
  relatedDoc: string; // "2026학년도 안전교육 운영 계획(2026.03.24.)"
  month: number; // 5
  trainingDateTime: string; // "2026. 5. 23.(금), 7교시"
  trainingLocation: string; // "각 교실 및 학교 전체"
  trainingContent: string; // "지진 대피 훈련 사전교육 및 실제 대피 훈련"
  drafterName: string; // 강지욱
  drafterRole: string; // 담당
  deptHeadName: string; // 오형석
  deptHeadRole: string; // 부장
  vpName: string; // 신선영
  vpRole: string; // 교감
  principalName: string; // 김명환
  principalRole: string; // 교장
  adminHeadName: string; // 배경희
  adminHeadRole: string; // 협조자 행정실장
  prepTasks: Array<{ no: number; title: string; content: string; schedule: string; manager: string }>;
  timeTable: Array<{ no: number; stage: string; time: string; content: string; manager: string }>;
}

export const DEFAULT_EVACUATION_PLAN_STATE: EvacuationPlanFormState = {
  year: 2026,
  disasterType: '지진',
  docNo: 'Kish -초등-146',
  docDate: '2026. 05. 06.',
  relatedDoc: '2026학년도 안전교육 운영 계획(2026.03.24.)',
  month: 5,
  trainingDateTime: '2026. 5. 23.(금), 7교시',
  trainingLocation: '각 교실 및 학교 전체',
  trainingContent: '지진 대피 훈련 사전교육 및 실제 대피 훈련',
  drafterName: '강지욱',
  drafterRole: '담당',
  deptHeadName: '오형석',
  deptHeadRole: '부장',
  vpName: '신선영',
  vpRole: '교감',
  principalName: '김명환',
  principalRole: '교장',
  adminHeadName: '배경희',
  adminHeadRole: '협조자 행정실장',
  prepTasks: DEFAULT_PREPARATION_TASKS,
  timeTable: DEFAULT_TRAINING_TIMETABLE,
};

// 1. 기안문(1페이지) HTML
export function generateEvacuationDraftHtml(data: EvacuationPlanFormState): string {
  return `
  <div class="a4-page draft-page" style="width: 210mm; min-height: 297mm; padding: 20mm 18mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.6; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <!-- 상단 슬로건 및 학교 로고 헤더 -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 11pt; font-weight: 500; color: #333; letter-spacing: -0.3px; margin-bottom: 8px;">
          글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <img src="/images/kis_symbol.png" alt="KIS Logo" style="height: 38px; object-fit: contain;" onerror="this.style.display='none'" />
          <span style="font-size: 21pt; font-weight: 900; letter-spacing: -0.5px; color: #002875; font-family: 'Malgun Gothic', sans-serif;">
            호치민시한국국제학교
          </span>
        </div>
        <div style="font-size: 8.5pt; color: #555; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px;">
          KOREAN INTERNATIONAL SCHOOL HCMC
        </div>
      </div>

      <!-- 수신 및 제목 -->
      <div style="margin-bottom: 20px; font-size: 11.5pt;">
        <div style="margin-bottom: 4px;"><strong style="letter-spacing: 2px;">수신</strong> &nbsp; 내부결재</div>
        <div style="margin-bottom: 6px; color: #333;">(경유)</div>
        <div style="font-size: 13pt; font-weight: 800; border-bottom: 2px solid #000; padding-bottom: 8px; margin-top: 8px;">
          <strong style="letter-spacing: 2px;">제목</strong> &nbsp; ${data.year}학년도 ${data.disasterType} 대피 훈련 실시 계획
        </div>
      </div>

      <!-- 본문 -->
      <div style="font-size: 11pt; margin-bottom: 24px; line-height: 1.8;">
        <p style="margin-bottom: 8px; text-indent: 4px;">
          1. 관련: ${data.relatedDoc}
        </p>
        <p style="margin-bottom: 14px; text-indent: 4px;">
          2. ${data.year}학년도 초등교육과정 및 안전교육 운영 계획에 의거하여, ${data.month}월 재난대피훈련을 다음과 같이 실시하고자 합니다.
        </p>

        <div style="margin-left: 20px; margin-bottom: 20px; font-size: 11pt; line-height: 1.9;">
          <div><strong>가. 일 &nbsp; 시 :</strong> &nbsp; ${data.trainingDateTime}</div>
          <div><strong>나. 장 &nbsp; 소 :</strong> &nbsp; ${data.trainingLocation}</div>
          <div><strong>다. 내 &nbsp; 용 :</strong> &nbsp; ${data.trainingContent}</div>
          <div><strong>라. 기타 세부 내용 :</strong> &nbsp; 붙임 참조</div>
        </div>

        <!-- 붙임 안내 -->
        <div style="margin-top: 28px; font-size: 11pt; text-indent: 4px;">
          <strong>붙임</strong> &nbsp; ${data.year}학년도 ${data.disasterType} 대피 훈련 계획 1부. &nbsp;끝.
        </div>
      </div>
    </div>

    <!-- 하단 결재선 및 공문 정보 푸터 -->
    <div>
      <div style="border-top: 2px solid #000; border-bottom: 1px solid #000; padding: 8px 4px; margin-bottom: 6px; font-size: 10pt;">
        <div style="display: flex; justify-content: space-between; align-items: center; text-align: center;">
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #555; font-size: 8.5pt;">${data.drafterRole}</div>
            <div style="font-size: 10.5pt; font-weight: 800; margin-top: 2px;">${data.drafterName}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #555; font-size: 8.5pt;">${data.deptHeadRole}</div>
            <div style="font-size: 10.5pt; font-weight: 800; margin-top: 2px;">${data.deptHeadName}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #555; font-size: 8.5pt;">${data.vpRole}</div>
            <div style="font-size: 10.5pt; font-weight: 800; margin-top: 2px;">${data.vpName}</div>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #555; font-size: 8.5pt;">${data.principalRole}</div>
            <div style="font-size: 10.5pt; font-weight: 800; margin-top: 2px;">${data.principalName}</div>
          </div>
        </div>
      </div>

      <div style="font-size: 9pt; color: #222; line-height: 1.5; padding: 2px 0;">
        <div style="margin-bottom: 2px;">
          <strong>협조자</strong> &nbsp; ${data.adminHeadRole} &nbsp; <strong>${data.adminHeadName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>시행</strong> &nbsp; ${data.docNo} &nbsp; (${data.docDate})</span>
          <span><strong>접수</strong> &nbsp; ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</span>
        </div>
        <div style="margin-top: 2px;">
          <span><strong>주소</strong> 21 Tan Phu Street, Tan Phu Ward, District 7, Ho Chi Minh City, Vietnam</span>
          <span style="margin-left: 10px;"><strong>/ http://www.kshcm.net</strong></span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>전화</strong> (84-28)3780-1424 &nbsp;/ <strong>전송</strong> (84-28)3780-1229</span>
          <span>hcmcks@hanmail.net &nbsp;/ <strong>공개</strong></span>
        </div>
      </div>
    </div>
  </div>
  `;
}

// 2. 붙임 문서(재난대피 훈련계획 초등) HTML
export function generateEvacuationAttachmentHtml(data: EvacuationPlanFormState): string {
  return `
  <!-- 붙임 1페이지: 표지 및 목적, 근거, 방침, 세부추진계획 개요 -->
  <div class="a4-page attach-page" style="width: 210mm; min-height: 297mm; padding: 20mm 18mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.6;">
    <div style="text-align: right; font-size: 9.5pt; color: #555; margin-bottom: 6px;">- 2 -</div>
    
    <!-- 타이틀 박스 -->
    <div style="background: #eef2f6; border-left: 6px solid #1e3a8a; padding: 14px 18px; margin-bottom: 22px;">
      <h2 style="font-size: 18pt; font-weight: 900; color: #0f172a; margin: 0 0 4px 0;">
        ${data.year}학년도 재난대피 훈련계획 (초등)
      </h2>
      <div style="font-size: 10pt; color: #475569; font-weight: 600;">
        ${data.year}. ${data.month}. &nbsp;|&nbsp; 호치민시한국국제학교
      </div>
    </div>

    <!-- I. 목적 -->
    <div style="margin-bottom: 18px;">
      <div style="display: inline-block; background: #1e3a8a; color: #fff; padding: 3px 10px; font-size: 10.5pt; font-weight: 800; border-radius: 3px; margin-bottom: 6px;">
        Ⅰ &nbsp; 목 &nbsp; 적
      </div>
      <div style="border-top: 1.5px solid #1e3a8a; padding-top: 6px; font-size: 10pt; line-height: 1.7;">
        <div>○ 재난 및 화재 발생에 대피절차 및 행동요령 숙달</div>
        <div>○ 각종 재난대비 안전의식 고취 및 위기상황 발생 시 즉각 대응능력 함양</div>
        <div>○ 학교현장의 초동대처능력을 제고하고 안전문화 확산</div>
      </div>
    </div>

    <!-- II. 근거 -->
    <div style="margin-bottom: 18px;">
      <div style="display: inline-block; background: #1e3a8a; color: #fff; padding: 3px 10px; font-size: 10.5pt; font-weight: 800; border-radius: 3px; margin-bottom: 6px;">
        Ⅱ &nbsp; 근 &nbsp; 거
      </div>
      <div style="border-top: 1.5px solid #1e3a8a; padding-top: 6px; font-size: 10pt; line-height: 1.7;">
        <div>○ ${data.year}학년도 호치민시한국국제학교 초등교육과정</div>
        <div>○ ${data.year}학년도 교육부 안전교육계획</div>
      </div>
    </div>

    <!-- III. 방침 -->
    <div style="margin-bottom: 18px;">
      <div style="display: inline-block; background: #1e3a8a; color: #fff; padding: 3px 10px; font-size: 10.5pt; font-weight: 800; border-radius: 3px; margin-bottom: 6px;">
        Ⅲ &nbsp; 방 &nbsp; 침
      </div>
      <div style="border-top: 1.5px solid #1e3a8a; padding-top: 6px; font-size: 10pt; line-height: 1.7;">
        <div>○ ${data.disasterType} 발생 시 행동 요령을 익히는 데 중점을 둔다.</div>
        <div>○ 훈련 시 계단에서 넘어지는 사고 등 안전사고에 각별히 주의한다.</div>
        <div>○ 상황발생 시 수업 중인 교사가 안내하여 대피장소로 안전하고 신속하게 대피한다.</div>
      </div>
    </div>

    <!-- IV. 세부추진 계획 (개요) -->
    <div>
      <div style="display: inline-block; background: #1e3a8a; color: #fff; padding: 3px 10px; font-size: 10.5pt; font-weight: 800; border-radius: 3px; margin-bottom: 6px;">
        Ⅳ &nbsp; 세부추진 계획
      </div>
      <div style="border-top: 1.5px solid #1e3a8a; padding-top: 6px; font-size: 10pt; line-height: 1.8;">
        <div style="font-weight: 800; margin: 4px 0;">□ 훈련 개요</div>
        <div style="padding-left: 8px;">
          <div>○ 일 &nbsp; 시 : ${data.trainingDateTime}</div>
          <div>○ 장 &nbsp; 소 : ${data.trainingLocation}</div>
          <div>○ 내 &nbsp; 용 : ${data.trainingContent}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 붙임 2페이지: 사전 준비 점검표, 당일 타임테이블, 대피 8대 수칙 -->
  <div class="a4-page attach-page" style="width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.4; page-break-before: always;">
    <div style="text-align: right; font-size: 9pt; color: #555; margin-bottom: 6px;">- 3 -</div>

    <!-- 사전 준비 목록 및 점검표 -->
    <div style="margin-bottom: 14px;">
      <div style="font-size: 10.5pt; font-weight: 800; margin-bottom: 6px;">□ 사전 준비 목록 및 점검표</div>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8.5pt; text-align: center;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: 700;">
            <th style="border: 1px solid #000; padding: 4px; width: 8%;">순</th>
            <th style="border: 1px solid #000; padding: 4px; width: 22%;">구 분</th>
            <th style="border: 1px solid #000; padding: 4px; width: 44%;">내 용</th>
            <th style="border: 1px solid #000; padding: 4px; width: 14%;">추진일정</th>
            <th style="border: 1px solid #000; padding: 4px; width: 12%;">담당</th>
          </tr>
        </thead>
        <tbody>
          ${data.prepTasks
            .map(
              (t) => `
            <tr>
              <td style="border: 1px solid #000; padding: 5px;">${t.no}</td>
              <td style="border: 1px solid #000; padding: 5px; font-weight: 600;">${t.title}</td>
              <td style="border: 1px solid #000; padding: 5px 6px; text-align: left;">${t.content}</td>
              <td style="border: 1px solid #000; padding: 5px;">${t.schedule}</td>
              <td style="border: 1px solid #000; padding: 5px;">${t.manager}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- 당일 일정 -->
    <div style="margin-bottom: 14px;">
      <div style="font-size: 10.5pt; font-weight: 800; margin-bottom: 6px;">□ 당일 일정</div>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8.5pt; text-align: center;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: 700;">
            <th style="border: 1px solid #000; padding: 4px; width: 8%;">순</th>
            <th style="border: 1px solid #000; padding: 4px; width: 22%;">구 분</th>
            <th style="border: 1px solid #000; padding: 4px; width: 16%;">시 간</th>
            <th style="border: 1px solid #000; padding: 4px; width: 38%;">내 용</th>
            <th style="border: 1px solid #000; padding: 4px; width: 16%;">담당</th>
          </tr>
        </thead>
        <tbody>
          ${data.timeTable
            .map(
              (t) => `
            <tr>
              <td style="border: 1px solid #000; padding: 5px;">${t.no}</td>
              <td style="border: 1px solid #000; padding: 5px; font-weight: 600;">${t.stage}</td>
              <td style="border: 1px solid #000; padding: 5px; font-weight: 700;">${t.time}</td>
              <td style="border: 1px solid #000; padding: 5px 6px; text-align: left;">${t.content}</td>
              <td style="border: 1px solid #000; padding: 5px;">${t.manager}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- 대피 방법 8대 수칙 -->
    <div>
      <div style="font-size: 10.5pt; font-weight: 800; margin-bottom: 6px;">□ 대피 방법 8대 수칙</div>
      <div style="border: 1.5px solid #000; background: #fafafa; padding: 8px 12px; font-size: 8pt; line-height: 1.6;">
        ${EVACUATION_RULES.map((r) => `<div style="margin-bottom: 2px;">${r}</div>`).join('')}
      </div>
    </div>
  </div>

  <!-- 붙임 3페이지: 층별 대피경로 다이어그램 및 기대효과 -->
  <div class="a4-page attach-page" style="width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.4; page-break-before: always; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="text-align: right; font-size: 9pt; color: #555; margin-bottom: 6px;">- 4 -</div>
      <div style="font-size: 11pt; font-weight: 800; margin-bottom: 10px;">
        □ 층별 대피 경로 안내도 (초등 본관 및 별관)
      </div>

      <!-- 층별 대피 경로 시각화 다이어그램 카드 -->
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
        <!-- 1층 집결지 -->
        <div style="border: 1.5px solid #2563eb; border-radius: 6px; padding: 8px 12px; background: #eff6ff;">
          <div style="font-weight: 800; color: #1e40af; font-size: 9.5pt; margin-bottom: 4px;">
            [1층 대피 집결지]
          </div>
          <div style="font-size: 8.5pt; line-height: 1.5; color: #1e293b;">
            • <strong>1·2학년 (1,2,3G):</strong> 무지개 놀이터 및 서편 대피로 집결<br/>
            • <strong>3·4학년:</strong> 매점 앞 중앙 광장 집결<br/>
            • <strong>5·6학년:</strong> 본관 앞 광장 및 체육관 앞 공터 집결
          </div>
        </div>

        <!-- 2층 대피 동선 -->
        <div style="border: 1.5px solid #059669; border-radius: 6px; padding: 8px 12px; background: #ecfdf5;">
          <div style="font-weight: 800; color: #065f46; font-size: 9.5pt; margin-bottom: 4px;">
            [2층 대피 동선 (1, 2, 3학년 교실)]
          </div>
          <div style="font-size: 8.5pt; line-height: 1.5; color: #1e293b;">
            • <strong>동편 계단:</strong> 2-1, 2-2, 2-3반 $\rightarrow$ 본관 앞 광장으로 이동<br/>
            • <strong>중앙 계단:</strong> 1-1, 1-2, 1-3반 $\rightarrow$ 매점 앞 중앙광장으로 이동<br/>
            • <strong>서편 계단:</strong> 3학년 전 학급 $\rightarrow$ 무지개 놀이터 외곽으로 이동
          </div>
        </div>

        <!-- 3층 대피 동선 -->
        <div style="border: 1.5px solid #d97706; border-radius: 6px; padding: 8px 12px; background: #fffbeb;">
          <div style="font-weight: 800; color: #92400e; font-size: 9.5pt; margin-bottom: 4px;">
            [3층 대피 동선 (4, 5, 6학년 교실)]
          </div>
          <div style="font-size: 8.5pt; line-height: 1.5; color: #1e293b;">
            • <strong>동편 계단:</strong> 4학년 전 학급 $\rightarrow$ 본관 우측 비상계단 경유 운동장 집결<br/>
            • <strong>중앙 계단:</strong> 5학년 전 학급 $\rightarrow$ 중앙 계단 경유 본관 앞 광장 집결<br/>
            • <strong>서편 계단:</strong> 6학년 전 학급 $\rightarrow$ 서편 계단 경유 무지개 놀이터 외곽 집결
          </div>
        </div>
      </div>
    </div>

    <!-- V. 기대 효과 -->
    <div style="margin-top: 10px;">
      <div style="display: inline-block; background: #1e3a8a; color: #fff; padding: 3px 10px; font-size: 10.5pt; font-weight: 800; border-radius: 3px; margin-bottom: 6px;">
        Ⅴ &nbsp; 기 대 &nbsp; 효 과
      </div>
      <div style="border-top: 1.5px solid #1e3a8a; padding-top: 8px; font-size: 10pt; line-height: 1.8;">
        <div>○ 실질적인 재난대피 및 소방훈련을 통한 안전의식 제고</div>
        <div>○ 대피절차 및 행동요령 숙달로 위기상황 발생 시 즉각 대응 능력 함양</div>
        <div>○ 안전을 최우선으로 고려하는 안전 학교문화 확산</div>
      </div>
    </div>
  </div>
  `;
}

// 3. 기안문 + 붙임문서 통합 풀 HTML
export function generateEvacuationCombinedHtml(data: EvacuationPlanFormState): string {
  return `
  <div class="print-document-root" style="background: #e2e8f0; padding: 20px 0;">
    ${generateEvacuationDraftHtml(data)}
    <div style="height: 20px;"></div>
    ${generateEvacuationAttachmentHtml(data)}
  </div>
  `;
}
