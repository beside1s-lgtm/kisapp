'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Grid3X3,
  Trash2,
  Palette,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// ✅ 커스텀 TableCell 확장: 셀 배경색 속성 추가
const ColoredTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-background-color'),
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
            'data-background-color': attributes.backgroundColor,
          };
        },
      },
    };
  },
});

interface RichEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export default function RichEditor({ value, onChange }: RichEditorProps) {
  const [showColorPalette, setShowColorPalette] = useState(false);

  const predefinedColors = [
    // 검정
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC',
    // 빨강
    '#330000', '#660000', '#990000', '#CC0000', '#FF0000',
    // 파랑
    '#000033', '#000066', '#000099', '#0000CC', '#0000FF',
    // 초록
    '#003300', '#006600', '#009900', '#00CC00', '#00FF00',
    // 노랑
    '#333300', '#666600', '#999900', '#CCCC00', '#FFFF00',
  ];

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      ColoredTableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[400px] border rounded-md bg-white p-4',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border rounded-md bg-white flex flex-col shadow-sm">
      {/* 툴바 */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50 sticky top-0 z-10 rounded-t-md items-center">
        {/* 글자 스타일 */}
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

        {/* 리스트 */}
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

        {/* 표 삽입 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const rows = parseInt(prompt('행 개수?', '3') || '3', 10);
            const cols = parseInt(prompt('열 개수?', '3') || '3', 10);
            editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
          }}
          title="표 삽입"
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

        {/* 행/열 편집 */}
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowAfter().run()}>
          행 추가
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteRow().run()}>
          행 삭제
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnAfter().run()}>
          열 추가
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteColumn().run()}>
          열 삭제
        </Button>

        {/* 셀 병합/해제 */}
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().mergeCells().run()}>
          셀 병합
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().splitCell().run()}>
          셀 해제
        </Button>

        {/* 셀 색상 팔레트 토글 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowColorPalette(!showColorPalette)}
          title="셀 색상"
        >
          <Palette className="h-4 w-4 mr-1" /> 셀 색상
        </Button>
      </div>

      {/* 색상 팔레트 */}
      {showColorPalette && (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border-b">
          {predefinedColors.map((hex) => (
            <button
              key={hex}
              onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', hex).run()}
              style={{
                backgroundColor: hex,
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
              title={hex}
            />
          ))}
        </div>
      )}

      {/* 에디터 본문 */}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}