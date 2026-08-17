'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Baseline,
  Grid3X3,
  Trash2,
  Palette,
  Info,
  Sparkles,
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

const specialCharCategories = [
  {
    category: '기호·도형',
    chars: ['※', '★', '☆', '◆', '◇', '■', '□', '▲', '△', '▼', '▽', '▶', '▷', '◀', '◁', '○', '●', '◎', '✔', '✓']
  },
  {
    category: '괄호·인용',
    chars: ['「', '」', '『', '』', '【', '】', '〈', '〉', '《', '》', '〔', '〕', '(', ')', '[', ']', '{', '}']
  },
  {
    category: '원문자',
    chars: ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '㉮', '㉯', '㉰', '㉱', '㉲', '㉳']
  },
  {
    category: '수학·단위',
    chars: ['±', '×', '÷', '≠', '≤', '≥', '∞', '℃', '℉', '％', '‰', '₩', '＄', '￥', '€', '°', '㎡', '㎥']
  },
  {
    category: '화살표·구분',
    chars: ['→', '←', '↑', '↓', '↔', '⇒', '⇔', '·', 'ㆍ', '…', '～', '–', '—']
  }
];

const textColors = [
  '#000000', '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0284c7', '#2563eb', '#7c3aed', '#db2777', '#4b5563'
];

export default function RichEditor({ value, onChange }: RichEditorProps) {
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showTextColorPalette, setShowTextColorPalette] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);
  const [selectedCharCategory, setSelectedCharCategory] = useState(0);

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
      Underline,
      TextStyle,
      Color,
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
      {/* 툴바 (가운데 정렬) */}
      <div className="flex flex-wrap gap-1.5 p-2 border-b bg-gray-50 sticky top-0 z-10 rounded-t-md items-center justify-center">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-gray-200' : ''}
          title="밑줄"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowTextColorPalette(!showTextColorPalette);
            if (!showTextColorPalette) {
              setShowColorPalette(false);
              setShowSpecialChars(false);
            }
          }}
          className={showTextColorPalette ? 'bg-indigo-100 text-indigo-700 font-bold' : ''}
          title="글자 색상"
        >
          <Baseline className="h-4 w-4" />
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

        {/* 표 내부 커서 위치 시에만 나타나는 표 편집 도구 모음 */}
        {editor.isActive('table') && (
          <>
            <div className="w-px h-6 bg-indigo-200 mx-1 self-center" />
            <div className="flex items-center gap-0.5 bg-indigo-50/90 px-1.5 py-0.5 rounded-md border border-indigo-100 animate-in fade-in duration-150">
              <span className="text-[11px] font-bold text-indigo-700 px-1 select-none">표 편집:</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600" onClick={() => editor.chain().focus().addRowAfter().run()} title="아래에 행 추가">
                행+
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600" onClick={() => editor.chain().focus().deleteRow().run()} title="현재 행 삭제">
                행-
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600" onClick={() => editor.chain().focus().addColumnAfter().run()} title="오른쪽에 열 추가">
                열+
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600" onClick={() => editor.chain().focus().deleteColumn().run()} title="현재 열 삭제">
                열-
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600" onClick={() => editor.chain().focus().mergeCells().run()} title="선택한 셀 병합">
                병합
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600" onClick={() => editor.chain().focus().splitCell().run()} title="병합된 셀 분할(해제)">
                해제
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-7 px-1.5 text-xs text-indigo-900 hover:bg-white hover:text-indigo-600 ${showColorPalette ? 'bg-white text-indigo-600 font-bold shadow-sm' : ''}`}
                onClick={() => {
                  setShowColorPalette(!showColorPalette);
                  if (!showColorPalette) setShowSpecialChars(false);
                }}
                title="셀 배경 색상 지정"
              >
                <Palette className="h-3.5 w-3.5 mr-1" /> 색상
              </Button>
              {editor.can().deleteTable() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="h-7 px-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  title="표 전체 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
                </Button>
              )}
            </div>
          </>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1 self-center" />

        {/* 특수문자 팔레트 토글 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowSpecialChars(!showSpecialChars);
            if (!showSpecialChars) setShowColorPalette(false);
          }}
          className={showSpecialChars ? 'bg-indigo-100 text-indigo-700 font-bold' : ''}
          title="공문서 특수문자 입력"
        >
          <span className="text-sm font-bold mr-1 text-indigo-600">※</span> 특수문자
        </Button>
      </div>

      {/* 글자 색상 팔레트 */}
      {showTextColorPalette && (
        <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border-b justify-center items-center">
          <span className="text-xs font-bold text-slate-600 mr-1 select-none">글자 색상:</span>
          {textColors.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                editor.chain().focus().setColor(hex).run();
              }}
              style={{
                backgroundColor: hex,
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
              title={hex}
            />
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editor.chain().focus().unsetColor().run();
            }}
            className="text-xs px-2 py-1 bg-white border border-slate-300 rounded font-medium text-slate-600 hover:bg-slate-100 ml-1"
            title="기본 검정색으로 초기화"
          >
            기본색
          </button>
        </div>
      )}

      {/* 특수문자 선택 팔레트 */}
      {showSpecialChars && (
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 select-none">
          {/* 카테고리 탭 */}
          <div className="flex gap-1.5 mb-2 border-b border-slate-200 pb-2 overflow-x-auto">
            {specialCharCategories.map((cat, idx) => (
              <button
                key={cat.category}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedCharCategory(idx);
                }}
                className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all shrink-0 ${
                  selectedCharCategory === idx
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat.category}
              </button>
            ))}
          </div>

          {/* 특수문자 목록 */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
            {specialCharCategories[selectedCharCategory].chars.map((char, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  editor.chain().focus().insertContent(char).run();
                }}
                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 rounded text-sm font-bold text-slate-800 transition-all shadow-sm active:scale-95"
                title={`'${char}' 삽입`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 색상 팔레트 */}
      {showColorPalette && (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border-b justify-center">
          {predefinedColors.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                editor.chain().focus().setCellAttribute('backgroundColor', hex).run();
              }}
              style={{
                backgroundColor: hex,
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                cursor: 'pointer',
              }}
              title={hex}
            />
          ))}
        </div>
      )}

      {/* 에디터 본문 및 세로형 사이드 퀵 패널 */}
      <div className="flex flex-1 min-h-[420px] bg-white rounded-b-md relative">
        {/* 좌측 세로형 공문서 빠른 입력 도구바 */}
        <div className="w-24 sm:w-28 bg-slate-50/90 border-r border-slate-200 p-2 flex flex-col gap-1.5 shrink-0 select-none">
          <div className="text-[11px] font-bold text-slate-500 pb-1 border-b border-slate-200 text-center tracking-tight">
            항목 빠른 입력
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 justify-start text-xs font-bold text-slate-800 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border-slate-200 shadow-none transition-colors"
            onClick={() => editor.chain().focus().insertContent('1. ').run()}
            title="1단계 항목 (1.)"
          >
            <span className="w-5 text-indigo-600 font-extrabold">1.</span>
            <span className="text-[11px] font-medium text-slate-500">1단계</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 justify-start text-xs font-bold text-slate-800 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border-slate-200 shadow-none transition-colors"
            onClick={() => editor.chain().focus().insertContent('\u00A0\u00A0가. ').run()}
            title="2단계 항목 (가. / 2칸 들여쓰기)"
          >
            <span className="w-5 text-indigo-600 font-extrabold">가.</span>
            <span className="text-[11px] font-medium text-slate-500">2단계</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 justify-start text-xs font-bold text-slate-800 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border-slate-200 shadow-none transition-colors"
            onClick={() => editor.chain().focus().insertContent('\u00A0\u00A0\u00A0\u00A01) ').run()}
            title="3단계 항목 (1) / 4칸 들여쓰기)"
          >
            <span className="w-5 text-indigo-600 font-extrabold">1)</span>
            <span className="text-[11px] font-medium text-slate-500">3단계</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 justify-start text-xs font-bold text-slate-800 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border-slate-200 shadow-none transition-colors"
            onClick={() => editor.chain().focus().insertContent('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0가) ').run()}
            title="4단계 항목 (가) / 6칸 들여쓰기)"
          >
            <span className="w-5 text-indigo-600 font-extrabold">가)</span>
            <span className="text-[11px] font-medium text-slate-500">4단계</span>
          </Button>

          <div className="my-1 border-t border-slate-200" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 justify-start text-xs font-bold text-slate-800 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border-slate-200 shadow-none transition-colors"
            onClick={() => editor.chain().focus().insertContent('<p style="margin-top: 18px;">붙임\u00A0\u00A01.\u00A0\u00A0계획서 1부.\u00A0\u00A0끝.</p>').run()}
            title="붙임 표준 양식 삽입"
          >
            <span className="text-emerald-600 mr-1 text-xs">📎</span>
            <span className="text-[11px] font-bold text-slate-700">붙임 서식</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 px-2 justify-start text-xs font-bold text-slate-800 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 border-slate-200 shadow-none transition-colors"
            onClick={() => editor.chain().focus().insertContent('\u00A0\u00A0끝.').run()}
            title="끝. 삽입 (2칸 띄우고 끝.)"
          >
            <span className="text-amber-600 mr-1.5 font-bold">🏁</span>
            <span className="text-[11px] font-bold text-slate-700">끝.</span>
          </Button>
        </div>

        {/* 에디터 본문 */}
        <div className="flex-1 overflow-x-auto">
          <EditorContent editor={editor} className="min-h-[420px]" />
        </div>
      </div>
    </div>
  );
}