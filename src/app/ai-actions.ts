'use server';

import { generateDocumentContent } from '@/ai/flows/generate-document-content';
import { z } from 'zod';

export async function generateContentAction(input: any) {
    const parsedInput = z.object({
        title: z.string(),
        approvers: z.array(z.any()),
        attachments: z.array(z.any()).optional(),
    }).safeParse(input);

    if (!parsedInput.success) {
        return { success: false, error: '유효하지 않은 입력입니다.' };
    }
    try {
        const result = await generateDocumentContent(parsedInput.data);
        return { success: true, content: result.content };
    } catch (e: any) {
        console.error("AI Generation Error: ", e);
        return { success: false, error: 'AI 콘텐츠 생성에 실패했습니다: ' + e.message };
    }
}