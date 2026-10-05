import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, ShieldCheck, Settings, LogOut, Lock, ExternalLink, Menu, X, Sparkles } from 'lucide-react'
import { api, getAdminToken, getVipToken, removeAdminToken, removeVipToken } from '../api'
import { SiteSettings } from '../types'

interface NavbarProps {
  settings?: SiteSettings | null
}

export const Navbar: React.FC<NavbarProps> = ({ settings }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVip, setIsVip] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsAdmin(!!getAdminToken())
    setIsVip(!!getVipToken())
  }, [location.pathname])

  const handleLogout = () => {
    removeAdminToken()
    setIsAdmin(false)
    navigate('/')
  }

  const handleClearVip = () => {
    removeVipToken()
    setIsVip(false)
    window.location.reload()
  }

  const siteTitle = settings?.site_name || '智汇知识专栏'

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#dee0e3] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-feishu-600 to-blue-400 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-base text-[#1f2329] tracking-tight group-hover:text-feishu-600 transition-colors flex items-center gap-1.5">
              {siteTitle}
              <span className="text-[10px] bg-feishu-50 text-feishu-600 font-medium px-1.5 py-0.5 rounded border border-feishu-200">
                知识库
              </span>
            </div>
            <div className="text-[11px] text-[#8f959e] hidden sm:block truncate max-w-[280px]">
              {settings?.site_description || '专属深度图文与实战手册'}
            </div>
          </div>
        </Link>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/'
                ? 'text-feishu-600 bg-feishu-50 font-semibold'
                : 'text-[#646a73] hover:text-[#1f2329] hover:bg-[#eff0f1]'
            }`}
          >
            首页专栏
          </Link>

          {isVip && (
            <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>VIP已解锁</span>
              <button
                onClick={handleClearVip}
                title="清除本地授权缓存"
                className="ml-1 text-amber-600 hover:text-amber-900 underline text-[11px]"
              >
                退出
              </button>
            </div>
          )}

          {isAdmin ? (
            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-[#dee0e3]">
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'text-feishu-600 bg-feishu-50 font-semibold'
                    : 'text-[#646a73] hover:text-[#1f2329] hover:bg-[#eff0f1]'
                }`}
              >
                <Settings className="w-4 h-4" />
                管理后台
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                title="退出管理员登录"
              >
                <LogOut className="w-3.5 h-3.5" />
                退出
              </button>
            </div>
          ) : (
            <div className="ml-3 pl-3 border-l border-[#dee0e3]">
              <Link
                to="/admin/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#646a73] hover:text-[#1f2329] hover:bg-[#eff0f1] transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                主理人入口
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          {isAdmin ? (
            <Link
              to="/admin"
              className="text-xs font-medium px-2.5 py-1.5 bg-feishu-50 text-feishu-600 rounded-lg"
            >
              后台
            </Link>
          ) : null}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#dee0e3] bg-white px-4 py-3 space-y-2 shadow-lg">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-[#1f2329] hover:bg-gray-50"
          >
            首页专栏
          </Link>
          {isAdmin ? (
            <>
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-feishu-600 bg-feishu-50"
              >
                ⚙️ 管理工作台
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                退出登录
              </button>
            </>
          ) : (
            <Link
              to="/admin/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              主理人登录
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
