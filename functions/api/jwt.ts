import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET_STRING = 'knowledge-feishu-secret-key-2026-safe-edge-auth'
const secretKey = new TextEncoder().encode(JWT_SECRET_STRING)

export async function createAdminToken(username = 'admin'): Promise<string> {
  return await new SignJWT({ role: 'admin', username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey)
}

export async function createVipToken(payload: { codeId: string; code: string; label: string; docId: string | null }): Promise<string> {
  return await new SignJWT({ role: 'vip', ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey)
}

export async function verifyToken(token: string): Promise<any | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey)
    return payload
  } catch (err) {
    return null
  }
}
