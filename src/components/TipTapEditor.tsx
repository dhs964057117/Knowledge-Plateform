import React, { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, ImageIcon, Link as LinkIcon, Undo, Redo,
  Table as TableIcon, Minus, Sparkles, Upload
} from 'lucide-react'
import { api } from '../api'

interface TipTapEditorProps {
  initialContent?: string
  onChange: (html: string, json: any) => void
  placeholder?: string
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = '',
  onChange,
  placeholder = '从这里开始撰写正文，支持图文排版、任务清单、代码块等...'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-feishu-600 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'feishu-prose min-h-[500px] px-8 py-6 focus:outline-none bg-white rounded-b-xl',
      },
    },
  })

  if (!editor) {
    return <div className="p-8 text-center text-gray-400">正在加载飞书文档编辑器...</div>
  }

  const handleInsertImage = () => {
    const url = window.prompt('请输入图片网络地址 (URL):')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await api.uploadImage(file)
      if (res.url) {
        editor.chain().focus().setImage({ src: res.url }).run()
      }
    } catch (err: any) {
      alert('上传图片失败: ' + err.message)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSetLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('请输入跳转链接 (URL):', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const handleInsertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className="border border-[#dee0e3] rounded-xl overflow-hidden shadow-sm bg-white transition-all">
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Feishu-style Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#f9f9fa] border-b border-[#dee0e3] text-gray-700">
        
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
            title="重做 (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded text-xs font-bold transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="一级标题 (H1)"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded text-xs font-bold transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="二级标题 (H2)"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded text-xs font-bold transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="三级标题 (H3)"
          >
            <Heading3 className="w-4 h-4" />
          </button>
        </div>

        {/* Text Formats */}
        <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bold') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="加粗"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('italic') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="斜体"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('underline') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="下划线"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('strike') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="删除线"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('highlight') ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-200'
            }`}
            title="文本高亮标色"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('code') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="行内代码"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>

        {/* Lists & Quotes */}
        <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bulletList') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="无序列表"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('orderedList') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="有序列表"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('taskList') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="待办任务清单"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('blockquote') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="飞书引用提示块"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Inserts: Table, Link, Images */}
        <div className="flex items-center gap-0.5 pl-2">
          <button
            type="button"
            onClick={handleInsertTable}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="插入表格"
          >
            <TableIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSetLink}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('link') ? 'bg-feishu-100 text-feishu-600' : 'hover:bg-gray-200'
            }`}
            title="插入/修改超链接"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleInsertImage}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="插入网络图片地址"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded text-feishu-600 hover:bg-feishu-50 transition-colors"
            title="上传本地图片插入"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>上传图片</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="分割线"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  )
}
