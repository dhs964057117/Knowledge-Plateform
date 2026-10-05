import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Lock, BookOpen, Clock, Eye, Sparkles, User, ChevronRight, ShieldCheck, ArrowRight } from 'lucide-react'
import { api, getVipToken } from '../api'
import { Doc, SiteSettings } from '../types'

interface HomePageProps {
  settings?: SiteSettings | null
}

export const HomePage: React.FC<HomePageProps> = ({ settings }) => {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isVip, setIsVip] = useState(false)

  useEffect(() => {
    setIsVip(!!getVipToken())
    loadDocs()
  }, [])

  const loadDocs = async () => {
    try {
      const data = await api.getDocs()
      setDocs(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.excerpt && d.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="min-h-screen pb-20">
      
      {/* Hero Header */}
      <section className="bg-gradient-to-b from-white via-white to-[#f5f6f7] border-b border-[#dee0e3] pt-12 pb-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-feishu-50 border border-feishu-200 rounded-full text-xs font-medium text-feishu-600 mb-5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-feishu-500" />
            <span>飞书风格知识付费 · 一人一密专属专栏</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1f2329] tracking-tight leading-tight">
            {settings?.site_name || '智汇知识专栏'}
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[#646a73] max-w-2xl mx-auto leading-relaxed">
            {settings?.site_description || '汇聚高价值深度实战、认知手册与独家图文，支持专属访问密码解锁'}
          </p>

          {/* Author Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#8f959e]">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-xs">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span>主理人：<strong className="text-[#1f2329] font-medium">{settings?.author_name || '专栏作者'}</strong></span>
            </div>
            {settings?.contact_wechat && (
              <div className="hidden sm:flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-xs">
                <span>咨询微信：</span>
                <span className="text-feishu-600 font-mono font-medium">{settings.contact_wechat}</span>
              </div>
            )}
          </div>

          {/* Search Box */}
          <div className="mt-8 max-w-lg mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文档标题或核心关键词..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#dee0e3] rounded-xl text-sm text-[#1f2329] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-feishu-500 shadow-sm transition-all"
            />
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-10">
        
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#dee0e3]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-feishu-600" />
            <h2 className="text-lg font-bold text-[#1f2329]">精选知识文档目录</h2>
            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              共 {filteredDocs.length} 篇
            </span>
          </div>

          {isVip && (
            <div className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>已激活 VIP 专享身份</span>
            </div>
          )}
        </div>

        {/* Document Cards Grid / List */}
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center">
            <div className="w-8 h-8 border-3 border-feishu-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">正在加载文档列表...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-[#dee0e3] p-8">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-700">未找到相关文档</p>
            <p className="text-xs text-gray-400 mt-1">请尝试其他关键词搜索或稍后再来查看</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredDocs.map((doc) => (
              <Link
                key={doc.id}
                to={`/doc/${doc.slug || doc.id}`}
                className="group bg-white rounded-2xl border border-[#dee0e3] hover:border-feishu-400 hover:shadow-card transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Cover image if present */}
                  {doc.cover_image && (
                    <div className="h-40 w-full overflow-hidden bg-gray-100 relative">
                      <img
                        src={doc.cover_image}
                        alt={doc.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {doc.is_vip_only === 1 && (
                        <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md text-amber-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium shadow-sm">
                          <Lock className="w-3 h-3" />
                          <span>VIP 专属</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-5 sm:p-6">
                    {/* VIP badge if no cover */}
                    {!doc.cover_image && doc.is_vip_only === 1 && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mb-2.5">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>VIP 专属密码解锁</span>
                      </div>
                    )}

                    <h3 className="text-lg font-bold text-[#1f2329] group-hover:text-feishu-600 transition-colors line-clamp-2">
                      {doc.title}
                    </h3>

                    {doc.excerpt && (
                      <p className="mt-2 text-sm text-[#646a73] line-clamp-3 leading-relaxed">
                        {doc.excerpt}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer info */}
                <div className="px-5 sm:px-6 pb-4 pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-[#8f959e]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(doc.updated_at || doc.created_at).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {doc.views_count || 0} 阅读
                    </span>
                  </div>

                  <span className="text-feishu-600 font-medium flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    <span>阅读文档</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>

    </div>
  )
}
