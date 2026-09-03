'use server';

/**
 * @fileOverview An AI agent that provides feedback to students based on their exercise performance results.
 *
 * - getStudentFeedback - A function that generates feedback for a student based on their exercise performance.
 * - StudentFeedbackInput - The input type for the getStudentFeedback function.
 * - StudentFeedbackOutput - The return type for the getFEedback function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const StudentFeedbackInputSchema = z.object({
  school: z.string().describe('The school of the student.'),
  studentName: z.string().describe('The name of the student.'),
  exerciseType: z.string().describe('The type of exercise performed.'),
  performanceResult: z
    .string()
    .describe('The performance result of the single exercise.'),
  grade: z.string().describe('The grade of the student'),
  classNumber: z.string().describe('The class number of the student'),
  studentNumber: z.string().describe('The student number of the student'),
  gender: z.enum(['남', '여']).describe('The gender of the student'),
  rank: z.string().optional().describe("The student's rank for this specific exercise."),
});
export type StudentFeedbackInput = z.infer<typeof StudentFeedbackInputSchema>;

const StudentFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The AI-generated feedback for the student.'),
});
export type StudentFeedbackOutput = z.infer<typeof StudentFeedbackOutputSchema>;

export async function getStudentFeedback(input: StudentFeedbackInput): Promise<StudentFeedbackOutput> {
  return studentFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'studentFeedbackPrompt',
  input: { schema: StudentFeedbackInputSchema },
  output: { schema: StudentFeedbackOutputSchema },
  model: googleAI.model('gemini-3.1-flash-lite-preview'),
  prompt: `당신은 학생의 운동 성과에 대해 한국어로 동기 부여가 되는 피드백을 제공하는 AI 코치입니다.

학생 정보:
- 학교: {{school}}
- 이름: {{studentName}}
- 학년: {{grade}}
- 반: {{classNumber}}
- 번호: {{studentNumber}}
- 성별: {{gender}}

운동 정보:
- 종목: {{exerciseType}}
- 결과: {{performanceResult}}
- 등수: {{rank}}

주어진 학생의 기록과 등수 정보를 바탕으로, 학생의 학년과 성별에 맞는 학생건강체력평가(PAPS) 기준을 내부적으로 참고하여 학생의 현재 수준을 평가하고, 개인화된 피드백을 한국어로 작성해주세요.

피드백 작성 가이드라인:
1.  학생의 학년과 성별에 맞는 PAPS 기준을 바탕으로, 기록이 몇 등급에 해당하는지 분석해주세요.
2.  학생의 강점과 개선점을 등급과 함께 명확히 짚어주세요. 등수 정보가 있다면 활용하여 현재 위치를 알려주세요. (예: "50m 달리기는 1등급으로, 전체 학생 중 3등을 차지할 만큼 아주 빨라!")
3.  미래 성장을 위한 구체적인 조언을 제공해주세요.
4.  피드백은 격려와 지지를 담아 긍정적인 어조로 작성하고, 학생의 이름을 부르며 직접 대화하는 것처럼 작성해주세요.
5.  주어진 정보 외에 다른 내용을 만들지 마세요. 피드백은 200자 이내로 간결하게 작성해주세요.
`,
});

const studentFeedbackFlow = ai.defineFlow(
  {
    name: 'studentFeedbackFlow',
    inputSchema: StudentFeedbackInputSchema,
    outputSchema: StudentFeedbackOutputSchema,
  },
  async input => {
    await delay(1000);
    const { output } = await prompt(input);
    return output!;
  }
);
