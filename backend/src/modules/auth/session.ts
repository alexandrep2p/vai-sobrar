import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { Db } from '../../shared/db.js';

// Sessão em cookie httpOnly + SameSite=Strict; o banco guarda só o SHA-256 do token (architecture §22).

export const SESSION_COOKIE = 'vs_session';

/** A sessão não expira por tempo (PD-40): o cookie vale 1 ano e é renovado com o uso. */
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
/** Intervalo mínimo entre renovações do cookie / `last_used_at`. */
export const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  secure: process.env['COOKIE_SECURE'] === 'true',
});

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Cria a sessão e devolve o token puro (vai somente para o cookie). */
export const createSession = async (db: Db, userId: string): Promise<string> => {
  const token = randomBytes(32).toString('base64url');
  await db.session.create({ data: { userId, tokenHash: hashToken(token) } });
  return token;
};

export const setSessionCookie = (res: Response, token: string): void => {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE_MS });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
};

/** Lê o token do cabeçalho Cookie (sem cookie-parser). */
export const readSessionToken = (req: Request): string | undefined => {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};
