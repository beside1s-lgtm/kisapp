'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing AI-powered
 * insights and advice to teachers based on the average measurement results
 * of their students.
 *
 * - getTeacherDashboardBriefing - A function that generates a briefing for the teacher's dashboard.
 * - TeacherDashboardBriefingInput - The input type for the getTeacherDashboardBriefing function.
 * - TeacherDashboardBriefingOutput - The return type for the getTeacherDashboardBriefing function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const GradeDistributionSchema = z.record(z.string(), z.number().describe('The percentage of students for each grade (1-5).'));

const PapsAnalysisSchema = z.object({
  averageGrade: z.number().describe('The average PAPS grade for the group.'),
  lowPerformingPercentage: z.number().describe('The percentage of students in grades 4 and 5.'),
  gradeDistribution: GradeDistributionSchema.describe('The distribution of PAPS grades as percentages.'),
});

const CustomItemAnalysisSchema = z.record(z.string(), z.object({
  averageAchievement: z.number().describe('The average achievement percentage for the custom item.')
})).describe('Analysis of custom (non-PAPS) items with a defined goal.');

const ProgressAnalysisSchema = z.record(
  z.string(),
  z.number().describe('The average percentage point change in achievement for the item.')
).describe('Analysis of improvement in subjects with two or more records.');

const TeacherDashboardBriefingInputSchema = z.object({
  school: z.string().describe('The school for which the briefing is generated.'),
  totalStudentCount: z.number().describe('The total number of students with records.'),
  classInfo: z.object({ grade: z.string(), classNum: z.string() }).optional().describe('The class being analyzed, if applicable.'),
  paps: z.object({
    class: PapsAnalysisSchema.optional().describe('PAPS analysis for the specific class.'),
    grade: PapsAnalysisSchema.optional().describe('PAPS analysis for the entire grade level.'),
    overall: PapsAnalysisSchema.optional().describe('PAPS analysis for all students.'),
    byGradeLevel: z.record(z.string(), PapsAnalysisSchema).optional(),
    byItem: z.record(z.string(), z.object({ averageGrade: z.number() })).optional(),
  }).optional().describe('A detailed analysis of PAPS performance.'),
  customItems: CustomItemAnalysisSchema.optional().describe('Analysis of custom measurement items.'),
  progress: ProgressAnalysisSchema.optional(),
});

export type TeacherDashboardBriefingInput = z.infer<
  typeof TeacherDashboardBriefingInputSchema
>;

const TeacherDashboardBriefingOutputSchema = z.object({
  briefing: z.string().describe('A summary of the average student performance.'),
  advice: z
    .string()
    .describe(
      'Specific advice for the teacher on how to improve student performance based on the averages.'
    ),
});
export type TeacherDashboardBriefingOutput = z.infer<
  typeof TeacherDashboardBriefingOutputSchema
>;

export async function getTeacherDashboardBriefing(
  input: TeacherDashboardBriefingInput
): Promise<TeacherDashboardBriefingOutput> {
  return teacherDashboardBriefingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'teacherDashboardBriefingPrompt',
  input: { schema: TeacherDashboardBriefingInputSchema },
  output: { schema: TeacherDashboardBriefingOutputSchema },
  model: googleAI.model('gemini-3.1-flash-lite-preview'),
  prompt: `당신은 {{school}}의 체육 선생님을 위한 AI 조수입니다. 학생들의 PAPS(학생건강체력평가) 및 기타 종목 데이터를 종합적으로 분석하여 브리핑과 수업 조언을 한국어로 제공해주세요.

## 분석 데이터:
{{#if classInfo}}
### {{classInfo.grade}}학년 {{classInfo.classNum}}반 학급 브리핑
{{else}}
### 전체 학생 브리핑
- 기록이 있는 총 학생 수: {{totalStudentCount}}명
{{/if}}

{{#if paps}}
- **PAPS 분석:**
  {{#if classInfo}}
    - 학급 평균 등급: {{paps.class.averageGrade}}등급 (학년 전체 평균: {{paps.grade.averageGrade}}등급)
    - 학급 4, 5등급 학생 비율: {{paps.class.lowPerformingPercentage}}% (학년 전체: {{paps.grade.lowPerformingPercentage}}%)
    - 학급 등급 분포: {{json paps.class.gradeDistribution}}
    - 학년 전체 등급 분포: {{json paps.grade.gradeDistribution}}
  {{else}}
    - 전체 학생 PAPS 분석:
        - 평균 등급: {{paps.overall.averageGrade}}등급
        - 4, 5등급 학생 비율: {{paps.overall.lowPerformingPercentage}}%
        - 전체 등급 분포: {{json paps.overall.gradeDistribution}}
    - 학년별 PAPS 분석:
        {{#each paps.byGradeLevel}}
        - {{@key}}학년: 평균 {{this.averageGrade}}등급, 4-5등급 비율 {{this.lowPerformingPercentage}}%
        {{/each}}
  {{/if}}
  {{#if paps.byItem}}
  - 종목별 평균 등급 (분석 대상 그룹 기준):
      {{#each paps.byItem}}
      - {{@key}}: {{this.averageGrade}}등급
      {{/each}}
  {{/if}}
{{/if}}

{{#if customItems}}
- **기타 종목 분석 (종목별 평균 목표 달성률):**
    {{#each customItems}}
    - {{@key}}: {{this.averageAchievement}}%
    {{/each}}
{{/if}}

{{#if progress}}
- **주요 성장 종목 분석 (2회 이상 측정, 평균 성취도 변화량):**
    {{#each progress}}
    - {{@key}}: {{this}}%p 향상
    {{/each}}
{{/if}}

## 평가 기준:
- **PAPS 수준:**
    - **우수한 편:** 전체 평균 등급 2.5 이하
    - **부족한 편:** 전체 4~5등급 학생 비율 10% 이상
- **PAPS 종목별 수준 (평균 3등급 기준):**
    - **우수:** 평균 2.5등급 이하, **미흡:** 평균 3.5등급 이상
- **기타 종목 수준:**
    - **우수:** 평균 목표 달성률 80% 이상, **미흡:** 평균 50% 미만

## 결과 생성 가이드라인:
1.  **브리핑 (핵심 요약):**
    - **종합 평가:** PAPS 분석이 있다면 PAPS를 중심으로, 없다면 기타 종목 분석을 중심으로 전반적인 수준을 '우수한 편', '부족한 편', '보통' 등으로 평가해주세요.
    - **(학급 브리핑 시)** 학급과 학년 전체 데이터를 비교하여 평가해주세요. (예: "우리 학급 PAPS는 학년 전체 평균(2.8등급)보다 높은 2.4등급으로 우수한 수준입니다.")
    - **상세 분석:** '우수'한 종목과 '미흡'한 종목을 PAPS와 기타 종목을 통틀어 각각 1~2개씩 언급해주세요.
    - **성장 분석:** '주요 성장 종목'이 있다면 긍정적으로 언급해주세요.
    - **중요:** PAPS 종목을 언급할 때는, '윗몸 말아올리기' 대신 '근력/근지구력', '50m 달리기'나 '제자리 멀리뛰기'는 '순발력', '왕복오래달리기'나 '오래달리기'는 '심폐지구력', '앉아윗몸앞으로굽히기'는 '유연성', '악력'은 '근력'과 같이 PAPS 측정 가이드라인에 명시된 공식 '체력 요소' 이름으로 설명해주세요.
2.  **조언 (구체적 활동 제안):**
    - '미흡'한 종목에 대한 구체적인 체력 증진 프로그램이나 지도 방안을 제안해주세요. (예: '근력/근지구력'이 미흡하다면, 코어 근력 강화를 위한 플랭크, 레그레이즈 등 보강 운동 추천)
    - 전반적으로 '우수한 편'이라면, 학생들의 성과를 칭찬하고 도전적인 활동(예: 새로운 스포츠 기술 배우기, 교내 리그)을 제안해주세요.
    - **중요:** 여기서도 '윗몸 말아올리기' 같은 종목명 대신 '근력/근지구력'과 같은 '체력 요소'를 사용하여 설명해주세요.

결과는 반드시 한국어로 작성하고, 각 항목을 1-2문장의 간결하고 명확한 문장으로 요약해주세요.
`,
});

const teacherDashboardBriefingFlow = ai.defineFlow(
  {
    name: 'teacherDashboardBriefingFlow',
    inputSchema: TeacherDashboardBriefingInputSchema,
    outputSchema: TeacherDashboardBriefingOutputSchema,
  },
  async input => {
    await delay(1000);
    const { output } = await prompt(input);
    return output!;
  }
);
