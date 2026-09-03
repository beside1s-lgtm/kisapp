/**
 * KIS 통합 포털 - 표준 교무/부서 업무 추진 & 협업 기안 아키텍처 (KIS Standard Task Workflow)
 * 
 * 모든 부서(체육, 스쿨버스, 방과후, 교무, 생활, 정보 등)에서 '+업무 요청'을 통해
 * 직원들에게 업무를 할당하고, 제출을 취합하여 최종 기안문까지 원클릭으로 상신하는 표준 프레임워크입니다.
 * 
 * ====================================================================================
 * [표준 5단계 워크플로우 명세]
 * ====================================================================================
 * 1. 업무 기획 및 마스터 데이터 등록 (Event / Master Plan Creation)
 *    - 행사/계획 기본 정보: 제목, 일시, 장소, 대상 학년/대상자, 예산, 일정표
 * 
 * 2. 타겟팅 업무 할당 (+업무 요청, Targeted Task Delegation)
 *    - 전체 대상이 아닌 실제 지정된 대상 학년/직원 슬롯에만 정확히 1:1 업무 할당
 *    - createDepartmentTask()를 통해 수신함(Inbox) 및 미결 업무 연동
 * 
 * 3. 담당 교원 세부 계획 작성 및 제출 (Submission & Tracking)
 *    - 할당받은 교원이 학년별/부서별 세부 시나리오 및 타임테이블 작성 후 제출
 *    - 고유 대상자 슬롯 기준으로 제출 진행률(예: 1/1명 100%)을 실시간 정밀 집계
 * 
 * 4. 제출 내역 조회 및 실시간 취합 (Submissions Dialog Review)
 *    - TaskSubmissionsDialog를 통해 제출 현황, 미제출자, 세부 작성 내용을 모달로 실시간 조회
 * 
 * 5. 원클릭 기안문 자동 생성 및 전자결재 직행 (Automated Draft & Approval)
 *    - [기안문 상신] 버튼 클릭 시:
 *      A. 본문: 단순 요약형 양식 (개요, 일시, 장소, 대상, 예산)
 *      B. 붙임 표: '선 없는 2열 표(무테 테이블)' 서식 자동 적용
 *      C. 첨부파일: [붙임 1] 세부 운영 계획서.html, [붙임 2] 학년별 시나리오 취합본.html 자동 생성
 *      D. 결재선: 위임전결 규정 자동 매핑 (연간: 교장 결재 / 세부: 교감 전결 / 부서: 부장 전결)
 *      E. 전자결재 작성 페이지(/new)로 데이터와 함께 원클릭 직행
 * ====================================================================================
 */

import { DepartmentTask, TaskSubmission, ApprovalDoc } from '@/lib/types';

export interface StandardTaskDraftPayload {
  title: string;
  category: string;
  targetGradesText: string;
  startDate: string;
  endDate: string;
  location: string;
  totalBudgetFormatted?: string;
  schedulesHtml?: string;
  submissionsList: Array<{
    grade?: string;
    submitterName: string;
    content: string;
    details?: string;
    submittedAt?: string;
  }>;
}

/**
 * 표준 선 없는 2열 표(무테 테이블) 붙임 서식 HTML 생성 헬퍼
 */
export function generateStandardAttachmentTableHtml(
  planDocTitle: string,
  hasSubmissions: boolean = true
): string {
  return `
<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 24px; margin-bottom: 6px; line-height: 1.8; font-size: 13px;" class="attachment-table">
  <tbody>
    <tr>
      <td style="vertical-align: top; width: 36px; border: none; padding: 0 8px 3px 0; white-space: nowrap; font-weight: normal; color: inherit;">붙임</td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">1. &nbsp;${planDocTitle} 세부 운영 계획서 1부.</td>
    </tr>
    ${hasSubmissions ? `
    <tr>
      <td style="border: none; padding: 0 8px 3px 0;"></td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">2. &nbsp;학년별/부서별 세부 운영 시나리오 및 타임테이블(취합본) 1부. &nbsp;&nbsp;끝.</td>
    </tr>` : `
    <tr>
      <td style="border: none; padding: 0 8px 3px 0;"></td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">끝.</td>
    </tr>`}
  </tbody>
</table>
  `.trim();
}

/**
 * 표준 요약형 공문서 기안문 본문 HTML 생성 헬퍼
 */
export function generateStandardDraftBodyHtml(params: {
  relatedPlanText: string;
  title: string;
  startDate: string;
  endDate?: string;
  location: string;
  targetAudienceText: string;
  budgetFormatted?: string;
  attachmentTableHtml: string;
}): string {
  return `
<p style="line-height: 1.8; margin-bottom: 8px; font-size: 13px;">1. 관련: ${params.relatedPlanText}</p>
<p style="line-height: 1.8; margin-bottom: 8px; font-size: 13px;">2. <strong>${params.title}</strong>을 다음과 같이 추진하고자 하오니 결재하여 주시기 바랍니다.</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">가. &nbsp;행사/업무명: ${params.title}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">나. &nbsp;운영 일시: ${params.startDate}${params.endDate && params.endDate !== params.startDate ? ` ~ ${params.endDate}` : ''}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">다. &nbsp;진행 장소: ${params.location}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">라. &nbsp;대상: ${params.targetAudienceText}</p>
${params.budgetFormatted ? `<p style="line-height: 1.8; margin-bottom: 8px; margin-left: 16px; font-size: 13px;">마. &nbsp;소요 예산: 금 ${params.budgetFormatted} VND</p>` : ''}
${params.attachmentTableHtml}
  `.trim();
}
