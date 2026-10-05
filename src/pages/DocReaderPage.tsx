import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Clock, Eye, Sparkles, Check, Lock, ShieldCheck, Printer } from 'lucide-react'
import { api, getVipToken } from '../api'
import { Doc, SiteSettings } from '../types'
import { DocumentTOC } from '../components/DocumentTOC'
import { PaywallModal } from '../components/PaywallModal'

interface DocReaderPageProps {
  settings?: SiteSettings | null
}

export const DocReaderPage: React.FC<DocReaderPageProps> = ({ settings }) => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const keyParam = searchParams.get('key')
  const navigate = useNavigate()

  const [doc, setDoc] = useState<Doc | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  const loadDocument = async () => {
    if (!id) return
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await api.getDoc(id, keyParam)
      setDoc(data)
    } catch (err: any) {
      setErrorMsg(err.message || '加载文档失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocument()
  }, [id, keyParam])

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa]">
        <div className="w-9 h-9 border-3 border-feishu-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">正在进入知识专栏...</p>
      </div>
    )
  }

  if (errorMsg && !doc) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-2xl border border-gray-200 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">访问遇到问题</h2>
        <p className="text-sm text-gray-600 mb-6">{errorMsg}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-feishu-600 text-white rounded-xl text-sm font-medium hover:bg-feishu-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回知识库首页
        </Link>
      </div>
    )
  }

  // If VIP Paywall required (isAuthorized === false)
  if (doc && doc.isAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] py-8 px-4">
        <div className="max-w-4xl mx-auto mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#646a73] hover:text-[#1f2329] bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回专栏目录
          </Link>
        </div>

        <PaywallModal
          docId={doc.id}
          docTitle={doc.title}
          docExcerpt={doc.excerpt}
          coverImage={doc.cover_image}
          settings={settings}
          onSuccess={() => {
            loadDocument()
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      
      {/* Top Reading Navigation Bar */}
      <div className="bg-white border-b border-[#dee0e3] sticky top-16 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#646a73] hover:text-[#1f2329] bg-[#f5f6f7] hover:bg-[#ebedef] px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回目录
          </Link>

          <div className="flex items-center gap-2">
            {doc?.userLabel && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>授权学员: {doc.userLabel}</span>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block"
              title="打印 / 导出 PDF"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-feishu-50 text-feishu-600 hover:bg-feishu-100 rounded-lg transition-colors border border-feishu-200"
            >
              {shareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>已复制链接</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>分享文档</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Reader Layout Canvas */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex justify-center gap-10">
        
        {/* Main Document Paper Container (Feishu Style) */}
        <article
          id="feishu-doc-article"
          className="w-full max-w-3xl bg-white rounded-2xl border border-[#dee0e3] shadow-card px-8 sm:px-14 py-12 transition-all"
        >
          {/* Cover image if available */}
          {doc?.cover_image && (
            <div className="mb-8 rounded-xl overflow-hidden shadow-sm max-h-[380px]">
              <img
                src={doc.cover_image}
                alt={doc.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Doc Header */}
          <header className="mb-8 pb-6 border-b border-[#f0f2f5]">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#1f2329] tracking-tight leading-tight">
              {doc?.title}
            </h1>

            {/* Meta info */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#8f959e]">
              <span className="flex items-center gap-1.5 font-medium text-[#646a73]">
                <span>主理人：{settings?.author_name || '专栏主理人'}</span>
              </span>

              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                更新于 {new Date(doc?.updated_at || doc?.created_at || '').toLocaleDateString('zh-CN')}
              </span>

              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {doc?.views_count || 0} 次阅读
              </span>

              {doc?.is_vip_only === 1 && (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  VIP 专属内容
                </span>
              )}
            </div>
          </header>

          {/* Render Rich Text Content */}
          <div
            className="feishu-prose"
            dangerouslySetInnerHTML={{ __html: doc?.content_html || '<p>文档内容为空</p>' }}
          />

          {/* Bottom Copyright Notice */}
          <footer className="mt-16 pt-8 border-t border-dashed border-[#dee0e3] text-center text-xs text-[#8f959e]">
            <p>© {new Date().getFullYear()} {settings?.site_name} · 专享知识资产，请勿外传</p>
          </footer>
        </article>

        {/* Right TOC / Outline (Feishu Outline) */}
        <DocumentTOC contentHtml={doc?.content_html} />

      </div>

    </div>
  )
}
