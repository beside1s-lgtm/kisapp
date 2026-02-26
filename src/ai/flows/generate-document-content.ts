'use server';

/**
 * @fileOverview A document content generation AI agent.
 *
 * - generateDocumentContent - A function that generates document content based on the title, approvers, and attachments.
 * - GenerateDocumentContentInput - The input type for the generateDocumentContent function.
 * - GenerateDocumentContentOutput - The return type for the generateDocumentContent function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateDocumentContentInputSchema = z.object({
  title: z.string().describe('The title of the document.'),
  approvers: z
    .array(
      z.object({
        name: z.string().describe('The name of the approver.'),
        role: z.string().describe('The role of the approver.'),
      })
    )
    .describe('The list of approvers for the document.'),
  attachments: z
    .array(
      z.object({
        name: z.string().describe('The name of the attachment.'),
        data: z
          .string()
          .describe(
            "The attachment's data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
          ),
      })
    )
    .optional()
    .describe('The list of attached files.'),
});
export type GenerateDocumentContentInput = z.infer<
  typeof GenerateDocumentContentInputSchema
>;

const GenerateDocumentContentOutputSchema = z.object({
  content: z.string().describe('The generated content of the document.'),
});
export type GenerateDocumentContentOutput = z.infer<
  typeof GenerateDocumentContentOutputSchema
>;

export async function generateDocumentContent(
  input: GenerateDocumentContentInput
): Promise<GenerateDocumentContentOutput> {
  return generateDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDocumentContentPrompt',
  input: { schema: GenerateDocumentContentInputSchema },
  output: { schema: GenerateDocumentContentOutputSchema },
  prompt: `You are an expert AI assistant specializing in drafting official documents for the Korean school system. You must generate the document content strictly following the rules below, based on the provided title, approvers, and attachments.

  **Document Content Generation Rules (CRITICAL):**

  1.  **Output Format (HTML):** You MUST output valid HTML tags. DO NOT use Markdown. The rich text editor requires HTML. Use <p>, <br>, <table>, <thead>, <tbody>, <tr>, <th>, and <td> tags.
  2.  **Indentation (Non-breaking Spaces):** Standard HTML spaces are ignored by browsers. You MUST use HTML non-breaking spaces (\`&nbsp;\`) to strictly adhere to the standard Korean official document list hierarchy.
      - Level 1 (No indent): \`1. 관련:\`
      - Level 2 (2 spaces): \`&nbsp;&nbsp;가. 교원 연수\`
      - Level 3 (4 spaces): \`&nbsp;&nbsp;&nbsp;&nbsp;1) 일시:\`
      - Level 4 (6 spaces): \`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;가) 장소:\`
  3.  **Brevity and Conciseness:** Summarize key points based on the 6W Principles (Who, What, When, Where, Why, How). Do not use vague terms like '다음' or '아래' without explaining immediately.
  4.  **Date/Time Format:**
      - Dates: Use periods. e.g., \`2026. 1. 10.(토)\`
      - Times: \`16:30~\`
  5.  **Tables:** If detailed schedules or plans are needed, use an HTML table. Apply \`border="1"\` and \`style="border-collapse: collapse; width: 100%;"\` to the table tag.
  6.  **Attachments Section:**
      - Must be placed at the bottom.
      - Align the numbers vertically using \`&nbsp;\`.
  7.  **End Mark:** Conclude the final sentence with \`&nbsp;&nbsp;끝.\`

  **Document Information:**
  - Title: {{{title}}}
  - Approvers:
    {{#each approvers}}
    - Name: {{{name}}}, Role: {{{role}}}
    {{/each}}
  - Attachments:
    {{#if attachments}}
      {{#each attachments}}
      - Name: {{{name}}}
      {{/each}}
    {{else}}
      No attachments provided.
    {{/if}}

  ---

  **Example of a perfectly formatted HTML document (Use this as your template):**
  \`\`\`html
  <p>1. 관련: Kish-초등-18(2025.3.18.) 2025학년도 학교폭력예방교육 운영계획</p>
  <p>2. 2025학년도 2학기 학교폭력예방교육을 다음과 같이 실시하고자 합니다.<br>
  &nbsp;&nbsp;가. 교원 연수<br>
  &nbsp;&nbsp;&nbsp;&nbsp;1) 일시: 2025. 8. 22.(금) 16:30~<br>
  &nbsp;&nbsp;&nbsp;&nbsp;2) 내용: 사이버 폭력의 예방 및 조치 방법에 관한 안내<br>
  &nbsp;&nbsp;나. 학생 교육<br>
  &nbsp;&nbsp;&nbsp;&nbsp;1) 일시: 2025. 8. 25.(월) ~ 8. 27.(수)<br>
  &nbsp;&nbsp;&nbsp;&nbsp;2) 학년별 세부 교육계획</p>
  <table border="1" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr><th>대상학년</th><th>교육강사</th><th>교육장소</th><th>교육일시</th></tr>
    </thead>
    <tbody>
      <tr><td>1·2학년</td><td>외부강사</td><td>가온홀</td><td>8. 25.(월) 3교시</td></tr>
      <tr><td>5, 6학년</td><td>화상교육</td><td>각반교실</td><td>8. 27.(수) 7교시</td></tr>
    </tbody>
  </table>
  <p>&nbsp;&nbsp;&nbsp;&nbsp;3) 강사 및 강사료<br>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;가) 강사: 강사 조태현 (서울길원초 교사)<br>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;나) 강사료: 총 9,906,000VND</p>
  <p>붙임&nbsp;&nbsp;1. 학교폭력예방교육 교사연수 자료 1부.<br>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. 학교폭력예방교육강의 원고 1부.&nbsp;&nbsp;끝.</p>
  \`\`\`

  Now, generate the content for the document with the title "{{{title}}}" following all the rules meticulously.
  `,
});

const generateDocumentContentFlow = ai.defineFlow(
  {
    name: 'generateDocumentContentFlow',
    inputSchema: GenerateDocumentContentInputSchema,
    outputSchema: GenerateDocumentContentOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);

    let content = output!.content;

    // 1. AI가 마크다운 코드 블록(```html)을 출력했을 경우 제거
    content = content.replace(/```html/gi, '');
    content = content.replace(/```/g, '');

    // 2. [중요] 줄바꿈(Enter) 문자 제거
    // 폼 에디터(document-form.tsx)가 \n을 <br>로 강제 변환하기 때문에,
    // HTML <table> 내부에 <br>이 삽입되어 표가 깨지는 현상을 방지합니다.
    content = content.replace(/\n/g, '');

    return {
      content: content.trim(),
    };
  }
);