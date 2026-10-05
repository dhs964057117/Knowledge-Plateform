import { Doc, AccessCode, SiteSettings, DashboardStats } from './types'

const ADMIN_TOKEN_KEY = 'kp_admin_token'
const VIP_TOKEN_KEY = 'kp_vip_token'

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function removeAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getVipToken(): string | null {
  return localStorage.getItem(VIP_TOKEN_KEY)
}

export function setVipToken(token: string) {
  localStorage.setItem(VIP_TOKEN_KEY, token)
}

export function removeVipToken() {
  localStorage.removeItem(VIP_TOKEN_KEY)
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})

  const adminToken = getAdminToken()
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`)
  }

  const vipToken = getVipToken()
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
    return await request<Doc>(`/api/docs/${id}${query}`)
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

  // Passcode & VIP verification
  async verifyPasscode(code: string, docId?: string): Promise<{ success: boolean; token: string; label?: string; message?: string }> {
    const res = await request<{ success: boolean; token: string; label?: string; message?: string }>('/api/access/verify', {
      method: 'POST',
      body: JSON.stringify({ code, docId }),
    })
    if (res.token) {
      setVipToken(res.token)
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
}
