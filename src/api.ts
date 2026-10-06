import { Doc, AccessCode, SiteSettings, DashboardStats } from './types'

const ADMIN_TOKEN_KEY = 'kp_admin_token'
const GLOBAL_VIP_TOKEN_KEY = 'kp_global_vip_token'
const DOC_VIP_TOKENS_KEY = 'kp_doc_vip_tokens'
const VIP_LABEL_KEY = 'kp_vip_user_label'

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function removeAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

// Global & Per-Doc VIP Token Management
export function getGlobalVipToken(): string | null {
  return localStorage.getItem(GLOBAL_VIP_TOKEN_KEY)
}

export function getDocTokensMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DOC_VIP_TOKENS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getVipToken(docId?: string | null): string | null {
  const globalToken = getGlobalVipToken()
  if (globalToken) return globalToken

  if (docId) {
    const docTokens = getDocTokensMap()
    if (docTokens[docId]) return docTokens[docId]
  }

  // Fallback to any token
  const docTokens = getDocTokensMap()
  const firstDocToken = Object.values(docTokens)[0]
  return firstDocToken || null
}

export function saveVipToken(token: string, options: { canAccessAll?: boolean; docId?: string | null; label?: string }) {
  if (options.label) {
    localStorage.setItem(VIP_LABEL_KEY, options.label)
  }

  if (options.canAccessAll) {
    localStorage.setItem(GLOBAL_VIP_TOKEN_KEY, token)
  }

  if (options.docId) {
    const map = getDocTokensMap()
    map[options.docId] = token
    localStorage.setItem(DOC_VIP_TOKENS_KEY, JSON.stringify(map))
  }
}

export function hasVipAccessToDoc(docId: string): boolean {
  if (getGlobalVipToken()) return true
  const map = getDocTokensMap()
  return !!map[docId]
}

export function isAnyVipActive(): boolean {
  if (getGlobalVipToken()) return true
  const map = getDocTokensMap()
  return Object.keys(map).length > 0
}

export function getVipUserLabel(): string {
  return localStorage.getItem(VIP_LABEL_KEY) || 'VIP学员'
}

export function clearAllVipTokens() {
  localStorage.removeItem(GLOBAL_VIP_TOKEN_KEY)
  localStorage.removeItem(DOC_VIP_TOKENS_KEY)
  localStorage.removeItem(VIP_LABEL_KEY)
  localStorage.removeItem('kp_vip_token') // legacy clean
}

// Legacy alias
export const getVipTokenLegacy = getVipToken
export const removeVipToken = clearAllVipTokens

async function request<T = any>(endpoint: string, options: RequestInit = {}, docId?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {})

  const adminToken = getAdminToken()
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`)
  }

  const vipToken = getVipToken(docId)
  if (vipToken) {
    headers.set('X-Access-Token', vipToken)
  }

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || data.error || `请求失败 (${res.status})`)
  }

  return data
}

export const api = {
  // Auth
  async loginAdmin(password: string) {
    const res = await request<{ success: boolean; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    if (res.token) {
      setAdminToken(res.token)
    }
    return res
  },

  async checkAdminAuth(): Promise<boolean> {
    if (!getAdminToken()) return false
    try {
      const res = await request<{ authenticated: boolean }>('/api/auth/check')
      return res.authenticated
    } catch {
      return false
    }
  },

  logoutAdmin() {
    removeAdminToken()
  },

  // Settings
  async getSettings(): Promise<SiteSettings> {
    return await request<SiteSettings>('/api/settings')
  },

  async updateSettings(settings: Partial<SiteSettings>) {
    return await request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    })
  },

  // Stats
  async getStats(): Promise<DashboardStats> {
    return await request<DashboardStats>('/api/stats')
  },

  // Docs
  async getDocs(): Promise<Doc[]> {
    return await request<Doc[]>('/api/docs')
  },

  async getDoc(id: string, key?: string | null): Promise<Doc> {
    const query = key ? `?key=${encodeURIComponent(key)}` : ''
    return await request<Doc>(`/api/docs/${id}${query}`, {}, id)
  },

  async createDoc(doc: Partial<Doc>): Promise<{ success: boolean; id: string }> {
    return await request('/api/docs', {
      method: 'POST',
      body: JSON.stringify(doc),
    })
  },

  async updateDoc(id: string, doc: Partial<Doc>): Promise<{ success: boolean }> {
    return await request(`/api/docs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(doc),
    })
  },

  async deleteDoc(id: string): Promise<{ success: boolean }> {
    return await request(`/api/docs/${id}`, {
      method: 'DELETE',
    })
  },

  // Passcode & VIP verification (supports both single doc and all docs!)
  async verifyPasscode(code: string, docId?: string | null): Promise<{
    success: boolean
    token: string
    label?: string
    canAccessAll?: boolean
    docId?: string | null
    docTitle?: string | null
    message?: string
  }> {
    const res = await request<{
      success: boolean
      token: string
      label?: string
      canAccessAll?: boolean
      docId?: string | null
      docTitle?: string | null
      message?: string
    }>('/api/access/verify', {
      method: 'POST',
      body: JSON.stringify({ code, docId }),
    })

    if (res.token) {
      saveVipToken(res.token, {
        canAccessAll: res.canAccessAll,
        docId: res.docId,
        label: res.label,
      })
    }
    return res
  },

  async getPasscodes(): Promise<AccessCode[]> {
    return await request<AccessCode[]>('/api/passcodes')
  },

  async createPasscode(codeData: Partial<AccessCode>): Promise<{ success: boolean; id: string; code: string }> {
    return await request('/api/passcodes', {
      method: 'POST',
      body: JSON.stringify(codeData),
    })
  },

  async updatePasscode(id: string, codeData: Partial<AccessCode>): Promise<{ success: boolean }> {
    return await request(`/api/passcodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(codeData),
    })
  },

  async deletePasscode(id: string): Promise<{ success: boolean }> {
    return await request(`/api/passcodes/${id}`, {
      method: 'DELETE',
    })
  },

  // Upload image
  async uploadImage(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    return await request('/api/upload', {
      method: 'POST',
      body: formData,
    })
  },

  // Proxy external image to permanent base64
  async proxyImage(url: string): Promise<{ success: boolean; dataUrl: string }> {
    return await request('/api/proxy-image', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  },
}
