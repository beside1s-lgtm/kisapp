'use server';
/**
 * @fileOverview Generates a brief AI-powered summary for a student's growth report.
 *
 * - getReportBriefing - Analyzes a student's PAPS summary and provides a short briefing.
 * - ReportBriefingInput - Input schema for the briefing generation.
 * - ReportBriefingOutput - Output schema for the briefing generation.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PapsSummaryItemSchema = z.object({
  factor: z.string().describe('The PAPS fitness factor (e.g., 심폐지구력).'),
  itemName: z.string().describe('The name of the measurement item.'),
  grade: z.number().nullable().describe('The grade for the item (1-5).'),
  score: z.number().nullable().describe('The score for the item (0-20).'),
});

const ReportBriefingInputSchema = z.object({
  studentName: z.string().describe("The student's name."),
  overallGrade: z.string().describe("The student's overall PAPS grade."),
  papsSummary: z.array(PapsSummaryItemSchema).describe('An array of the student\'s latest PAPS results by factor.'),
});
export type ReportBriefingInput = z.infer<typeof ReportBriefingInputSchema>;

const ReportBriefingOutputSchema = z.object({
  briefing: z.string().describe('A 3-sentence summary of the student\'s fitness level and recommended exercises.'),
});
export type ReportBriefingOutput = z.infer<typeof ReportBriefingOutputSchema>;

export async function getReportBriefing(input: ReportBriefingInput): Promise<ReportBriefingOutput> {
  return reportBriefingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'reportBriefingPrompt',
  input: { schema: ReportBriefingInputSchema },
  output: { schema: ReportBriefingOutputSchema },
  model: googleAI.model('gemini-3.1-flash-lite-preview'),
  prompt: async (input) => `당신은 학생의 PAPS(학생건강체력평가) 결과를 분석하고 종합적인 피드백을 제공하는 전문 체육 코치입니다.

### 분석 데이터:
- 학생 이름: ${input.studentName}
- PAPS 종합 등급: ${input.overallGrade}
- PAPS 요인별 상세 결과: ${JSON.stringify(input.papsSummary)}

### 작성 가이드라인:
1.  **종합 평가:** '종합 등급'을 바탕으로 학생의 현재 체력 수준을 한 문장으로 평가해주세요. (예: "${input.studentName} 학생은 현재 ${input.overallGrade} 수준의 균형 잡힌 체력을 가지고 있습니다.")
2.  **강점 및 보완점:** '요인별 상세 결과'에서 점수(score)가 가장 높은 요인 하나를 강점으로, 가장 낮은 요인 하나를 보완점으로 언급하며 한 문장으로 요약해주세요.
3.  **추천 운동:** 보완점을 개선할 수 있는 구체적이고 간단한 운동 1~2가지를 추천하며 한 문장으로 마무리해주세요.
4.  전체 내용은 반드시 **3문장 이내**의 간결하고 긍정적인 문체로 작성해주세요. 학생에게 직접 말하는 것처럼 친근한 어조를 사용하세요.
5.  **중요:** 종합 브리핑과 추천 운동에서 '앉아윗몸앞으로굽히기' 같은 종목명 대신 '유연성', '50m 달리기' 대신 '순발력', '왕복오래달리기' 대신 '심폐지구력', '윗몸 말아올리기' 대신 '근지구력'과 같이 PAPS 측정 가이드라인에 제시된 '체력 요소' 이름으로 설명해주세요.
`,
});

const reportBriefingFlow = ai.defineFlow(
  {
    name: 'reportBriefingFlow',
    inputSchema: ReportBriefingInputSchema,
    outputSchema: ReportBriefingOutputSchema,
  },
  async (input) => {
    await delay(1000);
    const { output } = await prompt(input);
    return output!;
  }
);
