export interface Doc {
  id: string
  title: string
  slug?: string
  excerpt?: string
  cover_image?: string
  content_html?: string
  content_json?: string
  is_published: number
  is_vip_only: number
  views_count?: number
  order_index?: number
  created_at: string
  updated_at: string
  isAuthorized?: boolean
  userLabel?: string
}

export interface AccessCode {
  id: string
  code: string
  label: string
  doc_id: string | null
  doc_title?: string | null
  is_active: number
  usage_count: number
  max_uses: number
  expires_at: string | null
  created_at: string
  updated_at?: string
}

export interface SiteSettings {
  site_name: string
  site_description: string
  author_name: string
  pay_notice: string
  contact_wechat: string
  contact_qr_url: string
  admin_password?: string
}

export interface DashboardStats {
  totalDocs: number
  publishedDocs: number
  totalCodes: number
  activeCodes: number
  totalViews: number
  totalUsage: number
}

export interface MediaAsset {
  key: string
  url: string
  size: number
  uploaded?: string
  contentType?: string
}

export interface StorageStats {
  engine: 'r2' | 'd1'
  r2Configured: boolean
  bucketName?: string
  totalCount: number
  totalBytes: number
  freeQuotaBytes: number
  objects?: MediaAsset[]
}
