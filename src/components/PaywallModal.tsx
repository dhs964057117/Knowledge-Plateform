import React, { useState } from 'react'
import { Lock, KeyRound, CheckCircle2, AlertCircle, Copy, Check, MessageSquare, Sparkles } from 'lucide-react'
import { api } from '../api'
import { SiteSettings } from '../types'

interface PaywallModalProps {
  docId: string
  docTitle?: string
  docExcerpt?: string
  coverImage?: string
  settings?: SiteSettings | null
  onSuccess: (token: string, label?: string) => void
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  docId,
  docTitle,
  docExcerpt,
  coverImage,
  settings,
  onSuccess,
}) => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setErrorMsg('请输入您的专属访问密码')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await api.verifyPasscode(code.trim(), docId)
      if (res.success && res.token) {
        onSuccess(res.token, res.label)
      } else {
        setErrorMsg(res.message || '密码无效或已被禁用')
      }
    } catch (err: any) {
      setErrorMsg(err.message || '密码错误或网络异常')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyWeChat = () => {
    if (settings?.contact_wechat) {
      navigator.clipboard.writeText(settings.contact_wechat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto my-8 bg-white border border-[#dee0e3] rounded-2xl shadow-card overflow-hidden">
      {/* Cover teaser banner if exists */}
      {coverImage && (
        <div className="relative h-48 w-full overflow-hidden bg-slate-100">
          <img
            src={coverImage}
            alt={docTitle}
            className="w-full h-full object-cover filter blur-[2px] scale-105 opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end p-6">
            <h2 className="text-xl font-bold text-white drop-shadow-sm">{docTitle}</h2>
          </div>
        </div>
      )}

      <div className="p-8 sm:p-10">
        
        {/* Lock Icon & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-[#1f2329] tracking-tight">
            VIP 付费学员专享内容
          </h2>
          <p className="mt-2 text-sm text-[#646a73] max-w-md mx-auto">
            {docExcerpt || '本文档包含高价值独家干货与实战方法论，需持有专属授权码访问'}
          </p>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <KeyRound className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setErrorMsg('')
              }}
              placeholder="请输入您的专属访问密码 (如 VIP888)"
              className="w-full pl-11 pr-4 py-3 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-base text-[#1f2329] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white transition-all shadow-inner"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-feishu-600 hover:bg-feishu-700 disabled:bg-feishu-300 text-white font-medium rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                <span>立即验证并解锁阅读</span>
              </>
            )}
          </button>
        </form>

        {/* Guidance / Buy Info */}
        <div className="mt-10 pt-6 border-t border-[#f0f2f5] text-center">
          <div className="text-xs text-[#8f959e] uppercase font-semibold tracking-wider mb-3">
            如何获取专属密码？
          </div>
          <p className="text-sm text-[#646a73] leading-relaxed max-w-lg mx-auto">
            {settings?.pay_notice || '本专栏内容为专属知识付费内容。如需开通访问权限，请联系主理人微信获取专属VIP密码。'}
          </p>

          {settings?.contact_wechat && (
            <div className="mt-4 inline-flex items-center gap-2 bg-[#f9f9fa] border border-[#dee0e3] px-3.5 py-2 rounded-xl text-sm text-[#1f2329]">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>主理人微信: <strong>{settings.contact_wechat}</strong></span>
              <button
                type="button"
                onClick={handleCopyWeChat}
                className="ml-2 text-xs flex items-center gap-1 text-feishu-600 hover:text-feishu-700 font-medium px-2 py-0.5 rounded bg-feishu-50 hover:bg-feishu-100 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>点击复制</span>
                  </>
                )}
              </button>
            </div>
          )}

          {settings?.contact_qr_url && (
            <div className="mt-4 flex justify-center">
              <img
                src={settings.contact_qr_url}
                alt="主理人微信二维码"
                className="w-36 h-36 rounded-xl border border-gray-200 shadow-sm p-1 bg-white"
              />
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
