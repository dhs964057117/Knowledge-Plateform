import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText, Key, Settings as SettingsIcon, Plus, Search, Edit3,
  Trash2, Copy, Check, ExternalLink, ShieldCheck, Eye, Lock,
  RefreshCw, Power, Sparkles, AlertCircle, Save, CheckCircle2,
  Calendar, UserCheck, Share2, HelpCircle
} from 'lucide-react'
import { api, getAdminToken } from '../../api'
import { Doc, AccessCode, SiteSettings, DashboardStats } from '../../types'

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'docs' | 'passcodes' | 'settings' | 'stats'>('docs')

  // Data states
  const [docs, setDocs] = useState<Doc[]>([])
  const [passcodes, setPasscodes] = useState<AccessCode[]>([])
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: '',
    site_description: '',
    author_name: '',
    pay_notice: '',
    contact_wechat: '',
    contact_qr_url: '',
    admin_password: '',
  })
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals & form states
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [editingCode, setEditingCode] = useState<AccessCode | null>(null)
  const [codeForm, setCodeForm] = useState({
    code: '',
    label: '',
    doc_id: '',
    is_active: 1,
    max_uses: -1,
    expires_at: '',
  })

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [docSearch, setDocSearch] = useState('')
  const [codeSearch, setCodeSearch] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  // Check auth
  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      navigate('/admin/login')
      return
    }
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [docsData, codesData, settingsData, statsData] = await Promise.all([
        api.getDocs(),
        api.getPasscodes(),
        api.getSettings(),
        api.getStats().catch(() => null),
      ])
      setDocs(docsData)
      setPasscodes(codesData)
      setSettings(settingsData)
      setStats(statsData)
    } catch (err: any) {
      console.error('Failed to load admin data:', err)
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        api.logoutAdmin()
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Delete Doc
  const handleDeleteDoc = async (id: string, title: string) => {
    if (!window.confirm(`确定要删除文档「${title}」吗？此操作无法撤销。`)) return
    try {
      await api.deleteDoc(id)
      setDocs(docs.filter(d => d.id !== id))
    } catch (err: any) {
      alert('删除失败: ' + err.message)
    }
  }

  // Toggle publish state
  const handleTogglePublish = async (doc: Doc) => {
    const newStatus = doc.is_published === 1 ? 0 : 1
    try {
      await api.updateDoc(doc.id, { is_published: newStatus })
      setDocs(docs.map(d => d.id === doc.id ? { ...d, is_published: newStatus } : d))
    } catch (err: any) {
      alert('更新状态失败: ' + err.message)
    }
  }

  // Open Passcode Modal
  const openNewCodeModal = () => {
    setEditingCode(null)
    // Generate clean random code
    const rand = 'VIP-' + Math.random().toString(36).substring(2, 7).toUpperCase()
    setCodeForm({
      code: rand,
      label: '',
      doc_id: '',
      is_active: 1,
      max_uses: -1,
      expires_at: '',
    })
    setShowCodeModal(true)
  }

  const openEditCodeModal = (item: AccessCode) => {
    setEditingCode(item)
    setCodeForm({
      code: item.code,
      label: item.label || '',
      doc_id: item.doc_id || '',
      is_active: item.is_active,
      max_uses: item.max_uses,
      expires_at: item.expires_at ? item.expires_at.substring(0, 10) : '',
    })
    setShowCodeModal(true)
  }

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeForm.code.trim()) {
      alert('密码不能为空')
      return
    }

    try {
      const payload: any = {
        code: codeForm.code.trim(),
        label: codeForm.label.trim() || '学员',
        doc_id: codeForm.doc_id ? codeForm.doc_id : null,
        is_active: codeForm.is_active,
        max_uses: Number(codeForm.max_uses),
        expires_at: codeForm.expires_at ? `${codeForm.expires_at} 23:59:59` : null,
      }

      if (editingCode) {
        await api.updatePasscode(editingCode.id, payload)
      } else {
        await api.createPasscode(payload)
      }

      setShowCodeModal(false)
      const updated = await api.getPasscodes()
      setPasscodes(updated)
    } catch (err: any) {
      alert('保存失败: ' + err.message)
    }
  }

  const handleDeleteCode = async (id: string, code: string) => {
    if (!window.confirm(`确定要废弃密码「${code}」吗？`)) return
    try {
      await api.deletePasscode(id)
      setPasscodes(passcodes.filter(c => c.id !== id))
    } catch (err: any) {
      alert('删除失败: ' + err.message)
    }
  }

  const handleToggleCodeActive = async (item: AccessCode) => {
    const nextStatus = item.is_active === 1 ? 0 : 1
    try {
      await api.updatePasscode(item.id, { ...item, is_active: nextStatus })
      setPasscodes(passcodes.map(c => c.id === item.id ? { ...c, is_active: nextStatus } : c))
    } catch (err: any) {
      alert('修改状态失败: ' + err.message)
    }
  }

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveStatus('saving')
    try {
      await api.updateSettings(settings)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (err: any) {
      alert('保存设置失败: ' + err.message)
      setSaveStatus('')
    }
  }

  // Filters
  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
    (d.excerpt && d.excerpt.toLowerCase().includes(docSearch.toLowerCase()))
  )

  const filteredCodes = passcodes.filter(c =>
    c.code.toLowerCase().includes(codeSearch.toLowerCase()) ||
    (c.label && c.label.toLowerCase().includes(codeSearch.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      
      {/* Top Admin Header */}
      <div className="bg-white border-b border-[#dee0e3] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-feishu-600 text-white flex items-center justify-center font-bold shadow-xs">
              飞
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1f2329] flex items-center gap-2">
                专栏管理工作台
                <span className="text-xs font-normal text-feishu-600 bg-feishu-50 px-2 py-0.5 rounded border border-feishu-200">
                  知识付费控制台
                </span>
              </h1>
              <p className="text-xs text-[#8f959e]">飞书风格内容发布 · 一人一密卡密发放 · Cloudflare D1 边缘驱动</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-feishu-600 hover:bg-feishu-700 text-white rounded-xl text-sm font-medium shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新建知识文档</span>
            </Link>
            <button
              onClick={openNewCodeModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-emerald-700 border border-emerald-300 rounded-xl text-sm font-medium shadow-xs transition-colors"
            >
              <Key className="w-4 h-4 text-emerald-600" />
              <span>生成专属密码</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
        <div className="flex border-b border-[#dee0e3] space-x-6">
          <button
            onClick={() => setActiveTab('docs')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'docs'
                ? 'border-feishu-600 text-feishu-600'
                : 'border-transparent text-[#646a73] hover:text-[#1f2329]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>文档管理 ({docs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('passcodes')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'passcodes'
                ? 'border-feishu-600 text-feishu-600'
                : 'border-transparent text-[#646a73] hover:text-[#1f2329]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>一人一密卡密 ({passcodes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-feishu-600 text-feishu-600'
                : 'border-transparent text-[#646a73] hover:text-[#1f2329]'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>专栏与付费设置</span>
          </button>

          {stats && (
            <button
              onClick={() => setActiveTab('stats')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-feishu-600 text-feishu-600'
                  : 'border-transparent text-[#646a73] hover:text-[#1f2329]'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>数据概览</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Documents Management */}
      {activeTab === 'docs' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
          
          {/* Search bar */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="搜索文档标题..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 shadow-xs"
              />
            </div>
            <div className="text-xs text-[#8f959e]">
              共 {docs.length} 篇文档（{docs.filter(d => d.is_published).length} 篇已上线）
            </div>
          </div>

          {/* Docs Table */}
          <div className="bg-white rounded-2xl border border-[#dee0e3] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f9f9fa] border-b border-[#dee0e3] text-xs font-semibold text-[#646a73] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">文档名称</th>
                    <th className="py-3.5 px-4">访问权限</th>
                    <th className="py-3.5 px-4">状态</th>
                    <th className="py-3.5 px-4">阅读量</th>
                    <th className="py-3.5 px-4">更新时间</th>
                    <th className="py-3.5 px-6 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        暂无文档，点击右上角「新建知识文档」发布第一篇图文！
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc) => {
                      const shareUrl = `${window.location.origin}/doc/${doc.slug || doc.id}`
                      return (
                        <tr key={doc.id} className="hover:bg-[#f9fafb] transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {doc.cover_image ? (
                                <img
                                  src={doc.cover_image}
                                  alt=""
                                  className="w-12 h-9 object-cover rounded-md flex-shrink-0 border border-gray-200"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-feishu-50 text-feishu-600 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link
                                  to={`/doc/${doc.slug || doc.id}`}
                                  target="_blank"
                                  className="font-medium text-[#1f2329] hover:text-feishu-600 transition-colors line-clamp-1 flex items-center gap-1 group"
                                >
                                  <span>{doc.title}</span>
                                  <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                                <span className="text-xs text-[#8f959e] line-clamp-1">{doc.excerpt || '暂无摘要'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            {doc.is_vip_only === 1 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <Lock className="w-3 h-3" />
                                VIP 专属
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                免费开放
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <button
                              onClick={() => handleTogglePublish(doc)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                doc.is_published === 1
                                  ? 'bg-blue-50 text-feishu-600 hover:bg-blue-100'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title="点击切换上线/草稿状态"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${doc.is_published === 1 ? 'bg-feishu-600' : 'bg-gray-400'}`} />
                              <span>{doc.is_published === 1 ? '已上线' : '草稿下架'}</span>
                            </button>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap text-xs text-[#646a73]">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                              {doc.views_count || 0}
                            </span>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap text-xs text-[#8f959e]">
                            {new Date(doc.updated_at || doc.created_at).toLocaleDateString('zh-CN')}
                          </td>

                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleCopy(shareUrl, doc.id)}
                                className="p-1.5 text-gray-500 hover:text-feishu-600 hover:bg-feishu-50 rounded-lg transition-colors"
                                title="复制普通阅读分享链接"
                              >
                                {copiedId === doc.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Share2 className="w-4 h-4" />
                                )}
                              </button>

                              <Link
                                to={`/admin/edit/${doc.id}`}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="编辑正文与图文内容"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Link>

                              <button
                                onClick={() => handleDeleteDoc(doc.id, doc.title)}
                                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="删除该文档"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Passcodes Management (一人一密体系) */}
      {activeTab === 'passcodes' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6">
          
          {/* Header & tips */}
          <div className="mb-5 bg-feishu-50 border border-feishu-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-feishu-900">
                <Sparkles className="w-4 h-4 text-feishu-600" />
                <span>知识付费核心机制：一人一密专属授权体系</span>
              </div>
              <p className="mt-1 text-xs text-feishu-700 leading-relaxed max-w-2xl">
                为每一位购买知识库的付费学员分配独立密码（每个人密码不同），可绑定学员微信/姓名。
                您可以随时修改密码、暂停授权或设置到期时间；还可以一键复制<strong>带密码的直达VIP链接</strong>直接发给学员，学员点开免输入自动解锁！
              </p>
            </div>

            <button
              onClick={openNewCodeModal}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-feishu-600 hover:bg-feishu-700 text-white rounded-xl text-sm font-medium shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新建学员专属密码</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="搜索密码或学员备注..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 shadow-xs"
              />
            </div>
            <div className="text-xs text-[#8f959e]">
              共 {passcodes.length} 个授权码（{passcodes.filter(c => c.is_active).length} 个正常启用中）
            </div>
          </div>

          {/* Passcodes Table */}
          <div className="bg-white rounded-2xl border border-[#dee0e3] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f9f9fa] border-b border-[#dee0e3] text-xs font-semibold text-[#646a73] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">专属密码 (卡密)</th>
                    <th className="py-3.5 px-4">学员姓名 / 备注</th>
                    <th className="py-3.5 px-4">授权范围</th>
                    <th className="py-3.5 px-4">状态</th>
                    <th className="py-3.5 px-4">使用次数</th>
                    <th className="py-3.5 px-4">到期时间</th>
                    <th className="py-3.5 px-6 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {filteredCodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        暂无卡密记录，点击上方按钮为学员生成专属访问密码！
                      </td>
                    </tr>
                  ) : (
                    filteredCodes.map((item) => {
                      const isExpired = item.expires_at && new Date(item.expires_at).getTime() < Date.now()
                      return (
                        <tr key={item.id} className="hover:bg-[#f9fafb] transition-colors">
                          <td className="py-4 px-6 font-mono font-semibold text-[#1f2329]">
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-100 px-2 py-1 rounded text-xs border border-gray-200">
                                {item.code}
                              </span>
                              <button
                                onClick={() => handleCopy(item.code, 'code_' + item.id)}
                                className="p-1 text-gray-400 hover:text-feishu-600 transition-colors"
                                title="复制密码字符串"
                              >
                                {copiedId === 'code_' + item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-[#1f2329] font-medium">
                            {item.label || <span className="text-gray-400 text-xs">无备注</span>}
                          </td>

                          <td className="py-4 px-4 text-xs">
                            {item.doc_id ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 font-medium max-w-[200px] truncate" title={item.doc_title || item.doc_id}>
                                <span>📄 单篇: 《{item.doc_title || '特定文档'}》</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
                                <span>🌟 全专栏所有文档</span>
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleCodeActive(item)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                item.is_active === 1
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                              title="点击切换启用/冻结状态"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${item.is_active === 1 ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                              <span>{item.is_active === 1 ? '正常生效' : '已冻结'}</span>
                            </button>
                          </td>

                          <td className="py-4 px-4 text-xs text-[#646a73] whitespace-nowrap">
                            <span className="font-semibold text-[#1f2329]">{item.usage_count}</span>
                            <span> / {item.max_uses === -1 ? '无限次' : `${item.max_uses}次`}</span>
                          </td>

                          <td className="py-4 px-4 text-xs whitespace-nowrap">
                            {item.expires_at ? (
                              <span className={isExpired ? 'text-rose-600 font-semibold' : 'text-gray-600'}>
                                {item.expires_at.substring(0, 10)} {isExpired ? '(已过期)' : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400">永久有效</span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {/* One-click copy direct VIP unlock link */}
                              <button
                                onClick={() => {
                                  const targetDoc = item.doc_id ? docs.find(d => d.id === item.doc_id) : docs[0]
                                  const docSlug = targetDoc ? (targetDoc.slug || targetDoc.id) : ''
                                  const directLink = `${window.location.origin}/doc/${docSlug}?key=${encodeURIComponent(item.code)}`
                                  handleCopy(directLink, 'link_' + item.id)
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                                title="一键复制免密直达链接给学员"
                              >
                                {copiedId === 'link_' + item.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>已复制直达链</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>复制直达链接</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => openEditCodeModal(item)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="修改密码 / 备注 / 有效期"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteCode(item.id, item.code)}
                                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="废弃删除密码"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Site & Pay Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-8 mt-6">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-[#dee0e3] shadow-card p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#1f2329]">专栏基础设置</h2>
              <p className="text-xs text-[#8f959e] mt-0.5">定制你的知识付费专栏标题、主理人名片与购买指引</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#646a73] mb-1.5">专栏名称</label>
                <input
                  type="text"
                  value={settings.site_name}
                  onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                  placeholder="例如: 智汇知识库 · 深度实战专栏"
                  className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#646a73] mb-1.5">主理人署名</label>
                <input
                  type="text"
                  value={settings.author_name}
                  onChange={(e) => setSettings({ ...settings, author_name: e.target.value })}
                  placeholder="例如: 张老师 / 专栏主理人"
                  className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#646a73] mb-1.5">专栏副标题 / 简介</label>
              <textarea
                rows={2}
                value={settings.site_description}
                onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                placeholder="介绍专栏内容和价值..."
                className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
              />
            </div>

            <hr className="border-gray-100" />

            <div>
              <h2 className="text-base font-bold text-[#1f2329]">付费购买与微信指引</h2>
              <p className="text-xs text-[#8f959e] mt-0.5">当未付费读者点击VIP文档时，将展示以下购买指引与主理人微信号</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#646a73] mb-1.5">主理人微信号 (读者可一键复制)</label>
              <input
                type="text"
                value={settings.contact_wechat}
                onChange={(e) => setSettings({ ...settings, contact_wechat: e.target.value })}
                placeholder="例如: my_wechat_vip"
                className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#646a73] mb-1.5">付费拦截页提示文案 (Paywall Notice)</label>
              <textarea
                rows={3}
                value={settings.pay_notice}
                onChange={(e) => setSettings({ ...settings, pay_notice: e.target.value })}
                placeholder="本专栏为付费专属内容，添加微信获取独立访问密码..."
                className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#646a73] mb-1.5">微信收款或客服二维码图片 URL (可选)</label>
              <input
                type="text"
                value={settings.contact_qr_url}
                onChange={(e) => setSettings({ ...settings, contact_qr_url: e.target.value })}
                placeholder="https://... 二维码图片链接"
                className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
              />
            </div>

            <hr className="border-gray-100" />

            <div>
              <h2 className="text-base font-bold text-[#1f2329]">管理员密码修改</h2>
              <p className="text-xs text-[#8f959e] mt-0.5">若需修改管理员后台登录密码，请在此填写新密码</p>
              <div className="mt-3 max-w-sm">
                <input
                  type="password"
                  value={settings.admin_password || ''}
                  onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })}
                  placeholder="留空表示保持当前密码不变"
                  className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="submit"
                disabled={saveStatus === 'saving'}
                className="px-6 py-2.5 bg-feishu-600 hover:bg-feishu-700 disabled:bg-feishu-300 text-white rounded-xl text-sm font-medium shadow-xs transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saveStatus === 'saving' ? '正在保存...' : '保存全部设置'}</span>
              </button>

              {saveStatus === 'success' && (
                <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>设置已成功生效！</span>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Stats */}
      {activeTab === 'stats' && stats && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#dee0e3] shadow-card">
              <div className="text-xs font-semibold text-[#8f959e] uppercase">总文档数</div>
              <div className="text-2xl font-extrabold text-[#1f2329] mt-2">{stats.totalDocs}</div>
              <div className="text-xs text-[#646a73] mt-1">{stats.publishedDocs} 篇已公开发布</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#dee0e3] shadow-card">
              <div className="text-xs font-semibold text-[#8f959e] uppercase">VIP 学员授权码</div>
              <div className="text-2xl font-extrabold text-[#1f2329] mt-2">{stats.totalCodes}</div>
              <div className="text-xs text-emerald-600 mt-1">{stats.activeCodes} 个正常生效中</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#dee0e3] shadow-card">
              <div className="text-xs font-semibold text-[#8f959e] uppercase">专栏总阅读量</div>
              <div className="text-2xl font-extrabold text-[#1f2329] mt-2">{stats.totalViews}</div>
              <div className="text-xs text-feishu-600 mt-1">文档浏览总累计</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#dee0e3] shadow-card">
              <div className="text-xs font-semibold text-[#8f959e] uppercase">VIP 密码验证次数</div>
              <div className="text-2xl font-extrabold text-[#1f2329] mt-2">{stats.totalUsage}</div>
              <div className="text-xs text-purple-600 mt-1">学员累计解锁次数</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Passcode */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-modal max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#1f2329] flex items-center gap-2">
                <Key className="w-5 h-5 text-feishu-600" />
                <span>{editingCode ? '修改学员专属密码' : '生成新学员专属密码'}</span>
              </h3>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveCode} className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#646a73]">
                    访问密码 (一人一密核心)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = 'VIP-' + Math.random().toString(36).substring(2, 7).toUpperCase()
                      setCodeForm({ ...codeForm, code: rand })
                    }}
                    className="text-[11px] text-feishu-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    随机生成
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={codeForm.code}
                  onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value })}
                  placeholder="例如: VIP-9824X 或自定义汉字/拼音"
                  className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#646a73] mb-1.5">
                  学员姓名 / 购买备注
                </label>
                <input
                  type="text"
                  value={codeForm.label}
                  onChange={(e) => setCodeForm({ ...codeForm, label: e.target.value })}
                  placeholder="例如: 学员王晓 (微信: wx_12345)"
                  className="w-full px-3.5 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                />
              </div>

              {/* Permission Scope Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#646a73] mb-2">
                  权限授权范围 (单篇文档 或 所有文档)
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCodeForm({ ...codeForm, doc_id: '' })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      codeForm.doc_id === ''
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'bg-[#f9f9fa] border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <span>🌟 全专栏通用</span>
                    </div>
                    <div className="text-[11px] text-[#8f959e] mt-0.5">解锁所有付费文档</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!codeForm.doc_id && docs.length > 0) {
                        setCodeForm({ ...codeForm, doc_id: docs[0].id })
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      codeForm.doc_id !== ''
                        ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                        : 'bg-[#f9f9fa] border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <span>📄 单一文档专属</span>
                    </div>
                    <div className="text-[11px] text-[#8f959e] mt-0.5">仅限指定单篇文档</div>
                  </button>
                </div>

                {/* If single doc selected, show doc dropdown */}
                {codeForm.doc_id !== '' && (
                  <div className="mt-2.5 bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                    <label className="block text-[11px] font-semibold text-blue-900 mb-1.5">
                      请选择要授权的单一文档：
                    </label>
                    <select
                      value={codeForm.doc_id}
                      onChange={(e) => setCodeForm({ ...codeForm, doc_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-feishu-500"
                    >
                      {docs.map(d => (
                        <option key={d.id} value={d.id}>📄 {d.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#646a73] mb-1.5">
                    最大使用次数 (-1为不限)
                  </label>
                  <input
                    type="number"
                    value={codeForm.max_uses}
                    onChange={(e) => setCodeForm({ ...codeForm, max_uses: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#646a73] mb-1.5">
                    有效期截止日 (可选)
                  </label>
                  <input
                    type="date"
                    value={codeForm.expires_at}
                    onChange={(e) => setCodeForm({ ...codeForm, expires_at: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#646a73] mb-1.5">
                  密码启用状态
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="is_active"
                      checked={codeForm.is_active === 1}
                      onChange={() => setCodeForm({ ...codeForm, is_active: 1 })}
                      className="accent-feishu-600"
                    />
                    <span>正常启用</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="is_active"
                      checked={codeForm.is_active === 0}
                      onChange={() => setCodeForm({ ...codeForm, is_active: 0 })}
                      className="accent-rose-600"
                    />
                    <span>临时冻结 / 禁用</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-feishu-600 hover:bg-feishu-700 text-white text-sm font-medium rounded-xl shadow-xs"
                >
                  {editingCode ? '保存修改' : '确认生成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
