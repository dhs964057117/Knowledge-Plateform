import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Eye, Lock, Globe, Sparkles, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react'
import { api, getAdminToken } from '../../api'
import { Doc } from '../../types'
import { TipTapEditor } from '../../components/TipTapEditor'

export const DocEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [contentHtml, setContentHtml] = useState('<p></p>')
  const [contentJson, setContentJson] = useState<any>(null)
  const [isPublished, setIsPublished] = useState(1)
  const [isVipOnly, setIsVipOnly] = useState(1)
  const [orderIndex, setOrderIndex] = useState(0)

  useEffect(() => {
    if (!getAdminToken()) {
      navigate('/admin/login')
      return
    }

    if (isEditing) {
      loadDoc()
    }
  }, [id])

  const loadDoc = async () => {
    try {
      const data = await api.getDoc(id!)
      setTitle(data.title)
      setSlug(data.slug || data.id)
      setExcerpt(data.excerpt || '')
      setCoverImage(data.cover_image || '')
      setContentHtml(data.content_html || '<p></p>')
      setIsPublished(data.is_published)
      setIsVipOnly(data.is_vip_only)
      setOrderIndex(data.order_index || 0)
    } catch (err: any) {
      alert('加载文档失败: ' + err.message)
      navigate('/admin')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setMessage({ text: '请填写文档标题', type: 'error' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const payload: Partial<Doc> = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim(),
        cover_image: coverImage.trim(),
        content_html: contentHtml,
        content_json: contentJson ? JSON.stringify(contentJson) : '',
        is_published: isPublished,
        is_vip_only: isVipOnly,
        order_index: Number(orderIndex),
      }

      if (isEditing) {
        await api.updateDoc(id!, payload)
        setMessage({ text: '文档保存成功！', type: 'success' })
      } else {
        const res = await api.createDoc(payload)
        setMessage({ text: '文档创建成功！正在跳转...', type: 'success' })
        setTimeout(() => {
          navigate(`/admin/edit/${res.id}`)
        }, 1000)
      }
    } catch (err: any) {
      setMessage({ text: '保存失败: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="w-8 h-8 border-3 border-feishu-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      
      {/* Top Floating Action Bar */}
      <header className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-[#dee0e3] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="返回工作台"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="text-sm font-semibold text-[#1f2329]">
              {isEditing ? '编辑知识文档' : '撰写新文档'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isEditing && (
              <Link
                to={`/doc/${slug || id}`}
                target="_blank"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>预览</span>
              </Link>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-feishu-600 hover:bg-feishu-700 disabled:bg-feishu-300 text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? '正在保存...' : '保存文档'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Alerts */}
        {message && (
          <div className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Document Meta Configuration Panel */}
        <section className="bg-white rounded-2xl border border-[#dee0e3] p-6 shadow-xs space-y-4">
          
          {/* Document Title (Feishu Style Hero Input) */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入文档大标题 (如：2026从零掌握AI智能体开发指南)..."
              className="w-full text-2xl sm:text-3xl font-bold text-[#1f2329] placeholder-gray-300 border-b border-transparent hover:border-gray-200 focus:border-feishu-500 focus:outline-none py-2 transition-colors"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-semibold text-[#8f959e] mb-1">
              文档摘要 / 简介 (用于首页卡片与付费拦截页前瞻展示)
            </label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="概括本文的核心价值与亮点，吸引付费学员解锁..."
              className="w-full px-3 py-2 bg-[#f9f9fa] border border-[#dee0e3] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-feishu-500 focus:bg-white"
            />
          </div>

          {/* Cover & Slug & Permissions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#8f959e] mb-1">
                封面图片网络 URL (可选)
              </label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://images... 封面图"
                className="w-full px-3 py-1.5 bg-[#f9f9fa] border border-[#dee0e3] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-feishu-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8f959e] mb-1">
                访问别名 Slug (用于个性化网址)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="如: ai-course-01"
                className="w-full px-3 py-1.5 bg-[#f9f9fa] border border-[#dee0e3] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-feishu-500 focus:bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8f959e] mb-1">
                付费鉴权类型
              </label>
              <select
                value={isVipOnly}
                onChange={(e) => setIsVipOnly(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#f9f9fa] border border-[#dee0e3] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-feishu-500 focus:bg-white font-medium text-amber-800"
              >
                <option value={1}>🔒 VIP专属 (需学员密码解锁)</option>
                <option value={0}>🌐 免费开放 (所有访客可看)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8f959e] mb-1">
                发布状态
              </label>
              <select
                value={isPublished}
                onChange={(e) => setIsPublished(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#f9f9fa] border border-[#dee0e3] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-feishu-500 focus:bg-white font-medium text-feishu-800"
              >
                <option value={1}>✅ 立即公开发布</option>
                <option value={0}>📝 保存为草稿 (暂不上线)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Feishu TipTap Rich Text Editor */}
        <section>
          <div className="mb-2 flex items-center justify-between text-xs text-[#8f959e]">
            <span className="font-semibold uppercase tracking-wider">正文图文内容编辑</span>
            <span>支持富文本、代码块、引用高亮、任务清单与本地图片</span>
          </div>

          <TipTapEditor
            initialContent={contentHtml}
            onChange={(html, json) => {
              setContentHtml(html)
              setContentJson(json)
            }}
          />
        </section>

      </main>

    </div>
  )
}
