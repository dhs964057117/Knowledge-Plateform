import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { HomePage } from './pages/HomePage'
import { DocReaderPage } from './pages/DocReaderPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { DocEditorPage } from './pages/admin/DocEditorPage'
import { api } from './api'
import { SiteSettings } from './types'

export const App: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null)

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar settings={settings} />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage settings={settings} />} />
          <Route path="/doc/:id" element={<DocReaderPage settings={settings} />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/new" element={<DocEditorPage />} />
          <Route path="/admin/edit/:id" element={<DocEditorPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
