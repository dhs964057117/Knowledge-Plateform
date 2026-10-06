import React, { useRef, useEffect, useState } from 'react'
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
  Table as TableIcon, Minus, Sparkles, Upload, Loader2,
  RefreshCw, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { api } from '../api'

interface TipTapEditorProps {
  initialContent?: string
  onChange: (html: string, json: any) => void
  placeholder?: string
}

/**
 * Compresses and converts an image File into a self-contained Base64 Data URL.
 * Resizes max width to 1600px to ensure crisp display while avoiding 10MB payloads.
 */
async function processAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string
      if (!rawDataUrl) {
        resolve('')
        return
      }

      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        const MAX_WIDTH = 1600
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width)
          width = MAX_WIDTH
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(rawDataUrl)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const isPng = file.type === 'image/png'
        const compressedDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.88)
        resolve(compressedDataUrl)
      }
      img.onerror = () => resolve(rawDataUrl)
      img.src = rawDataUrl
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Converts a blob: URL to a permanent base64 data URL
 */
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  try {
    const res = await fetch(blobUrl)
    const blob = await res.blob()
    return await processAndCompressImage(new File([blob], 'image.png', { type: blob.type }))
  } catch {
    return blobUrl
  }
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent = '',
  onChange,
  placeholder = '从这里开始撰写正文，支持截图粘贴 (Ctrl+V)、复制飞书文档、拖拽图片、图文排版...'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [processStatusText, setProcessStatusText] = useState('')
  const [externalImageCount, setExternalImageCount] = useState(0)

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
      checkExternalImages(editor)
    },
    editorProps: {
      attributes: {
        class: 'feishu-prose min-h-[500px] px-8 py-6 focus:outline-none bg-white rounded-b-xl',
      },
      // 1. Handle pasting images from clipboard (Screenshots, Copied files)
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) {
                event.preventDefault()
                setIsProcessingImage(true)
                setProcessStatusText('正在处理粘贴的截图/图片...')
                processAndCompressImage(file)
                  .then((dataUrl) => {
                    if (dataUrl && view.state) {
                      const { schema } = view.state
                      const node = schema.nodes.image.create({ src: dataUrl })
                      const transaction = view.state.tr.replaceSelectionWith(node)
                      view.dispatch(transaction)
                    }
                  })
                  .catch((err) => console.error('Pasted image failed:', err))
                  .finally(() => {
                    setIsProcessingImage(false)
                    setProcessStatusText('')
                  })
                return true
              }
            }
          }
        }

        // 2. Check if pasted HTML contains external images (e.g. from Feishu Docs, Notion, etc.)
        const html = event.clipboardData?.getData('text/html')
        if (html && (html.includes('<img') || html.includes('feishu.cn') || html.includes('blob:'))) {
          // Let default paste happen so the document structure is inserted
          setTimeout(() => {
            convertAllExternalImages()
          }, 150)
        }

        return false
      },

      // 3. Handle dragging and dropping images into editor
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const files = Array.from(event.dataTransfer.files)
          const imageFiles = files.filter((f) => f.type.startsWith('image/'))
          if (imageFiles.length > 0) {
            event.preventDefault()
            setIsProcessingImage(true)
            setProcessStatusText('正在处理拖拽的图片...')
            Promise.all(imageFiles.map((f) => processAndCompressImage(f)))
              .then((dataUrls) => {
                dataUrls.forEach((dataUrl) => {
                  if (dataUrl && view.state) {
                    const { schema } = view.state
                    const node = schema.nodes.image.create({ src: dataUrl })
                    const transaction = view.state.tr.replaceSelectionWith(node)
                    view.dispatch(transaction)
                  }
                })
              })
              .catch((err) => console.error('Dropped image failed:', err))
              .finally(() => {
                setIsProcessingImage(false)
                setProcessStatusText('')
              })
            return true
          }
        }
        return false
      },
    },
  })

  // Check how many external (non-data: Base64) images exist in document
  const checkExternalImages = (ed: any) => {
    if (!ed || ed.isDestroyed) return
    let count = 0
    ed.state.doc.descendants((node: any) => {
      if (node.type.name === 'image') {
        const src = node.attrs.src
        if (src && !src.startsWith('data:') && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:'))) {
          count++
        }
      }
    })
    setExternalImageCount(count)
  }

  // Convert all external images (especially Feishu temporary tokens) into permanent local Base64
  const convertAllExternalImages = async () => {
    if (!editor || editor.isDestroyed) return
    const imagesToConvert: { src: string }[] = []

    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        const src = node.attrs.src
        if (src && !src.startsWith('data:') && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:'))) {
          if (!imagesToConvert.some(item => item.src === src)) {
            imagesToConvert.push({ src })
          }
        }
      }
    })

    if (imagesToConvert.length === 0) return

    setIsProcessingImage(true)
    setProcessStatusText(`检测到 ${imagesToConvert.length} 张外链/飞书图片，正在转存为永久图片...`)

    let successCount = 0
    let expiredCount = 0

    for (let i = 0; i < imagesToConvert.length; i++) {
      const item = imagesToConvert[i]
      setProcessStatusText(`正在转存第 ${i + 1}/${imagesToConvert.length} 张图片...`)
      try {
        let permanentDataUrl = ''
        if (item.src.startsWith('blob:')) {
          permanentDataUrl = await blobUrlToDataUrl(item.src)
        } else {
          const res = await api.proxyImage(item.src)
          if (res.success && res.dataUrl) {
            permanentDataUrl = res.dataUrl
          }
        }

        if (permanentDataUrl && permanentDataUrl.startsWith('data:')) {
          // Replace all occurrences of this src in the document
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs.src === item.src) {
              editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: permanentDataUrl })
                return true
              })
            }
          })
          successCount++
        } else {
          expiredCount++
        }
      } catch (err) {
        console.warn('Failed to convert image:', item.src, err)
        expiredCount++
      }
    }

    setIsProcessingImage(false)
    setProcessStatusText('')
    checkExternalImages(editor)
    onChange(editor.getHTML(), editor.getJSON())

    if (expiredCount > 0) {
      alert(`已转存 ${successCount} 张图片！\n另有 ${expiredCount} 张图片因原飞书/第三方链接已过期（失效）无法拉取，建议在飞书中重新全选复制该段内容重新粘贴，系统将立即自动捕获最新有效图片！`)
    }
  }

  // Synchronize initial content when document data loads
  useEffect(() => {
    if (editor && initialContent && !editor.isDestroyed) {
      if (editor.getHTML() !== initialContent && editor.isEmpty) {
        editor.commands.setContent(initialContent)
        checkExternalImages(editor)
      }
    }
  }, [initialContent, editor])

  if (!editor) {
    return <div className="p-8 text-center text-gray-400">正在加载飞书文档编辑器...</div>
  }

  const handleInsertImage = () => {
    const url = window.prompt('请输入图片网络地址 (URL):')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
      setTimeout(() => convertAllExternalImages(), 200)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessingImage(true)
    setProcessStatusText('正在上传并优化图片...')
    try {
      const dataUrl = await processAndCompressImage(file)
      if (dataUrl) {
        editor.chain().focus().setImage({ src: dataUrl }).run()
      }
    } catch (err: any) {
      alert('上传图片失败: ' + err.message)
    } finally {
      setIsProcessingImage(false)
      setProcessStatusText('')
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
    <div className="border border-[#dee0e3] rounded-xl overflow-hidden shadow-sm bg-white transition-all relative">
      
      {/* Processing Status Banner */}
      {isProcessingImage && (
        <div className="bg-feishu-50 border-b border-feishu-200 px-4 py-2 flex items-center justify-between text-xs text-feishu-700 animate-pulse">
          <div className="flex items-center gap-2 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-feishu-600" />
            <span>{processStatusText || '正在处理图片...'}</span>
          </div>
          <span className="text-[11px] text-feishu-500">处理后将自动保存为永久本地数据</span>
        </div>
      )}

      {/* External Images Warning Banner */}
      {externalImageCount > 0 && !isProcessingImage && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              检测到当前文档包含 <strong>{externalImageCount} 张飞书/外链临时图片</strong>（飞书图片1小时后会失效）
            </span>
          </div>
          <button
            type="button"
            onClick={convertAllExternalImages}
            className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>一键转存为永久图片</span>
          </button>
        </div>
      )}

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

          {/* Convert External Images Button */}
          {externalImageCount > 0 && (
            <button
              type="button"
              onClick={convertAllExternalImages}
              disabled={isProcessingImage}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
              title="一键转存飞书/外链临时图片为永久本地图片"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessingImage ? 'animate-spin' : ''}`} />
              <span>转存图片 ({externalImageCount})</span>
            </button>
          )}

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
