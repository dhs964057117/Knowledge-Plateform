import React, { useState } from 'react'
import { KeyRound, Sparkles, AlertCircle, CheckCircle2, MessageSquare, Copy, Check, X } from 'lucide-react'
import { api } from '../api'
import { SiteSettings } from '../types'

interface PasscodeActivationModalProps {
  isOpen: boolean
  onClose: () => void
  settings?: SiteSettings | null
  onSuccess?: (label?: string) => void
}

export const PasscodeActivationModal: React.FC<PasscodeActivationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSuccess,
}) => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successInfo, setSuccessInfo] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setErrorMsg('请输入您的专属访问密码')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessInfo(null)

    try {
      const res = await api.verifyPasscode(code.trim())
      if (res.success && res.token) {
        setSuccessInfo(res.label || '学员')
        setTimeout(() => {
          if (onSuccess) onSuccess(res.label)
          onClose()
          window.location.reload()
        }, 1200)
      } else {
        setErrorMsg(res.message || '卡密无效或已被停用')
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-modal max-w-md w-full overflow-hidden relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-3 shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#1f2329]">
              专属卡密激活
            </h3>
            <p className="mt-1 text-xs text-[#646a73]">
              输入主理人为您分配的专属密码，激活VIP阅读权限
            </p>
          </div>

          {/* Form */}
          {successInfo ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-base font-bold text-gray-900">卡密验证成功！</p>
              <p className="text-xs text-gray-500">已授权学员身份: <strong className="text-emerald-700">{successInfo}</strong></p>
              <p className="text-xs text-feishu-600 animate-pulse pt-2">正在载入专栏权限...</p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setErrorMsg('')
                  }}
                  placeholder="请输入您的专属卡密 (如 VIP888)"
                  className="w-full px-4 py-3 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-base text-[#1f2329] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white text-center font-mono font-semibold uppercase tracking-wider transition-all"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-rose-600 text-xs bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-feishu-600 hover:bg-feishu-700 disabled:bg-feishu-300 text-white font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>立即验证激活</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Guidance */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <div className="text-[11px] text-[#8f959e] font-medium mb-2">
              尚未获得卡密？
            </div>
            <p className="text-xs text-[#646a73] leading-relaxed max-w-xs mx-auto">
              {settings?.pay_notice || '请联系专栏主理人获取您的专属访问密码。'}
            </p>

            {settings?.contact_wechat && (
              <div className="mt-3 inline-flex items-center gap-2 bg-[#f9f9fa] border border-[#dee0e3] px-3 py-1.5 rounded-lg text-xs text-[#1f2329]">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>主理人微信: <strong>{settings.contact_wechat}</strong></span>
                <button
                  type="button"
                  onClick={handleCopyWeChat}
                  className="ml-1 text-[11px] flex items-center gap-1 text-feishu-600 hover:text-feishu-700 font-medium px-1.5 py-0.5 rounded bg-feishu-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
