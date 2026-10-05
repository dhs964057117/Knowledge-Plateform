import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, ArrowLeft, KeyRound, AlertCircle, Shield } from 'lucide-react'
import { api } from '../../api'

export const AdminLoginPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setErrorMsg('请输入管理员密码')
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const res = await api.loginAdmin(password)
      if (res.success) {
        navigate('/admin')
      } else {
        setErrorMsg('密码错误')
      }
    } catch (err: any) {
      setErrorMsg(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        <div className="text-center">
          <div className="w-12 h-12 bg-feishu-50 border border-feishu-200 text-feishu-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-[#1f2329] tracking-tight">
            专栏主理人工作台
          </h2>
          <p className="mt-1 text-sm text-[#646a73]">
            登录以管理文档、生成学员专属卡密及配置专栏
          </p>
        </div>

        <div className="mt-8 bg-white py-8 px-6 shadow-card rounded-2xl border border-[#dee0e3] sm:px-10">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-semibold text-[#646a73] mb-1.5 uppercase">
                管理员口令 / 密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入管理密码 (初始默认: admin123)"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#f5f6f7] border border-[#dee0e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-feishu-500 focus:bg-white transition-all"
                  autoFocus
                />
              </div>
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
              className="w-full py-2.5 px-4 bg-feishu-600 hover:bg-feishu-700 disabled:bg-feishu-300 text-white text-sm font-medium rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {loading ? '正在验证...' : '进入管理工作台'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-[#646a73] hover:text-[#1f2329] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回前台专栏首页
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
