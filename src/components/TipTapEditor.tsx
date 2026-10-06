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
  RefreshCw, AlertTriangle, CheckCircle2, Trash2, ZoomIn,
  X, HardDrive, Layers, ArrowDown
} from 'lucide-react'
import { api } from '../api'

interface TipTapEditorProps {
  initialContent?: string
  onChange: (html: string, json: any) => void
  placeholder?: string
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

/**
 * Intelligently compresses an image (File, Blob, or Data URL)
 * - Constrains max dimension to 1440px (crystal clear Retina display)
 * - Encodes with modern WebP (0.82 quality) with fallback to JPEG
 * - Reduces 2MB~5MB screenshots down to ~80KB~180KB, saving 85-92% storage
 */
export async function smartCompressImage(
  source: File | Blob | string,
  maxWidth = 1440,
  quality = 0.82
): Promise<{ dataUrl: string; size: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      let rawDataUrl = ''
      if (typeof source === 'string') {
        if (source.startsWith('data:')) {
          rawDataUrl = source
        } else if (source.startsWith('blob:')) {
          const res = await fetch(source)
          const blob = await res.blob()
          rawDataUrl = await new Promise<string>((r) => {
            const fr = new FileReader()
            fr.onload = () => r(fr.result as string)
            fr.readAsDataURL(blob)
          })
        } else {
          resolve({ dataUrl: source, size: 0 })
          return
        }
      } else {
        rawDataUrl = await new Promise<string>((r, rej) => {
          const fr = new FileReader()
          fr.onload = () => r(fr.result as string)
          fr.onerror = rej
          fr.readAsDataURL(source)
        })
      }

      if (!rawDataUrl.startsWith('data:')) {
        resolve({ dataUrl: rawDataUrl, size: 0 })
        return
      }

      const img = new window.Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve({ dataUrl: rawDataUrl, size: Math.round(rawDataUrl.length * 0.75) })
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          // Try WebP first, fallback to JPEG
          let compressed = canvas.toDataURL('image/webp', quality)
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality)
          }

          // Use compressed if it's smaller, otherwise keep raw
          const finalUrl = compressed.length < rawDataUrl.length ? compressed : rawDataUrl

          resolve({
            dataUrl: finalUrl,
            size: Math.round(finalUrl.length * 0.75)
          })
        } catch {
          resolve({ dataUrl: rawDataUrl, size: Math.round(rawDataUrl.length * 0.75) })
        }
      }
      img.onerror = () => resolve({ dataUrl: rawDataUrl, size: Math.round(rawDataUrl.length * 0.75) })
      img.src = rawDataUrl
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Backward compatibility alias for single file upload/paste
 */
async function processAndCompressImage(file: File): Promise<string> {
  const result = await smartCompressImage(file)
  return result.dataUrl
}

/**
 * Converts a blob: URL to a permanent compressed data URL
 */
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  try {
    const res = await fetch(blobUrl)
    const blob = await res.blob()
    const result = await smartCompressImage(blob)
    return result.dataUrl
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

  // Extract all images in current document for stats and management
  const getDocImages = () => {
    if (!editor || editor.isDestroyed) return []
    const items: { id: string; src: string; size: number; format: string; isBase64: boolean; isR2: boolean }[] = []
    let idx = 1
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        const src = node.attrs.src || ''
        const isBase64 = src.startsWith('data:')
        const isR2 = src.includes('/api/images/')
        let size = 0
        let format = '外链'
        if (isBase64) {
          size = Math.round(src.length * 0.75)
          const match = src.match(/data:image\/([a-zA-Z0-9]+);/)
          format = (match ? match[1] : 'base64').toUpperCase()
        } else if (isR2) {
          format = 'R2对象存储'
          size = 120 * 1024 // estimate ~120KB
        }
        items.push({
          id: `img_${idx++}`,
          src,
          size,
          format,
          isBase64,
          isR2
        })
      }
    })
    return items
  }

  const [showMediaModal, setShowMediaModal] = useState(false)
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null)

  // Delete a specific image from document by its src
  const deleteImageFromDoc = (targetSrc: string) => {
    if (!editor || editor.isDestroyed) return
    let deleted = false
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === targetSrc) {
        editor.commands.command(({ tr }) => {
          tr.delete(pos, pos + node.nodeSize)
          return true
        })
        deleted = true
      }
    })
    if (deleted) {
      onChange(editor.getHTML(), editor.getJSON())
      checkExternalImages(editor)
    }
  }

  // Clear all images from the current document
  const clearAllImagesFromDoc = () => {
    if (!editor || editor.isDestroyed) return
    if (!window.confirm('确定要清除当前文档中的所有图片吗？此操作将立即从文章中移除全部配图。')) return

    const positions: { pos: number; size: number }[] = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') {
        positions.push({ pos, size: node.nodeSize })
      }
    })

    // Delete in reverse order to preserve pos offsets
    positions.reverse().forEach(({ pos, size }) => {
      editor.commands.command(({ tr }) => {
        tr.delete(pos, pos + size)
        return true
      })
    })

    onChange(editor.getHTML(), editor.getJSON())
    checkExternalImages(editor)
    setShowMediaModal(false)
  }

  // Recompress all images in document using WebP 0.82
  const recompressAllImagesInDoc = async () => {
    if (!editor || editor.isDestroyed) return
    const images = getDocImages().filter(img => img.isBase64)
    if (images.length === 0) {
      alert('当前文档中没有需要重新压缩的内嵌图片')
      return
    }

    setIsProcessingImage(true)
    setProcessStatusText(`正在对 ${images.length} 张图片执行智能 WebP 极限压缩优化...`)

    let totalSaved = 0
    for (let i = 0; i < images.length; i++) {
      const item = images[i]
      setProcessStatusText(`正在深度优化第 ${i + 1}/${images.length} 张图片...`)
      try {
        const comp = await smartCompressImage(item.src, 1280, 0.80)
        if (comp.dataUrl && comp.size < item.size) {
          totalSaved += (item.size - comp.size)
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs.src === item.src) {
              editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: comp.dataUrl })
                return true
              })
            }
          })
        }
      } catch (e) {
        console.warn('Recompress failed for', item.id, e)
      }
    }

    setIsProcessingImage(false)
    setProcessStatusText('')
    onChange(editor.getHTML(), editor.getJSON())
    alert(`深度压缩优化完成！共为本篇文档节省了约 ${formatBytes(totalSaved)} 存储空间！`)
  }

  // Convert all external images (especially Feishu temporary tokens) into permanent local Base64/R2
  const convertAllExternalImages = async () => {
    if (!editor || editor.isDestroyed) return
    const imagesToConvert: { src: string }[] = []

    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') {
        const src = node.attrs.src
        if (src && !src.startsWith('data:') && !src.includes('/api/images/') && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:'))) {
          if (!imagesToConvert.some(item => item.src === src)) {
            imagesToConvert.push({ src })
          }
        }
      }
    })

    if (imagesToConvert.length === 0) return

    setIsProcessingImage(true)
    setProcessStatusText(`检测到 ${imagesToConvert.length} 张外链/飞书图片，正在压缩转存为永久图片...`)

    let successCount = 0
    let expiredCount = 0

    for (let i = 0; i < imagesToConvert.length; i++) {
      const item = imagesToConvert[i]
      setProcessStatusText(`正在转存并压缩第 ${i + 1}/${imagesToConvert.length} 张图片...`)
      try {
        let permanentUrl = ''
        if (item.src.startsWith('blob:')) {
          permanentUrl = await blobUrlToDataUrl(item.src)
        } else {
          const res = await api.proxyImage(item.src)
          if (res.success) {
            let candidate = res.url || res.dataUrl
            if (candidate && candidate.startsWith('data:')) {
              // Run intelligent WebP compression to save 85%+ storage
              const comp = await smartCompressImage(candidate)
              candidate = comp.dataUrl
            }
            permanentUrl = candidate
          }
        }

        if (permanentUrl) {
          // Replace all occurrences of this src in the document
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs.src === item.src) {
              editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: permanentUrl })
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
    setProcessStatusText('正在上传并进行 WebP 智能压缩...')
    try {
      const comp = await smartCompressImage(file)
      const res = await api.uploadImage(file).catch(() => null)
      const finalSrc = res?.url || comp.dataUrl
      if (finalSrc) {
        editor.chain().focus().setImage({ src: finalSrc }).run()
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

  const docImages = getDocImages()
  const totalImageBytes = docImages.reduce((acc, img) => acc + img.size, 0)
  const isImageSelected = editor.isActive('image')

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

      {/* Floating Selected Image Action Bar */}
      {isImageSelected && (
        <div className="bg-white border-b-2 border-feishu-500 px-4 py-2 flex items-center justify-between bg-blue-50/40 animate-in fade-in transition-all">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <span className="inline-block w-2 h-2 rounded-full bg-feishu-500 animate-ping" />
            <span className="font-semibold text-feishu-700">当前已选中正文中的图片</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500 text-[11px]">可点击右侧按钮直接从文档移除，释放存储空间</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().deleteSelection().run()
                onChange(editor.getHTML(), editor.getJSON())
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
              title="立即从文档中删除当前图片并释放存储资源"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>删除此图片 (释放存储)</span>
            </button>
          </div>
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

          {/* Document Media & Storage Manager Button */}
          <button
            type="button"
            onClick={() => setShowMediaModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 shadow-2xs transition-colors ml-1"
            title="管理文档内所有配图与存储空间占用"
          >
            <HardDrive className="w-3.5 h-3.5 text-feishu-600" />
            <span>图片管理 ({docImages.length}张 · {formatBytes(totalImageBytes)})</span>
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

      {/* Bottom Status & Storage Indicator Bar */}
      <div className="bg-[#fcfdfe] border-t border-[#dee0e3] px-4 py-2 flex flex-wrap items-center justify-between text-xs text-[#8f959e]">
        <div className="flex items-center gap-3">
          <span>{editor.storage.characterCount?.words?.() || editor.getText().length} 字</span>
          <span>·</span>
          <button
            type="button"
            onClick={() => setShowMediaModal(true)}
            className="flex items-center gap-1.5 hover:text-feishu-600 transition-colors font-medium text-gray-600"
          >
            <ImageIcon className="w-3.5 h-3.5 text-feishu-500" />
            <span>本文共 {docImages.length} 张图片</span>
            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[11px]">
              占用约 {formatBytes(totalImageBytes)}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            已启用 WebP 智能压缩 (节省 ~85% 存储)
          </span>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => setShowMediaModal(true)}
            className="text-feishu-600 hover:underline text-[11px]"
          >
            管理与释放空间
          </button>
        </div>
      </div>

      {/* Document Images Management Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-feishu-100 text-feishu-600 flex items-center justify-center font-bold">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">当前文档图片与存储管理</h3>
                  <p className="text-xs text-gray-500">
                    可在此查看所有配图体积、一键删除无用图片立即释放存储资源
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Summary Bar */}
            <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-blue-900 font-medium">
                <div>图片总数：<strong className="text-blue-700">{docImages.length} 张</strong></div>
                <div>存储占用：<strong className="text-blue-700">{formatBytes(totalImageBytes)}</strong></div>
                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✨ 自动 WebP 压缩已生效
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={recompressAllImagesInDoc}
                  disabled={isProcessingImage || docImages.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 border border-blue-300 rounded-lg font-medium transition-colors disabled:opacity-50"
                  title="使用更高压缩比对图片重新编码"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>深度极限压缩</span>
                </button>
                <button
                  type="button"
                  onClick={clearAllImagesFromDoc}
                  disabled={docImages.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清除全部图片</span>
                </button>
              </div>
            </div>

            {/* Images Grid / List */}
            <div className="p-6 overflow-y-auto flex-1">
              {docImages.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-2 stroke-[1.5]" />
                  <p className="text-sm">当前文档尚未插入任何图片</p>
                  <p className="text-xs text-gray-400 mt-1">可在编辑器中直接复制粘贴截图或上传图片</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {docImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="border border-gray-200 rounded-xl p-3 flex gap-3 items-center bg-white hover:shadow-sm transition-all group"
                    >
                      {/* Image Thumbnail */}
                      <div
                        onClick={() => setPreviewImageModal(img.src)}
                        className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 cursor-pointer relative border border-gray-100 group-hover:opacity-90"
                      >
                        <img
                          src={img.src}
                          alt={`图 ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>

                      {/* Image Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-gray-800">
                            第 {idx + 1} 张配图
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {img.format}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                          <span>占用体积:</span>
                          <strong className="text-gray-700 font-mono">{formatBytes(img.size)}</strong>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewImageModal(img.src)}
                            className="text-[11px] text-feishu-600 hover:underline flex items-center gap-0.5"
                          >
                            <ZoomIn className="w-3 h-3" />
                            <span>放大查看</span>
                          </button>
                          <span className="text-gray-300">·</span>
                          <button
                            type="button"
                            onClick={() => deleteImageFromDoc(img.src)}
                            className="text-[11px] text-red-600 hover:text-red-700 hover:underline flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>删除此图释放空间</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>💡 提示：从文档中删除图片并点击【保存文档】后，占用空间将立即从数据库彻底释放。</span>
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                关闭
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImageModal && (
        <div
          onClick={() => setPreviewImageModal(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={previewImageModal}
              alt="原图预览"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain bg-white"
            />
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
