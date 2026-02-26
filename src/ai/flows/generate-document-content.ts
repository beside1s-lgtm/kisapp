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

  **Document Content Generation Rules:**

  1.  **Brevity and Conciseness:** The main body of the document must be concise and to the point. Detailed descriptions, data, or complex plans should be placed in attached files. The main body should summarize the key points and refer to the attachments.
  2.  **6W Principles:** The content must be based on Who, What, When, Where, Why, How.
  3.  **Related Document Reference (If any):** If there is a related document, state it on the very first line.
      - Example: \`1. 관련: 2025학년도 1학기 유・초등 등하교 차량 지도 계획 수립(2025.03.03.)\`
  4.  **List Item Formatting:** Strictly adhere to the standard Korean official document list hierarchy.
      - Level 1: \`1.\`, \`2.\`, ...
      - Level 2: \`가.\`, \`나.\`, ...
      - Level 3: \`1)\`, \`2)\`, ...
      - Level 4: \`가)\`, \`나)\`, ...
      - **CRITICAL**: When an item's content spans multiple lines, the subsequent lines must be indented to align vertically with the text of the first line.
  5.  **Clarity over "Below/Next":** Do not use vague terms like '다음' or '아래'. Instead, specify the details directly.
  6.  **Date/Time Format:**
      - Dates: Use periods. e.g., \`2026. 1. 10.(토)\`
      - Times: \`14:00\`
  7.  **Attachments Section (if present):**
      - Section named '붙임'.
      - Number each attachment, followed by the file name and a period.
      - Example: \`붙임  1. 파일이름.hwp 1부.\`
  8.  **End Mark:** Conclude with the word \`끝\`. There must be exactly two spaces before '끝'.

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

  **Example of a perfectly formatted document:**
  \`\`\`
  1. 관련: Kish-초등-18(2025.3.18.) 2025학년도 학교폭력예방교육 운영계획
  2. 2025학년도 2학기 학교폭력예방교육을 다음과 같이 실시하고자 합니다.
     가. 교원 연수
         1) 일시: 2025.8.22.(금) 16:30~
         2) 내용: 사이버 폭력의 예방 및 조치 방법에 관한 안내
     나. 학생 교육
         1) 일 시: 2025.8.25.(월) ~ 8.27.(수)
         2) 학년별 세부 교육계획

  | 대상학년 | 교육강사 | 교육장소 | 교육일시 |
  |---|---|---|---|
  | 1·2학년 | 외부강사 | 가온홀 | 8.25.(월) 3교시 |
  | 5, 6학년 | 화상교육 | 각반교실 | 8.27.(수) 7교시 |
  | 3, 4학년 | 외부강사 | 각반교실 | 8.29.(금) 7교시 |

  붙임  1. 학교폭력예방교육 교사연수 자료(사이버 폭력) 1부.
        2. 학교폭력예방교육강의 원고 1부.
        3. 강사 신분증 사본 1부.  끝.
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

    // 1. 끝 마크 교정
    content = content.replace(/(\s*끝\s*\.?\s*)$/, '');
    content = content.trim() + '  끝.';

    // 2. 줄바꿈 보정
    content = content.replace(/(^|\n)(\d+\.\s)/g, '\n$2');       // Level 1
    content = content.replace(/(^|\n)([가-힣]\.\s)/g, '\n   $2'); // Level 2
    content = content.replace(/(^|\n)(\d+\)\s)/g, '\n       $2'); // Level 3
    content = content.replace(/(^|\n)([가-힣]\)\s)/g, '\n          $2'); // Level 4

    // 붙임 섹션
    content = content.replace(/(^|\n)(붙임)/g, '\n$2');

    // 표 앞뒤 줄바꿈
    content = content.replace(/(\|---\|)/g, '\n$1\n');

    return {
      content,
    };
  }
);