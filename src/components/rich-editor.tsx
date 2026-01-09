'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered, Grid3X3, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

interface RichEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export default function RichEditor({ value, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
        attributes: {
            class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[400px] border rounded-md bg-white p-4',
        },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    // [수정] SSR 환경에서의 Hydration 오류 방지
    immediatelyRender: false, 
  });

  // 외부에서 value가 바뀌면 에디터 내용 업데이트 (AI 생성 시 등)
  useEffect(() => {
      if (editor && value && editor.getHTML() !== value) {
          editor.commands.setContent(value);
      }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-md bg-white flex flex-col shadow-sm">
      {/* 툴바 */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50 sticky top-0 z-10 rounded-t-md items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-gray-200' : ''}
          title="굵게"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-gray-200' : ''}
          title="기울임"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-gray-200' : ''}
          title="글머리 기호"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-gray-200' : ''}
          title="번호 매기기"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
        
        {/* 표 관련 버튼 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="표 삽입 (3x3)"
        >
          <Grid3X3 className="h-4 w-4 mr-1" /> 표 삽입
        </Button>
        
        {editor.can().deleteTable() && (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                title="표 삭제"
            >
                <Trash2 className="h-4 w-4 mr-1" /> 표 삭제
            </Button>
        )}
      </div>
      
      {/* 에디터 본문 */}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}