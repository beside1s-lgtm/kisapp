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
  prompt: `You are an AI assistant specialized in generating document content based on the provided title, approvers, and attachments.

  Please generate content for a document with the following information:

  Title: {{{title}}}
  Approvers:
  {{#each approvers}}
  - Name: {{{name}}}, Role: {{{role}}}
  {{/each}}

  {{#if attachments}}
  Attachments:
  {{#each attachments}}
  - Name: {{{name}}}
  {{/each}}
  {{/if}}
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
    return {
      content: output!.content,
    };
  }
);
