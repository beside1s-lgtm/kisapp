// 2026학년도 학생 안전교육 운영 계획 기안문 및 붙임문서 HTML 렌더러

import {
  STANDARD_HOURS_TABLE,
  GRADE_HOURS_DATA,
  GRADE_1_CURRICULUM,
  GRADE_2_CURRICULUM,
} from './safetyPlanData';

export interface YearlyPlanFormState {
  year: number; // 2026
  docNo: string; // "Kish-초등-77"
  docDate: string; // "2026. 03. 24."
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
  summaryRows: Array<{
    category: string;
    period: string;
    content: string;
    method: string;
  }>;
}

export const DEFAULT_YEARLY_PLAN_STATE: YearlyPlanFormState = {
  year: 2026,
  docNo: 'Kish-초등-77',
  docDate: '2026. 03. 24.',
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
  summaryRows: [
    {
      category: '학년별\n안전교육',
      period: '연중',
      content: '안전교육 7대 영역',
      method: '교과 및 창의적체험활동\n시간 활용 담임교사 지도',
    },
    {
      category: '재난대피\n훈련',
      period: '5월\n10월',
      content: '지진/화재 대피 훈련',
      method: '중앙 방송 및 대피훈련',
    },
    {
      category: '가정 연계\n지도',
      period: '방학 전',
      content: '방학 및 가정생활 안전',
      method: '가정통신문 활용',
    },
  ],
};

// 1. 기안문(1페이지) HTML
export function generateYearlyPlanDraftHtml(data: YearlyPlanFormState): string {
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
          <strong style="letter-spacing: 2px;">제목</strong> &nbsp; ${data.year}학년도 안전교육 운영 계획
        </div>
      </div>

      <!-- 본문 -->
      <div style="font-size: 11pt; margin-bottom: 24px;">
        <p style="margin-bottom: 14px; text-indent: 4px;">
          1. ${data.year}학년도 안전교육을 붙임과 같이 실시하고자 합니다.
        </p>

        <!-- 요약 테이블 -->
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin: 12px 0; font-size: 10pt; text-align: center;">
          <thead>
            <tr style="background: #f8fafc; font-weight: 700;">
              <th style="border: 1px solid #000; padding: 7px 4px; width: 18%;">내용</th>
              <th style="border: 1px solid #000; padding: 7px 4px; width: 15%;">시기</th>
              <th style="border: 1px solid #000; padding: 7px 4px; width: 35%;">내용</th>
              <th style="border: 1px solid #000; padding: 7px 4px; width: 32%;">방법</th>
            </tr>
          </thead>
          <tbody>
            ${data.summaryRows
              .map(
                (row) => `
              <tr>
                <td style="border: 1px solid #000; padding: 10px 4px; white-space: pre-line; font-weight: 600;">${row.category}</td>
                <td style="border: 1px solid #000; padding: 10px 4px; white-space: pre-line;">${row.period}</td>
                <td style="border: 1px solid #000; padding: 10px 6px;">${row.content}</td>
                <td style="border: 1px solid #000; padding: 10px 6px; white-space: pre-line;">${row.method}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <!-- 붙임 안내 -->
        <div style="margin-top: 24px; font-size: 11pt; text-indent: 4px;">
          <strong>붙임</strong> &nbsp; ${data.year} 안전교육 운영 계획 1부. &nbsp;끝.
        </div>
      </div>
    </div>

    <!-- 하단 결재선 및 공문 정보 푸터 -->
    <div>
      <div style="font-size: 9.5pt; color: #444; margin-bottom: 6px;">수신자</div>
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
          <span><strong>우</strong> 21Tan Phu Street Tan Phu Ward Dist.7 HCMC</span>
          <span style="margin-left: 20px;"><strong>/ http://kshcm.net</strong></span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>전화</strong> (84-28) 5417-9021~4 &nbsp;/ <strong>전송</strong> (84-28) 5417-9028</span>
          <span>hcmcks@hanmail.net &nbsp;/ <strong>공개</strong></span>
        </div>
      </div>
    </div>
  </div>
  `;
}

// 2. 붙임 문서(세부 운영 계획) HTML
export function generateYearlyPlanAttachmentHtml(data: YearlyPlanFormState): string {
  return `
  <!-- 붙임문서 1페이지: 목적, 방침, 세부추진계획-시수표 -->
  <div class="a4-page attach-page" style="width: 210mm; min-height: 297mm; padding: 20mm 18mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.6;">
    <div style="text-align: right; font-size: 9.5pt; color: #555; margin-bottom: 10px;">- 1 -</div>
    
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="font-size: 19pt; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px;">
        ${data.year}학년도 안전교육 운영 계획
      </h2>
      <div style="font-size: 11pt; font-weight: 700; color: #444;">호치민시한국국제학교</div>
    </div>

    <!-- 1. 목적 -->
    <div style="margin-bottom: 16px;">
      <h3 style="font-size: 12pt; font-weight: 900; margin: 0 0 4px 0;">1. 목적</h3>
      <p style="font-size: 10pt; line-height: 1.6; text-indent: 10px; margin: 0;">
        학생의 안전의식 고취로 안전사고를 예방하고, 안전한 생활을 할 수 있도록 하여 건강하고 안전한 학교생활을 영위하도록 한다.
      </p>
    </div>

    <!-- 2. 방침 -->
    <div style="margin-bottom: 16px;">
      <h3 style="font-size: 12pt; font-weight: 900; margin: 0 0 4px 0;">2. 방침</h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 9.5pt; line-height: 1.6;">
        <li>가. 안전교육 7대 영역의 내용을 교과 및 창의적 체험활동 시간을 통해 실시</li>
        <li>나. 가정과의 연계 교육을 위해 학기당 2회 안전교육 가정통신문을 발송</li>
        <li>다. 재난상황의 신속한 대처를 위한 재난대피 훈련을 연 2회 실시</li>
        <li>라. 최소 수업시수 인정 단위는 교육과정(교과+창의적체험활동) 활동 중에는 1회 10분 이상으로, 교육과정 외(조회, 종례 등) 활동 중에는 10분 이상 최소 5일 연속으로 함</li>
        <li>마. 학교 및 지역 사회, 국가 상황 등에 따라 시기 및 활동 방법은 온라인 활동 등 다양하게 변형하여 운영할 수 있음</li>
      </ul>
    </div>

    <!-- 3. 세부 추진 계획 -->
    <div style="margin-bottom: 16px;">
      <h3 style="font-size: 12pt; font-weight: 900; margin: 0 0 4px 0;">3. 세부 추진 계획</h3>
      <div style="font-size: 10pt; font-weight: 700; margin: 4px 0;">가. 학년별 안전교육 실시 계획</div>
      <div style="font-size: 9.5pt; font-weight: 600; margin: 2px 0 6px 6px;">1) 학생안전교육 시수</div>

      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8pt; text-align: center;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: 700;">
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 14%;">구분</th>
            <th colspan="7" style="border: 1px solid #000; padding: 4px;">안전교육 영역</th>
          </tr>
          <tr style="background: #f8fafc; font-size: 7.5pt;">
            <th style="border: 1px solid #000; padding: 3px;">생활안전</th>
            <th style="border: 1px solid #000; padding: 3px;">교통안전</th>
            <th style="border: 1px solid #000; padding: 3px;">폭력·신변</th>
            <th style="border: 1px solid #000; padding: 3px;">약물·사이버</th>
            <th style="border: 1px solid #000; padding: 3px;">재난안전</th>
            <th style="border: 1px solid #000; padding: 3px;">직업안전</th>
            <th style="border: 1px solid #000; padding: 3px;">응급처치</th>
          </tr>
          <tr style="background: #eff6ff; font-weight: 700;">
            <td style="border: 1px solid #000; padding: 3px;">기준시수</td>
            <td style="border: 1px solid #000; padding: 3px;">12</td>
            <td style="border: 1px solid #000; padding: 3px;">11</td>
            <td style="border: 1px solid #000; padding: 3px;">8</td>
            <td style="border: 1px solid #000; padding: 3px;">10</td>
            <td style="border: 1px solid #000; padding: 3px;">6</td>
            <td style="border: 1px solid #000; padding: 3px;">2</td>
            <td style="border: 1px solid #000; padding: 3px;">2</td>
          </tr>
        </thead>
        <tbody>
          ${GRADE_HOURS_DATA.map(
            (g) => `
            <tr>
              <td rowspan="2" style="border: 1px solid #000; padding: 2px; font-weight: 700;">${g.grade}학년</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.life}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.traffic}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.violence}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.drugCyber}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.disaster}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.job}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester1.firstAid}</td>
            </tr>
            <tr style="background: #fafafa;">
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.life}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.traffic}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.violence}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.drugCyber}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.disaster}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.job}</td>
              <td style="border: 1px solid #000; padding: 2px;">${g.semester2.firstAid}</td>
            </tr>
          `
          ).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 붙임문서 2페이지: 1학년 안전교육 52차시 전체 표 -->
  <div class="a4-page attach-page" style="width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.4; page-break-before: always;">
    <div style="text-align: right; font-size: 9pt; color: #555; margin-bottom: 6px;">- 2 -</div>
    <div style="font-size: 10.5pt; font-weight: 800; margin-bottom: 6px;">
      2) 학년별 학교안전교육 운영 &gt; 가) 1학년 안전교육 (총 52차시)
    </div>

    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 7.5pt; text-align: left;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; text-align: center;">
          <th style="border: 1px solid #000; padding: 3px; width: 5%;">순</th>
          <th style="border: 1px solid #000; padding: 3px; width: 14%;">구분</th>
          <th style="border: 1px solid #000; padding: 3px; width: 33%;">내용</th>
          <th style="border: 1px solid #000; padding: 3px; width: 14%;">관련 교과</th>
          <th style="border: 1px solid #000; padding: 3px; width: 22%;">단원</th>
          <th style="border: 1px solid #000; padding: 3px; width: 7%;">시기</th>
          <th style="border: 1px solid #000; padding: 3px; width: 5%;">시수</th>
        </tr>
      </thead>
      <tbody>
        ${GRADE_1_CURRICULUM.map(
          (item) => `
          <tr>
            <td style="border: 1px solid #000; padding: 2.5px 3px; text-align: center;">${item.no}</td>
            <td style="border: 1px solid #000; padding: 2.5px 4px; font-weight: 600;">${item.area}</td>
            <td style="border: 1px solid #000; padding: 2.5px 4px;">${item.title}</td>
            <td style="border: 1px solid #000; padding: 2.5px 4px; text-align: center;">${item.subject}</td>
            <td style="border: 1px solid #000; padding: 2.5px 4px;">${item.unit}</td>
            <td style="border: 1px solid #000; padding: 2.5px 3px; text-align: center;">${item.period}</td>
            <td style="border: 1px solid #000; padding: 2.5px 3px; text-align: center; font-weight: 700;">${item.hours}</td>
          </tr>
        `
        ).join('')}
        <tr style="background: #eff6ff; font-weight: 800; text-align: center;">
          <td colspan="6" style="border: 1px solid #000; padding: 4px;">계</td>
          <td style="border: 1px solid #000; padding: 4px;">52차시</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 붙임문서 3페이지: 2학년 안전교육 52차시 및 재난대피/가정연계 계획 -->
  <div class="a4-page attach-page" style="width: 210mm; min-height: 297mm; padding: 18mm 16mm; margin: 0 auto; background: #fff; box-sizing: border-box; font-family: 'Batang', 'Malgun Gothic', serif; color: #111; line-height: 1.4; page-break-before: always;">
    <div style="text-align: right; font-size: 9pt; color: #555; margin-bottom: 6px;">- 3 -</div>
    <div style="font-size: 10.5pt; font-weight: 800; margin-bottom: 6px;">
      나) 2학년 안전교육 (총 52차시)
    </div>

    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 7.5pt; text-align: left; margin-bottom: 14px;">
      <thead>
        <tr style="background: #f1f5f9; font-weight: 700; text-align: center;">
          <th style="border: 1px solid #000; padding: 3px; width: 5%;">순</th>
          <th style="border: 1px solid #000; padding: 3px; width: 14%;">구분</th>
          <th style="border: 1px solid #000; padding: 3px; width: 33%;">내용</th>
          <th style="border: 1px solid #000; padding: 3px; width: 14%;">관련 교과</th>
          <th style="border: 1px solid #000; padding: 3px; width: 22%;">단원</th>
          <th style="border: 1px solid #000; padding: 3px; width: 7%;">시기</th>
          <th style="border: 1px solid #000; padding: 3px; width: 5%;">시수</th>
        </tr>
      </thead>
      <tbody>
        ${GRADE_2_CURRICULUM.slice(0, 35)
          .map(
            (item) => `
          <tr>
            <td style="border: 1px solid #000; padding: 2px 3px; text-align: center;">${item.no}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; font-weight: 600;">${item.area}</td>
            <td style="border: 1px solid #000; padding: 2px 4px;">${item.title}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${item.subject}</td>
            <td style="border: 1px solid #000; padding: 2px 4px;">${item.unit}</td>
            <td style="border: 1px solid #000; padding: 2px 3px; text-align: center;">${item.period}</td>
            <td style="border: 1px solid #000; padding: 2px 3px; text-align: center; font-weight: 700;">${item.hours}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <!-- 나. 재난대피 훈련 계획 & 다. 가정 연계 지도 계획 -->
    <div style="margin-top: 10px;">
      <div style="font-size: 10pt; font-weight: 800; margin-bottom: 4px;">나. 재난대피 훈련 계획</div>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8.5pt; text-align: center; margin-bottom: 12px;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: 700;">
            <th style="border: 1px solid #000; padding: 5px; width: 18%;">내용</th>
            <th style="border: 1px solid #000; padding: 5px; width: 14%;">시기</th>
            <th style="border: 1px solid #000; padding: 5px; width: 38%;">내용</th>
            <th style="border: 1px solid #000; padding: 5px; width: 30%;">방법</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: 600;">지진대피</td>
            <td style="border: 1px solid #000; padding: 6px;">1학기</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: left;">지진 상황 발생 시 행동 요령 숙달</td>
            <td rowspan="2" style="border: 1px solid #000; padding: 6px;">학급별 사전교육 및<br/>실제 대피로 이용 훈련</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: 600;">화재대피</td>
            <td style="border: 1px solid #000; padding: 6px;">2학기</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: left;">화재 상황 발생 시 행동 요령 숙달</td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 10pt; font-weight: 800; margin-bottom: 4px;">다. 가정 연계 지도 계획</div>
      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 8.5pt; text-align: center;">
        <thead>
          <tr style="background: #f1f5f9; font-weight: 700;">
            <th style="border: 1px solid #000; padding: 5px; width: 22%;">내용</th>
            <th style="border: 1px solid #000; padding: 5px; width: 18%;">시기</th>
            <th style="border: 1px solid #000; padding: 5px; width: 40%;">내용</th>
            <th style="border: 1px solid #000; padding: 5px; width: 20%;">방법</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: 600;">폭염사고 예방</td>
            <td style="border: 1px solid #000; padding: 6px;">여름방학 전</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: left;">무더위 상식, 외출 전/후 행동 요령 등</td>
            <td rowspan="2" style="border: 1px solid #000; padding: 6px;">가정통신문 발송</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: 600;">가정생활 안전</td>
            <td style="border: 1px solid #000; padding: 6px;">겨울방학 전</td>
            <td style="border: 1px solid #000; padding: 6px; text-align: left;">전기 사용, 추락, 넘어짐, 화상 등</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `;
}

// 3. 기안문 + 붙임문서 통합 풀 HTML (인쇄 및 전자결재 상신용)
export function generateYearlyPlanCombinedHtml(data: YearlyPlanFormState): string {
  return `
  <div class="print-document-root" style="background: #e2e8f0; padding: 20px 0;">
    ${generateYearlyPlanDraftHtml(data)}
    <div style="height: 20px;"></div>
    ${generateYearlyPlanAttachmentHtml(data)}
  </div>
  `;
}
