import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const secret = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
const b64 = (value: string) => Buffer.from(value).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

export type User = { id: number; display_name: string; email: string; role: 'user' | 'admin'; token_version?: number; blocked_at?: string | null };
export type AuthRequest = Request & { user?: User };

export function issueAccessToken(user: User) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub: user.id, role: user.role, ver: user.token_version ?? 0, exp: Math.floor(Date.now() / 1000) + 900 }));
  const content = `${head}.${body}`;
  return `${content}.${createHmac('sha256', secret).update(content).digest('base64url')}`;
}

export function verifyAccessToken(token: string): User | null {
  try {
    const [head, body, signature] = token.split('.');
    if (!head || !body || !signature) return null;
    const content = `${head}.${body}`;
    const expected = createHmac('sha256', secret).update(content).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!Number.isInteger(payload.sub) || payload.exp <= Date.now() / 1000) return null;
    return { id: payload.sub, role: payload.role, token_version: payload.ver ?? 0 } as User;
  } catch { return null; }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const user = token ? verifyAccessToken(token) : null;
  if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Accedi per continuare.' } });
  req.user = user;
  next();
}

export function setRefreshCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `taskflow_refresh=${token}; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800${secure}`);
}

export function clearRefreshCookie(res: Response) {
  res.setHeader('Set-Cookie', 'taskflow_refresh=; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=0');
}

export function readRefreshCookie(req: Request) {
  const value = req.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('taskflow_refresh='));
  return value?.slice('taskflow_refresh='.length);
}

export function newOpaqueToken() { return randomBytes(32).toString('base64url'); }
