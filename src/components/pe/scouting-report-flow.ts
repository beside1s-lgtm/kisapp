'use server';
/**
 * @fileOverview Generates an AI scouting report for a student based on their athletic performance.
 *
 * - getScoutingReport - Analyzes student data and produces a brief scouting report.
 * - ScoutingReportInput - Input schema for the report generation.
 * - ScoutingReportOutput - Output schema for the report generation.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import type { MeasurementItem } from '@/lib/pe/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AbilityScoreSchema = z.object({
  item: z.string().describe('The name of the measurement item.'),
  score: z.number().describe('The ability score for the item (0-100).'),
  category: z.string().describe('The category of the measurement item (e.g., PAPS, 농구, 배구).'),
});

const ScoutingReportInputSchema = z.object({
  studentName: z.string().describe('The name of the student being evaluated.'),
  abilityScores: z.array(AbilityScoreSchema).describe('An array of ability scores for different items.'),
  ranks: z.record(z.string()).describe("A record of the student's rank for each measurement type within their grade."),
  allItems: z.custom<MeasurementItem[]>().describe('A list of all available measurement items for context.'),
});
export type ScoutingReportInput = z.infer<typeof ScoutingReportInputSchema>;

const ScoutingReportOutputSchema = z.object({
    strengths: z.string().describe("Key strengths of the student, summarized in 1-2 bullet points."),
    weaknesses: z.string().describe("Areas for improvement for the student, summarized in 1-2 bullet points."),
    assessment: z.string().describe("An overall assessment of the student's athletic type."),
    position: z.string().describe("A recommended position based on the analysis."),
    suggestedTrainingMethods: z.string().describe('Suggested training methods to improve performance.'),
});
export type ScoutingReportOutput = z.infer<typeof ScoutingReportOutputSchema>;

export async function getScoutingReport(input: ScoutingReportInput): Promise<ScoutingReportOutput> {
  return scoutingReportFlow(input);
}

const papsFactorMap: Record<string, string> = {
    '50m 달리기': '순발력',
    '제자리 멀리뛰기': '순발력',
    '윗몸 말아올리기': '근지구력',
    '팔굽혀펴기': '근지구력',
    '무릎 대고 팔굽혀펴기': '근지구력',
    '왕복오래달리기': '심폐지구력',
    '오래달리기': '심폐지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '악력': '근력',
};

const prompt = ai.definePrompt({
  name: 'scoutingReportPrompt',
  input: { schema: ScoutingReportInputSchema },
  output: { schema: ScoutingReportOutputSchema },
  model: googleAI.model('gemini-3.0-flash'),
  prompt: `당신은 학생 선수의 잠재력을 분석하는 전문 스카우터이자 코치입니다. 주어진 데이터를 바탕으로 {{studentName}} 학생에 대한 스카우팅 리포트를 개조식으로 작성해주세요.

### 분석 데이터:
- **학생 이름:** {{studentName}}
- **능력치 점수 (100점 만점):** {{json abilityScores}}
- **학년 내 종목별 등수:** {{json ranks}}

### 리포트 작성 가이드라인:
1.  **분석 우선순위:**
    -   만약 '농구', '배구', '럭비' 등 PAPS가 아닌 특정 스포츠 카테고리가 포함되어 있다면, 해당 카테고리의 능력치를 중심으로 리포트를 작성하세요. PAPS 종목은 보조적인 체력 요소로만 간략히 언급합니다.
    -   PAPS 종목만 있다면, PAPS 체력 요소를 중심으로 분석합니다.

2.  **항목별 작성법 (개조식, 간결하게 1-2 문장 요약):**
    -   **핵심 강점:** 점수가 '높은' 1~2개 종목을 강점으로 분석합니다. 등수 정보를 활용하여 '최상위권', '상위권' 등으로 표현해 객관성을 부여하세요. (예: "- 서전트 점프는 학년 내 최상위권으로, 높은 타점의 공격과 블로킹에 결정적인 이점을 제공합니다.")
    -   **보완점:** 상대적으로 점수가 '낮은' 1~2개 종목을 약점으로 분석합니다.
    -   **종합 평가 (선수 유형):** 강점을 종합하여 학생의 선수 유형을 한 문장으로 정의합니다. (예: "폭발적인 순발력과 파워를 겸비한 공격형 선수.")
    -   **추천 포지션:** 분석 내용을 바탕으로 가장 적합한 포지션을 추천합니다. (예: "아포짓 스파이커(라이트 공격수) 또는 미들 블로커")
    -   **추천 훈련 방법:** 분석된 '약점'을 보완하고 전반적인 체력을 향상시키기 위한 구체적이고 실행 가능한 훈련 방법을 제안하세요.
    -   **주의:** 리포트에 구체적인 점수나 등수를 절대 언급하지 마세요.

3.  **PAPS 체력 요소 참고:**
    -   순발력: 50m 달리기, 제자리 멀리뛰기
    -   근지구력: 윗몸 말아올리기, 팔굽혀펴기
    -   심폐지구력: 왕복오래달리기
    -   유연성: 앉아윗몸앞으로굽히기
    -   근력: 악력
`,
});

const scoutingReportFlow = ai.defineFlow(
  {
    name: 'scoutingReportFlow',
    inputSchema: ScoutingReportInputSchema,
    outputSchema: ScoutingReportOutputSchema,
  },
  async (input) => {
    const enrichedScores = input.abilityScores.map(score => {
        const itemInfo = input.allItems.find(i => i.name === score.item);
        return {
            ...score,
            category: itemInfo?.category || '기타',
        };
    });
    
    const enrichedInput = { ...input, abilityScores: enrichedScores };

    await delay(1000);
    const { output } = await prompt(enrichedInput);
    return output!;
  }
);
