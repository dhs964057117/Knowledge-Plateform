import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, KeyRound, Sparkles, LogOut, Settings } from 'lucide-react'
import { getAdminToken, getVipToken, removeAdminToken, removeVipToken } from '../api'
import { SiteSettings } from '../types'
import { PasscodeActivationModal } from './PasscodeActivationModal'

interface NavbarProps {
  settings?: SiteSettings | null
}

export const Navbar: React.FC<NavbarProps> = ({ settings }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVip, setIsVip] = useState(false)
  const [showPasscodeModal, setShowPasscodeModal] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)

  useEffect(() => {
    setIsAdmin(!!getAdminToken())
    setIsVip(!!getVipToken())
  }, [location.pathname])

  // Secret shortcut: Ctrl + Shift + A to open admin login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        navigate('/admin/login')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  // Stealth logo click: triple click logo to open admin login secretly
  const handleLogoClick = (e: React.MouseEvent) => {
    const nextCount = logoClicks + 1
    setLogoClicks(nextCount)
    if (nextCount >= 3) {
      e.preventDefault()
      setLogoClicks(0)
      navigate('/admin/login')
    } else {
      setTimeout(() => setLogoClicks(0), 1000)
    }
  }

  const handleLogoutAdmin = () => {
    removeAdminToken()
    setIsAdmin(false)
    navigate('/')
  }

  const handleClearVip = () => {
    if (window.confirm('确定要清除当前的 VIP 卡密授权吗？')) {
      removeVipToken()
      setIsVip(false)
      window.location.reload()
    }
  }

  const siteTitle = settings?.site_name || '智汇知识专栏'

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#dee0e3] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand / Logo (Triple-click hidden admin entrance) */}
          <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2.5 group select-none">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-feishu-600 to-blue-400 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-base text-[#1f2329] tracking-tight group-hover:text-feishu-600 transition-colors flex items-center gap-1.5">
                {siteTitle}
                <span className="text-[10px] bg-feishu-50 text-feishu-600 font-medium px-1.5 py-0.5 rounded border border-feishu-200">
                  知识专栏
                </span>
              </div>
              <div className="text-[11px] text-[#8f959e] hidden sm:block truncate max-w-[280px]">
                {settings?.site_description || '专属深度图文与实战手册'}
              </div>
            </div>
          </Link>

          {/* Right Action Items */}
          <div className="flex items-center gap-3">
            
            {/* Enter Passcode Button / VIP Status */}
            {isVip ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 text-xs rounded-full border border-amber-200 font-medium shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>已激活 VIP 专享权限</span>
                <button
                  onClick={handleClearVip}
                  title="更换或退出卡密"
                  className="ml-1 text-[11px] text-amber-600 hover:text-amber-900 underline font-normal"
                >
                  更换
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPasscodeModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-feishu-50 hover:bg-feishu-100 text-feishu-600 text-xs font-semibold rounded-xl border border-feishu-200 shadow-xs transition-all hover:shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5 text-feishu-600" />
                <span>输入专属卡密</span>
              </button>
            )}

            {/* ONLY if already logged in as admin: subtle management button */}
            {isAdmin && (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <Link
                  to="/admin"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:text-feishu-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="管理工作台"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">工作台</span>
                </Link>
                <button
                  onClick={handleLogoutAdmin}
                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="退出管理模式"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>

        </div>
      </header>

      {/* Global Passcode Activation Modal */}
      <PasscodeActivationModal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        settings={settings}
      />
    </>
  )
}
