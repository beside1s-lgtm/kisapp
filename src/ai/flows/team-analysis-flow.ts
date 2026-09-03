'use server';
/**
 * @fileOverview Generates an AI analysis report for a sports team based on average ability scores.
 *
 * - getTeamAnalysis - Analyzes team data and produces a brief analysis report.
 * - TeamAnalysisInput - Input schema for the report generation.
 * - TeamAnalysisOutput - Output schema for the report generation.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AbilityScoreSchema = z.object({
  item: z.string().describe('The name of the measurement item.'),
  score: z.number().describe('The average ability score for the item (0-100).'),
});

const TeamAnalysisInputSchema = z.object({
  teamName: z.string().describe('The name of the team being analyzed.'),
  abilityScores: z.array(AbilityScoreSchema).describe('An array of average ability scores for the team.'),
});
export type TeamAnalysisInput = z.infer<typeof TeamAnalysisInputSchema>;

const TeamAnalysisOutputSchema = z.object({
  strengths: z.string().describe("Key strengths of the team, summarized in 1-2 bullet points."),
  weaknesses: z.string().describe("Areas for improvement for the team, summarized in 1-2 bullet points."),
  assessment: z.string().describe("An overall assessment of the team's type and character."),
  strategy: z.string().describe("A recommended strategy or focus for the team.")
});
export type TeamAnalysisOutput = z.infer<typeof TeamAnalysisOutputSchema>;

export async function getTeamAnalysis(input: TeamAnalysisInput): Promise<TeamAnalysisOutput> {
  return teamAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'teamAnalysisPrompt',
  input: { schema: TeamAnalysisInputSchema },
  output: { schema: TeamAnalysisOutputSchema },
  model: googleAI.model('gemini-3.1-flash-lite-preview'),
  prompt: `당신은 스포츠 팀의 전력을 분석하는 전문 분석가입니다. 주어진 팀의 평균 능력치 데이터를 바탕으로 {{teamName}}에 대한 전력 분석 리포트를 개조식으로 작성해주세요.

### 분석 데이터:
- **팀 이름:** {{teamName}}
- **팀 평균 능력치 점수 (100점 만점):** {{json abilityScores}}

### 리포트 작성 가이드라인 (개조식, 간결하게 1-2 문장 요약):
1.  **핵심 강점:** 평균 점수가 '높은' 1~2개 항목을 팀의 강점으로 분석합니다. 이 강점이 팀 플레이에 어떤 시너지를 만들어내는지 설명해주세요. (예: "- 높은 서전트 점프와 순발력을 바탕으로 한 강력한 높이의 공격과 블로킹이 최대 강점입니다.")
2.  **보완점:** 상대적으로 평균 점수가 '낮은' 1~2개 항목을 팀의 약점으로 분석하고, 이것이 팀의 어떤 약점으로 이어지는지 설명해주세요.
3.  **종합 평가 (팀 컬러):** 강점을 종합하여 팀의 컬러를 한 문장으로 정의합니다. (예: "강력한 공격력을 앞세운 파워형 팀.")
4.  **추천 전략:** 분석 내용을 바탕으로 팀이 집중해야 할 훈련이나 전략을 추천합니다. (예: "수비 조직력을 강화하여 강한 공격력을 더욱 효과적으로 활용하는 전략이 필요합니다.")
`,
});

const teamAnalysisFlow = ai.defineFlow(
  {
    name: 'teamAnalysisFlow',
    inputSchema: TeamAnalysisInputSchema,
    outputSchema: TeamAnalysisOutputSchema,
  },
  async (input) => {
    await delay(1000);
    const { output } = await prompt(input);
    return output!;
  }
);
