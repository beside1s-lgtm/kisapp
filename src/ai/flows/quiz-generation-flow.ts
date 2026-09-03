'use server';
/**
 * @fileOverview 체육 이론 평가 문제를 자동 생성하는 Genkit 플로우입니다.
 *
 * - generateQuiz - 학습 자료를 바탕으로 퀴즈를 생성하는 함수
 * - QuizInput - 입력 데이터 스키마 (텍스트 내용, 문제 수)
 * - QuizOutput - 생성된 퀴즈 데이터 스키마 (문제 목록)
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const QuestionTypeSchema = z.enum(['multiple-choice', 'short-answer', 'ox', 'fill-in-the-blanks']);

const QuestionSchema = z.object({
  type: QuestionTypeSchema.describe('문제 유형 (multiple-choice: 4지선다, short-answer: 단답형, ox: OX문제, fill-in-the-blanks: 문장 완성)'),
  question: z.string().describe('문제 내용'),
  options: z.array(z.string()).optional().describe('객관성 또는 보기 제시형 문제의 선택지 (4개 또는 보기 단어들)'),
  answer: z.string().describe('정답 (객관식의 경우 선택지 번호가 아닌 정답 텍스트 내용을 그대로 적으세요)'),
  explanation: z.string().describe('정답에 대한 간단한 해설'),
});

const QuizInputSchema = z.object({
  content: z.string().describe('문제를 출제할 기반이 되는 학습 자료 내용'),
  count: z.number().min(1).max(20).describe('출제할 문제 수'),
});
export type QuizInput = z.infer<typeof QuizInputSchema>;

const QuizOutputSchema = z.object({
  quizTitle: z.string().describe('학습 자료를 바탕으로 정해진 퀴즈 제목'),
  questions: z.array(QuestionSchema).describe('생성된 문제 목록'),
});
export type QuizOutput = z.infer<typeof QuizOutputSchema>;

export async function generateQuiz(input: QuizInput): Promise<QuizOutput> {
  return quizGenerationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quizGenerationPrompt',
  input: { schema: QuizInputSchema },
  output: { schema: QuizOutputSchema },
  model: googleAI.model('gemini-3.1-flash-lite-preview'),
  prompt: `당신은 전문 체육 교사이며 교육 평가 전문가입니다. 주어진 '학습 자료 내용'을 바탕으로 학생들의 이해도를 측정할 수 있는 이론 평가 문제를 출제해주세요.

### 출제 지침:
1. **내용 충실성:** 반드시 제공된 '학습 자료 내용'에 근거하여 문제를 출제하세요. 자료에 없는 내용은 출제하지 마세요.
2. **유형 다양성:** 아래 4가지 유형을 골고루 섞어서 {{count}}개의 문제를 만드세요.
   - **multiple-choice (4지선다형):** 가장 적절한 것을 고르는 문제. 보기는 4개여야 합니다. **정답(answer)에는 선택한 번호가 아닌 해당 보기의 텍스트 내용을 적으세요.**
   - **short-answer (단답형):** 핵심 용어를 직접 쓰는 문제.
   - **ox (OX문제):** 설명이 맞으면 O, 틀리면 X를 선택하는 문제.
   - **fill-in-the-blanks (문장 완성):** 문장 중간에 빈칸을 두고, 보기(options)로 단어를 제시하여 알맞은 것을 골라 채우게 하는 문제.
3. **난이도 조절:** 초등학생 및 중학생이 이해할 수 있는 수준으로 명확하고 간결한 문장을 사용하세요.
4. **자동 채점:** 모든 문제는 정답이 명확해야 하며, 주관적인 서술형은 제외하세요.
5. **언어:** 모든 내용은 한국어로 작성하세요.

### 학습 자료 내용:
{{{content}}}

### 출제 문항 수: {{count}}개
`,
});

const quizGenerationFlow = ai.defineFlow(
  {
    name: 'quizGenerationFlow',
    inputSchema: QuizInputSchema,
    outputSchema: QuizOutputSchema,
  },
  async (input) => {
    await delay(500);
    const { output } = await prompt(input);
    if (!output) throw new Error('퀴즈 생성에 실패했습니다.');
    return output;
  }
);
