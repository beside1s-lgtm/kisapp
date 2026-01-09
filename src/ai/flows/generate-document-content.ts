'use server';

/**
 * @fileOverview A document content generation AI agent.
 *
 * - generateDocumentContent - A function that generates document content based on the title, approvers, and attachments.
 * - GenerateDocumentContentInput - The input type for the generateDocumentContent function.
 * - GenerateDocumentContentOutput - The return type for the generateDocumentContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDocumentContentInputSchema = z.object({
  title: z.string().describe('The title of the document.'),
  approvers: z.array(
    z.object({
      name: z.string().describe('The name of the approver.'),
      role: z.string().describe('The role of the approver.'),
    })
  ).describe('The list of approvers for the document.'),
  attachments: z.array(
    z.object({
      name: z.string().describe('The name of the attachment.'),
      data: z.string().describe(
        "The attachment's data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
      ),
    })
  ).optional().describe('The list of attached files.'),
});
export type GenerateDocumentContentInput = z.infer<typeof GenerateDocumentContentInputSchema>;

const GenerateDocumentContentOutputSchema = z.object({
  content: z.string().describe('The generated content of the document.'),
});
export type GenerateDocumentContentOutput = z.infer<typeof GenerateDocumentContentOutputSchema>;

export async function generateDocumentContent(
  input: GenerateDocumentContentInput
): Promise<GenerateDocumentContentOutput> {
  return generateDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDocumentContentPrompt',
  input: {schema: GenerateDocumentContentInputSchema},
  output: {schema: GenerateDocumentContentOutputSchema},
  prompt: `You are an expert AI assistant specializing in drafting official documents for the Korean school system. You must generate the document content strictly following the rules below, based on the provided title, approvers, and attachments.

  **Document Content Generation Rules:**

  1.  **Follow 6W Principles:** The content must be based on Who, What, When, Where, Why, How.
  2.  **Related Document Reference (If any):** If there is a related document, state it on the very first line.
      - Example: \`1. 관련: 2025학년도 1학기 유・초등 등하교 차량 지도 계획 수립(2025.03.03.)\`
  3.  **List Item Formatting:** Strictly adhere to the standard Korean official document list hierarchy:
      - Level 1: \`1.\`, \`2.\`, ... (followed by a period and a space)
      - Level 2: \`가.\`, \`나.\`, ... (followed by a period and a space)
      - Level 3: \`1)\`, \`2)\`, ... (followed by a parenthesis and a space)
      - Level 4: \`가)\`, \`나)\`, ... (followed by a parenthesis and a space)
      - Ensure proper indentation for each level.
  4.  **Clarity over "Below/Next":** Do not use vague terms like '다음' or '아래'. Instead, specify the details directly.
      - Example: \`2026. 1. 10.(토) 14:00, 우리 기관 회의실에서 회의를 실시합니다.\`
  5.  **Date/Time Format:**
      - Dates: Use periods. e.g., \`2026. 1. 10.(토)\` (Do not use leading zeros for single-digit months/days).
      - Times: \`14:00\`
  6.  **Attachments Section (if present):**
      - If there are attachments ({{#if attachments}}...{{/if}}), create a section named '붙임'.
      - Number each attachment, followed by the file name and a period.
      - Example: \`붙임  1. 파일이름.hwp 1부.\`
  7.  **End Mark:** Conclude the entire document body with the word \`끝\`. There must be exactly two spaces between the last character of the content and the word '끝'. If attachments are present, it should look like \`... 1부.  끝.\`.

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
  
  (Here, a table can be inserted)
  
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
    const {output} = await prompt(input);
    
    // AI가 생성한 콘텐츠 끝에 " 끝." 또는 " 끝"이 있다면, 올바른 형식인 "  끝."으로 교정합니다.
    let content = output!.content;
    content = content.replace(/(\s*끝\s*\.?\s*)$/, ''); // 기존 끝 문자 제거
    content = content + '  끝.';

    return {
      content: content,
    };
  }
);
