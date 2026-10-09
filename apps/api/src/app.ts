import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Server as SocketServer } from 'socket.io';
import { credentialsSchema, idSchema, messageInputSchema, projectInputSchema, reportInputSchema, taskInputSchema, taskStatus } from '@taskflow/contracts';
import { AuthRequest, clearRefreshCookie, hashToken, issueAccessToken, newOpaqueToken, readRefreshCookie, requireAuth, setRefreshCookie, verifyAccessToken, type User } from './auth';
import type { AppDatabase } from './db';

const api = '/api/v1';
const uploadsRoot = process.env.UPLOADS_DIR ?? join(import.meta.dir, '../../../uploads');
mkdirSync(join(uploadsRoot, 'covers'), { recursive: true });
mkdirSync(join(uploadsRoot, 'attachments'), { recursive: true });

type Project = { id: number; owner_id: number; name: string; description: string; visibility: string; archived_at: string | null; hidden_at: string | null; cover_path: string | null };
type EventName = 'task.created' | 'task.updated' | 'task.moved' | 'task.assigned' | 'member.joined' | 'member.left' | 'project.owner.transferred' | 'chat.message.created' | 'report.created' | 'project.updated';

const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const parse = <T>(schema: { safeParse(value: unknown): { success: boolean; data?: T } }, value: unknown, res: Response): T | null => {
  const result = schema.safeParse(value);
  if (!result.success) { fail(res, 422, 'VALIDATION_ERROR', 'Controlla i campi inseriti.'); return null; }
  return result.data ?? null;
};
const userOf = (req: AuthRequest) => req.user!;
const memberRow = (db: AppDatabase, projectId: number, userId: number) => db.query<{ id: number; joined_at: string; history_from_id: number }, any[]>('SELECT id, joined_at, history_from_id FROM memberships WHERE project_id = ? AND user_id = ? AND left_at IS NULL').get(projectId, userId);
const projectRow = (db: AppDatabase, projectId: number) => db.query<Project, any[]>('SELECT * FROM projects WHERE id = ?').get(projectId);
const isAdmin = (db: AppDatabase, userId: number) => db.query<{ role: string; blocked_at: string | null }, any[]>('SELECT role, blocked_at FROM users WHERE id = ?').get(userId);

function event(io: SocketServer | null, projectId: number, name: EventName, data: unknown) {
  io?.to(`project:${projectId}`).emit(name, { eventId: randomUUID(), projectId, occurredAt: Date.now(), data });
}

function mustMember(db: AppDatabase, req: AuthRequest, res: Response, projectId: number) {
  const member = memberRow(db, projectId, userOf(req).id);
  if (!member) { fail(res, 404, 'NOT_FOUND', 'Progetto non trovato.'); return null; }
  const project = projectRow(db, projectId);
  if (!project) { fail(res, 404, 'NOT_FOUND', 'Progetto non trovato.'); return null; }
  return { member, project };
}

function mustOwner(db: AppDatabase, req: AuthRequest, res: Response, projectId: number) {
  const access = mustMember(db, req, res, projectId);
  if (!access) return null;
  if (access.project.owner_id !== userOf(req).id) { fail(res, 403, 'FORBIDDEN', 'Solo il proprietario può eseguire questa operazione.'); return null; }
  return access;
}

function mutableProject(project: Project, res: Response, ownerException = false) {
  if (project.hidden_at) { fail(res, 423, 'PROJECT_HIDDEN', 'Il progetto è nascosto dalla moderazione.'); return false; }
  if (project.archived_at && !ownerException) { fail(res, 423, 'PROJECT_ARCHIVED', 'Il progetto è archiviato e in sola lettura.'); return false; }
  return true;
}

function actualMime(path: string, declared: string) {
  const bytes = readFileSync(path).subarray(0, 8);
  const ext = extname(path).toLowerCase();
  if (ext === '.png' && bytes.toString('hex') === '89504e470d0a1a0a' && declared === 'image/png') return 'image/png';
  if (ext === '.jpg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && declared === 'image/jpeg') return 'image/jpeg';
  if (ext === '.pdf' && bytes.toString('ascii', 0, 5) === '%PDF-' && declared === 'application/pdf') return 'application/pdf';
  if (ext === '.txt' && declared === 'text/plain') {
    const text = readFileSync(path);
    try { new TextDecoder('utf-8', { fatal: true }).decode(text); return 'text/plain'; } catch { return null; }
  }
  return null;
}

const disk = multer.diskStorage({
  destination: (req, _file, cb) => cb(null, join(uploadsRoot, req.path.endsWith('/cover') ? 'covers' : 'attachments')),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage: disk,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ['.txt', '.png', '.jpg', '.pdf'].includes(extname(file.originalname).toLowerCase())),
});

export function createApp(db: AppDatabase, io: SocketServer | null = null) {
  const app = express();
  const auth: RequestHandler = (req, res, next) => requireAuth(req as AuthRequest, res, (error?: unknown) => {
    if (error) return next(error);
    const user = db.query<User & { blocked_at: string | null }, any[]>('SELECT id, display_name, email, role, blocked_at FROM users WHERE id = ?').get((req as AuthRequest).user!.id);
    if (!user || user.blocked_at) return fail(res, 401, 'UNAUTHORIZED', 'Account non disponibile.');
    (req as AuthRequest).user = user;
    next();
  });
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin) {
        try { if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) return fail(res, 403, 'BAD_ORIGIN', 'Origine non consentita.'); }
        catch { return fail(res, 403, 'BAD_ORIGIN', 'Origine non consentita.'); }
      }
    }
    next();
  });
  app.use(api, (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    const user = token ? verifyAccessToken(token) : null;
    if (user) {
      const current = db.query<{ token_version: number }, any[]>('SELECT token_version FROM users WHERE id = ? AND blocked_at IS NULL').get(user.id);
      if (!current || current.token_version !== user.token_version) return fail(res, 401, 'UNAUTHORIZED', 'Account non disponibile.');
    }
    next();
  });

  app.get(`${api}/health`, (_req, res) => res.json({ status: 'ok' }));

  app.post(`${api}/auth/register`, async (req, res) => {
    const input = parse(credentialsSchema.extend({ displayName: credentialsSchema.shape.displayName.unwrap() }), req.body, res);
    if (!input) return;
    try {
      const result = db.query('INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)').run(input.displayName, input.email.toLowerCase(), await Bun.password.hash(input.password));
      const user = db.query<User, any[]>('SELECT id, display_name, email, role, token_version FROM users WHERE id = ?').get(Number(result.lastInsertRowid))!;
      const token = newOpaqueToken();
      db.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hashToken(token), new Date(Date.now() + 7 * 86400_000).toISOString());
      setRefreshCookie(res, token);
      res.status(201).json({ user, accessToken: issueAccessToken(user) });
    } catch (error) {
      if (String(error).includes('UNIQUE')) return fail(res, 409, 'EMAIL_EXISTS', 'Esiste già un account con questa email.');
      throw error;
    }
  });

  app.post(`${api}/auth/login`, async (req, res) => {
    const parsed = parse(credentialsSchema.pick({ email: true, password: true }), req.body, res);
    if (!parsed) return;
    const row = db.query<User & { password_hash: string; blocked_at: string | null }, any[]>('SELECT id, display_name, email, role, token_version, blocked_at, password_hash FROM users WHERE email = ? COLLATE NOCASE').get(parsed.email);
    if (!row || row.blocked_at || !await Bun.password.verify(parsed.password, row.password_hash)) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email o password non corretti.');
    const token = newOpaqueToken();
    db.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(row.id, hashToken(token), new Date(Date.now() + 7 * 86400_000).toISOString());
    setRefreshCookie(res, token);
    const user: User = { id: row.id, display_name: row.display_name, email: row.email, role: row.role, token_version: row.token_version };
    res.json({ user, accessToken: issueAccessToken(user) });
  });

  app.post(`${api}/auth/refresh`, (req, res) => {
    const token = readRefreshCookie(req);
    if (!token) return fail(res, 401, 'SESSION_EXPIRED', 'La sessione è scaduta. Accedi di nuovo.');
    const session = db.query<{ id: number; user_id: number; expires_at: string }, any[]>('SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?').get(hashToken(token));
    if (!session || new Date(session.expires_at).getTime() < Date.now()) { clearRefreshCookie(res); return fail(res, 401, 'SESSION_EXPIRED', 'La sessione è scaduta. Accedi di nuovo.'); }
    const user = db.query<User & { blocked_at: string | null }, any[]>('SELECT id, display_name, email, role, token_version, blocked_at FROM users WHERE id = ?').get(session.user_id);
    if (!user || user.blocked_at) { clearRefreshCookie(res); return fail(res, 401, 'SESSION_EXPIRED', 'La sessione è scaduta. Accedi di nuovo.'); }
    const nextToken = newOpaqueToken();
    db.query('UPDATE sessions SET token_hash = ?, expires_at = ? WHERE id = ?').run(hashToken(nextToken), new Date(Date.now() + 7 * 86400_000).toISOString(), session.id);
    setRefreshCookie(res, nextToken);
    res.json({ user, accessToken: issueAccessToken(user) });
  });

  app.post(`${api}/auth/logout`, (req, res) => {
    const token = readRefreshCookie(req);
    if (token) db.query('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    clearRefreshCookie(res); res.status(204).end();
  });

  app.get(`${api}/auth/me`, requireAuth, (req: AuthRequest, res) => {
    const user = db.query<User & { blocked_at: string | null }, any[]>('SELECT id, display_name, email, role, token_version, blocked_at FROM users WHERE id = ?').get(userOf(req).id);
    if (!user || user.blocked_at) return fail(res, 401, 'UNAUTHORIZED', 'Account non disponibile.');
    const { blocked_at: _blocked, token_version: _version, ...safe } = user;
    res.json(safe);
  });

  app.post(`${api}/auth/forgot`, (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    const user = db.query<{ id: number; email: string }, any[]>('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (user) {
      const token = newOpaqueToken();
      db.query('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      db.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hashToken(token), new Date(Date.now() + 3600_000).toISOString());
      console.info(`[email mock] password reset to ${user.email}: http://localhost:5173/reset/${token}`);
    }
    res.json({ message: 'Se l’indirizzo è registrato, riceverai un link per il recupero.' });
  });

  app.post(`${api}/auth/reset/:token`, async (req, res) => {
    const parsed = parse(credentialsSchema.pick({ password: true }), req.body, res);
    if (!parsed) return;
    const row = db.query<{ id: number; user_id: number; expires_at: string }, any[]>('SELECT id, user_id, expires_at FROM password_resets WHERE token_hash = ?').get(hashToken(String(req.params.token)));
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return fail(res, 400, 'RESET_INVALID', 'Il link di recupero è scaduto o non valido.');
    db.query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(await Bun.password.hash(parsed.password), row.user_id);
    db.query('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
    db.query('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    res.json({ message: 'Password aggiornata. Puoi accedere.' });
  });

  app.get(`${api}/projects`, requireAuth, (req: AuthRequest, res) => {
    const id = userOf(req).id;
    const projects = db.query('SELECT DISTINCT p.*, u.display_name AS owner_name, (p.owner_id = ?) AS is_owner FROM projects p LEFT JOIN memberships m ON m.project_id = p.id LEFT JOIN users u ON u.id = p.owner_id WHERE p.owner_id = ? OR (m.user_id = ? AND m.left_at IS NULL) ORDER BY p.updated_at DESC').all(id, id, id);
    const catalog = db.query("SELECT p.id, p.name, p.description, p.category, p.technologies, p.cover_path, p.created_at, u.display_name AS owner_name FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.visibility = 'public' AND p.archived_at IS NULL AND p.hidden_at IS NULL AND p.owner_id != ? AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.project_id = p.id AND m.user_id = ? AND m.left_at IS NULL) ORDER BY p.created_at DESC").all(id, id);
    res.json({ projects, catalog });
  });

  app.post(`${api}/projects`, requireAuth, (req: AuthRequest, res) => {
    const input = parse(projectInputSchema, req.body, res);
    if (!input) return;
    const result = db.query('INSERT INTO projects (owner_id, name, description, category, technologies, visibility) VALUES (?, ?, ?, ?, ?, ?)').run(userOf(req).id, input.name, input.description, input.category, input.technologies, input.visibility);
    const projectId = Number(result.lastInsertRowid);
    db.query('INSERT INTO memberships (project_id, user_id) VALUES (?, ?)').run(projectId, userOf(req).id);
    res.status(201).json(projectRow(db, projectId));
  });

  app.get(`${api}/projects/:id`, (req, res) => {
    const projectId = Number(idSchema.parse(req.params.id));
    const project = projectRow(db, projectId);
    if (!project || project.hidden_at) return fail(res, 404, 'NOT_FOUND', 'Progetto non trovato.');
    const user = req.get('authorization') ? verifyAccessToken(req.get('authorization')!.replace(/^Bearer\s+/i, '')) : null;
    const membership = user ? memberRow(db, projectId, user.id) : null;
    if (project.visibility !== 'public' && !membership) return fail(res, 404, 'NOT_FOUND', 'Progetto non trovato.');
    res.json({ ...project, role: user?.id === project.owner_id ? 'owner' : membership ? 'member' : 'visitor' });
  });

  app.patch(`${api}/projects/:id`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    if (access.project.hidden_at) return fail(res, 423, 'PROJECT_HIDDEN', 'Il progetto è nascosto dalla moderazione.');
    if (access.project.archived_at) {
      const allowed = ['description'].every((key) => key in req.body) && Object.keys(req.body).every((key) => key === 'description');
      if (!allowed) return fail(res, 423, 'PROJECT_ARCHIVED', 'In archivio puoi aggiornare solo la descrizione.');
    }
    const data = parse(projectInputSchema.partial(), req.body, res); if (!data) return;
    const entries = Object.entries(data); if (!entries.length) return fail(res, 422, 'EMPTY_UPDATE', 'Indica almeno un campo da modificare.');
    const fields: Record<string, string> = { name: 'name', description: 'description', category: 'category', technologies: 'technologies', visibility: 'visibility' };
    db.query(`UPDATE projects SET ${entries.map(([k]) => `${fields[k]} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...entries.map(([, v]) => v), id);
    event(io, id, 'project.updated', projectRow(db, id)); res.json(projectRow(db, id));
  });

  app.delete(`${api}/projects/:id`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    const attachments = db.query<{ disk_name: string }, any[]>('SELECT a.disk_name FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.project_id = ?').all(id);
    for (const a of attachments) try { unlinkSync(join(uploadsRoot, 'attachments', a.disk_name)); } catch {}
    if (access.project.cover_path) try { unlinkSync(join(uploadsRoot, 'covers', access.project.cover_path)); } catch {}
    db.query('DELETE FROM projects WHERE id = ?').run(id); res.status(204).end();
  });

  app.post(`${api}/projects/:id/archive`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    db.query('UPDATE projects SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    db.query('UPDATE invitations SET revoked_at = CURRENT_TIMESTAMP WHERE project_id = ? AND revoked_at IS NULL').run(id);
    res.json(projectRow(db, id));
  });
  app.post(`${api}/projects/:id/restore`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    db.query('UPDATE projects SET archived_at = NULL WHERE id = ?').run(id); res.json(projectRow(db, id));
  });

  app.post(`${api}/projects/:id/cover`, requireAuth, upload.single('cover'), (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) { if (req.file) unlinkSync(req.file.path); return; }
    if (!req.file) return fail(res, 422, 'FILE_REQUIRED', 'Seleziona una copertina PNG o JPG.');
    const ext = extname(req.file.originalname).toLowerCase();
    if (!['.png', '.jpg'].includes(ext) || !actualMime(req.file.path, req.file.mimetype)) { unlinkSync(req.file.path); return fail(res, 422, 'FILE_INVALID', 'Il file non è una PNG o JPG valida.'); }
    const oldCover = access.project.cover_path;
    db.query('UPDATE projects SET cover_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.file.filename, id);
    if (oldCover) try { unlinkSync(join(uploadsRoot, 'covers', oldCover)); } catch {}
    res.json({ coverUrl: `${api}/projects/${id}/cover` });
  });
  app.get(`${api}/projects/:id/cover`, (req, res) => {
    const id = Number(req.params.id); const project = projectRow(db, id); if (!project?.cover_path) return fail(res, 404, 'NOT_FOUND', 'Copertina non trovata.');
    if (project.visibility !== 'public') {
      const user = req.get('authorization') ? verifyAccessToken(req.get('authorization')!.replace(/^Bearer\s+/i, '')) : null;
      if (!user || (!memberRow(db, id, user.id) && project.owner_id !== user.id)) return fail(res, 404, 'NOT_FOUND', 'Copertina non trovata.');
    }
    res.sendFile(join(uploadsRoot, 'covers', project.cover_path));
  });

  app.post(`${api}/projects/:id/join`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const project = projectRow(db, id); if (!project || project.visibility !== 'public' || project.hidden_at || project.archived_at) return fail(res, 404, 'NOT_FOUND', 'Progetto non disponibile.');
    if (memberRow(db, id, userOf(req).id)) return res.json({ joined: true });
    if (db.query('SELECT 1 FROM memberships WHERE project_id = ? AND user_id = ?').get(id, userOf(req).id)) return fail(res, 403, 'REJOIN_INVITE_REQUIRED', 'Per rientrare chiedi un nuovo invito al proprietario.');
    db.query('INSERT INTO memberships (project_id, user_id, history_from_id) VALUES (?, ?, (SELECT COALESCE(MAX(id), 0) + 1 FROM messages WHERE project_id = ?))').run(id, userOf(req).id, id);
    const member = db.query('SELECT id, display_name FROM users WHERE id = ?').get(userOf(req).id);
    event(io, id, 'member.joined', { member }); res.status(201).json({ joined: true });
  });

  app.post(`${api}/projects/:id/invites`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    if (!mutableProject(access.project, res)) return;
    const email = typeof req.body?.email === 'string' && req.body.email.trim() ? req.body.email.trim().toLowerCase() : null;
    if (email && !z.email().safeParse(email).success) return fail(res, 422, 'INVALID_EMAIL', 'Inserisci un indirizzo email valido.');
    const token = newOpaqueToken();
    db.query('INSERT INTO invitations (project_id, created_by, email, token_hash) VALUES (?, ?, ?, ?)').run(id, userOf(req).id, email, hashToken(token));
    const link = `http://localhost:5173/invite/${token}`;
    console.info(`[email mock] to ${email ?? 'link share'} | TaskFlow project invite | ${link}`);
    res.status(201).json({ link, email });
  });
  app.post(`${api}/projects/:id/invites/revoke`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); if (!mustOwner(db, req, res, id)) return;
    db.query('UPDATE invitations SET revoked_at = CURRENT_TIMESTAMP WHERE project_id = ? AND revoked_at IS NULL').run(id);
    res.json({ revoked: true });
  });
  app.post(`${api}/invites/:token/accept`, requireAuth, (req: AuthRequest, res) => {
    const invite = db.query<{ id: number; project_id: number; email: string | null }, any[]>('SELECT id, project_id, email FROM invitations WHERE token_hash = ? AND revoked_at IS NULL').get(hashToken(String(req.params.token)));
    if (!invite) return fail(res, 404, 'INVITE_INVALID', 'Invito scaduto o non valido.');
    const invitedEmail = db.query<{ email: string }, any[]>('SELECT email FROM users WHERE id = ?').get(userOf(req).id)?.email.toLowerCase();
    if (invite.email && invite.email.toLowerCase() !== invitedEmail) return fail(res, 403, 'INVITE_EMAIL_MISMATCH', 'Accedi con l’account indicato nell’invito.');
    const project = projectRow(db, invite.project_id); if (!project || project.archived_at || project.hidden_at) return fail(res, 423, 'PROJECT_UNAVAILABLE', 'Il progetto non accetta nuovi membri.');
    if (!memberRow(db, project.id, userOf(req).id)) {
      db.query('INSERT INTO memberships (project_id, user_id, history_from_id) VALUES (?, ?, (SELECT COALESCE(MAX(id), 0) + 1 FROM messages WHERE project_id = ?))').run(project.id, userOf(req).id, project.id);
      const member = db.query('SELECT id, display_name FROM users WHERE id = ?').get(userOf(req).id);
      event(io, project.id, 'member.joined', { member });
    }
    res.json({ projectId: project.id });
  });
  app.post(`${api}/projects/:id/transfer`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    if (access.project.archived_at) return fail(res, 423, 'PROJECT_ARCHIVED', 'Riattiva il progetto prima di trasferirne la proprietà.');
    const memberId = Number(req.body?.memberId);
    if (!Number.isInteger(memberId) || memberId === userOf(req).id || !memberRow(db, id, memberId)) return fail(res, 422, 'MEMBER_REQUIRED', 'Scegli un altro membro attivo del progetto.');
    const token = newOpaqueToken();
    db.query('DELETE FROM owner_transfers WHERE project_id = ?').run(id);
    db.query('INSERT INTO owner_transfers (project_id, new_owner_id, token_hash) VALUES (?, ?, ?)').run(id, memberId, hashToken(token));
    const link = `http://localhost:5173/transfer/${token}`;
    console.info(`[email mock] project ownership transfer to ${memberId}: ${link}`);
    res.status(201).json({ link });
  });
  app.post(`${api}/transfers/:token/accept`, requireAuth, (req: AuthRequest, res) => {
    const transfer = db.query<{ id: number; project_id: number; new_owner_id: number }, any[]>('SELECT id, project_id, new_owner_id FROM owner_transfers WHERE token_hash = ?').get(hashToken(String(req.params.token)));
    if (!transfer || transfer.new_owner_id !== userOf(req).id) return fail(res, 404, 'TRANSFER_INVALID', 'Invito al trasferimento non valido.');
    const project = projectRow(db, transfer.project_id);
    if (!project || project.archived_at || !memberRow(db, project.id, userOf(req).id)) return fail(res, 409, 'TRANSFER_CONFLICT', 'Il progetto o la membership non sono più attivi.');
    const previousOwner = db.query<{ id: number; display_name: string }, any[]>('SELECT id, display_name FROM users WHERE id = ?').get(project.owner_id)!;
    const newOwner = db.query<{ id: number; display_name: string }, any[]>('SELECT id, display_name FROM users WHERE id = ?').get(userOf(req).id)!;
    db.transaction(() => {
      db.query('UPDATE projects SET owner_id = ? WHERE id = ?').run(newOwner.id, project.id);
      db.query('DELETE FROM owner_transfers WHERE id = ?').run(transfer.id);
    })();
    event(io, project.id, 'project.owner.transferred', { previousOwner, owner: newOwner });
    res.json({ projectId: project.id, owner: newOwner });
  });

  app.get(`${api}/projects/:id/members`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); if (!mustMember(db, req, res, id)) return;
    res.json(db.query('SELECT u.id, u.display_name, u.email, m.joined_at, p.owner_id = u.id AS is_owner FROM memberships m JOIN users u ON u.id = m.user_id JOIN projects p ON p.id = m.project_id WHERE m.project_id = ? AND m.left_at IS NULL').all(id));
  });
  app.delete(`${api}/projects/:id/members/:memberId`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustOwner(db, req, res, id); if (!access) return;
    const memberId = Number(req.params.memberId); if (memberId === access.project.owner_id) return fail(res, 409, 'OWNER_CANNOT_LEAVE', 'Trasferisci prima la proprietà del progetto.');
    const member = db.query<{ id: number; display_name: string }, any[]>('SELECT u.id, u.display_name FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.project_id = ? AND m.user_id = ? AND m.left_at IS NULL').get(id, memberId);
    if (!member) return fail(res, 404, 'NOT_FOUND', 'Membro non trovato.');
    db.query('UPDATE memberships SET left_at = CURRENT_TIMESTAMP WHERE project_id = ? AND user_id = ? AND left_at IS NULL').run(id, memberId);
    io?.in(`user:${memberId}`).socketsLeave(`project:${id}`);
    event(io, id, 'member.left', { member, reason: 'removed' }); res.status(204).end();
  });
  app.post(`${api}/projects/:id/leave`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustMember(db, req, res, id); if (!access) return;
    if (access.project.owner_id === userOf(req).id) return fail(res, 409, 'OWNER_CANNOT_LEAVE', 'Trasferisci la proprietà o elimina il progetto.');
    const member = db.query<{ id: number; display_name: string }, any[]>('SELECT id, display_name FROM users WHERE id = ?').get(userOf(req).id);
    db.query('UPDATE memberships SET left_at = CURRENT_TIMESTAMP WHERE project_id = ? AND user_id = ? AND left_at IS NULL').run(id, userOf(req).id);
    io?.in(`user:${userOf(req).id}`).socketsLeave(`project:${id}`);
    event(io, id, 'member.left', { member, reason: 'left' }); res.status(204).end();
  });

  app.get(`${api}/projects/:id/tasks`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustMember(db, req, res, id); if (!access) return;
    res.json(db.query('SELECT t.*, u.display_name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.project_id = ? ORDER BY t.created_at DESC').all(id));
  });
  app.post(`${api}/projects/:id/tasks`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustMember(db, req, res, id); if (!access || !mutableProject(access.project, res)) return;
    const data = parse(taskInputSchema, req.body, res); if (!data) return;
    if (data.assigneeId && !memberRow(db, id, data.assigneeId)) return fail(res, 422, 'ASSIGNEE_NOT_MEMBER', 'L’assegnatario deve essere membro del progetto.');
    const result = db.query('INSERT INTO tasks (project_id, creator_id, assignee_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, userOf(req).id, data.assigneeId ?? null, data.title, data.description, data.priority, data.dueDate ?? null);
    const task = db.query('SELECT * FROM tasks WHERE id = ?').get(Number(result.lastInsertRowid));
    event(io, id, 'task.created', task); res.status(201).json(task);
  });
  app.patch(`${api}/tasks/:id`, requireAuth, (req: AuthRequest, res) => {
    const taskId = Number(req.params.id);
    const task = db.query<{ id: number; project_id: number; creator_id: number; status: string }, any[]>('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return fail(res, 404, 'NOT_FOUND', 'Task non trovato.');
    const access = mustMember(db, req, res, task.project_id); if (!access || !mutableProject(access.project, res)) return;
    const input = parse(taskInputSchema.partial().extend({ status: taskStatus.optional() }), req.body, res); if (!input) return;
    if (!Object.keys(input).length) return fail(res, 422, 'EMPTY_UPDATE', 'Indica almeno un campo da modificare.');
    if ('assigneeId' in input && input.assigneeId && !memberRow(db, task.project_id, input.assigneeId)) return fail(res, 422, 'ASSIGNEE_NOT_MEMBER', 'L’assegnatario deve essere membro del progetto.');
    const previousStatus = task.status;
    const columns: Record<string, string> = { title: 'title', description: 'description', priority: 'priority', dueDate: 'due_date', assigneeId: 'assignee_id', status: 'status' };
    const entries = Object.entries(input); db.query(`UPDATE tasks SET ${entries.map(([k]) => `${columns[k]} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...entries.map(([, v]) => v ?? null), taskId);
    const updated = db.query('SELECT t.*, u.display_name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?').get(taskId);
    if (input.status && input.status !== previousStatus) event(io, task.project_id, 'task.moved', { ...updated as object, previousStatus });
    else if (input.assigneeId) {
      if (input.assigneeId) io?.to(`user:${input.assigneeId}`).emit('task.assigned', { eventId: randomUUID(), projectId: task.project_id, occurredAt: Date.now(), data: updated });
    } else event(io, task.project_id, 'task.updated', updated);
    res.json(updated);
  });
  app.delete(`${api}/tasks/:id`, requireAuth, (req: AuthRequest, res) => {
    const taskId = Number(req.params.id); const task = db.query<{ project_id: number; creator_id: number }, any[]>('SELECT project_id, creator_id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return fail(res, 404, 'NOT_FOUND', 'Task non trovato.');
    const access = mustMember(db, req, res, task.project_id); if (!access || !mutableProject(access.project, res)) return;
    if (task.creator_id !== userOf(req).id && access.project.owner_id !== userOf(req).id) return fail(res, 403, 'FORBIDDEN', 'Solo autore o proprietario possono eliminare il task.');
    db.query('DELETE FROM tasks WHERE id = ?').run(taskId); res.status(204).end();
  });

  app.get(`${api}/projects/:id/messages`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustMember(db, req, res, id); if (!access) return;
    const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
    const rows = db.query('SELECT m.*, u.display_name AS author_name FROM messages m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? AND m.id >= ? AND m.id < ? ORDER BY m.id DESC LIMIT 50').all(id, access.member.history_from_id, before).reverse() as Array<Record<string, unknown> & { id: number }>;
    const messages = rows.map((m) => ({ ...m, attachments: db.query('SELECT id, original_name, mime_type, size FROM attachments WHERE message_id = ?').all(m.id) }));
    res.json({ items: messages, nextCursor: rows.length === 50 ? rows[0].id : null });
  });
  app.post(`${api}/projects/:id/messages`, requireAuth, upload.single('file'), (req: AuthRequest, res) => {
    const id = Number(req.params.id); const access = mustMember(db, req, res, id);
    if (!access || !mutableProject(access.project, res)) { if (req.file) unlinkSync(req.file.path); return; }
    const data = parse(messageInputSchema, { text: req.body?.text }, res);
    if (!data) { if (req.file) unlinkSync(req.file.path); return; }
    if (req.file) {
      const ext = extname(req.file.originalname).toLowerCase();
      if ((ext === '.txt' && req.file.size > 1024 * 1024) || !actualMime(req.file.path, req.file.mimetype)) { unlinkSync(req.file.path); return fail(res, 422, 'FILE_INVALID', 'Formato o dimensione del file non consentiti.'); }
    }
    const result = db.query('INSERT INTO messages (project_id, user_id, text) VALUES (?, ?, ?)').run(id, userOf(req).id, data.text);
    const messageId = Number(result.lastInsertRowid);
    if (req.file) db.query('INSERT INTO attachments (message_id, original_name, mime_type, size, disk_name) VALUES (?, ?, ?, ?, ?)').run(messageId, req.file.originalname, actualMime(req.file.path, req.file.mimetype), req.file.size, req.file.filename);
    const message = { id: messageId, project_id: id, user_id: userOf(req).id, author_name: userOf(req).display_name, text: data.text, created_at: new Date().toISOString(), attachments: db.query('SELECT id, original_name, mime_type, size FROM attachments WHERE message_id = ?').all(messageId) };
    event(io, id, 'chat.message.created', message); res.status(201).json(message);
  });
  app.get(`${api}/attachments/:id/download`, requireAuth, (req: AuthRequest, res) => {
    const attachment = db.query<{ id: number; message_id: number; disk_name: string; original_name: string; project_id: number; created_at: string }, any[]>('SELECT a.*, m.project_id, m.created_at FROM attachments a JOIN messages m ON m.id = a.message_id WHERE a.id = ?').get(Number(req.params.id));
    if (!attachment) return fail(res, 404, 'NOT_FOUND', 'Allegato non trovato.');
    const access = mustMember(db, req, res, attachment.project_id); if (!access) return;
    if (attachment.message_id < access.member.history_from_id) return fail(res, 404, 'NOT_FOUND', 'Allegato non trovato.');
    res.download(join(uploadsRoot, 'attachments', attachment.disk_name), attachment.original_name);
  });

  app.post(`${api}/projects/:id/reports`, requireAuth, (req: AuthRequest, res) => {
    const id = Number(req.params.id); const project = projectRow(db, id); if (!project || !memberRow(db, id, userOf(req).id)) return fail(res, 404, 'NOT_FOUND', 'Progetto non trovato.');
    const data = parse(reportInputSchema, req.body, res); if (!data) return;
    try {
      const result = db.query('INSERT INTO reports (project_id, reporter_id, category, details) VALUES (?, ?, ?, ?)').run(id, userOf(req).id, data.category, data.details);
      const report = { id: Number(result.lastInsertRowid), category: data.category, reporter: db.query('SELECT id, display_name FROM users WHERE id = ?').get(userOf(req).id) };
      io?.to('admins').emit('report.created', { eventId: randomUUID(), projectId: id, occurredAt: Date.now(), data: report });
      res.status(201).json(report);
    } catch { fail(res, 409, 'REPORT_OPEN', 'Hai già una segnalazione aperta per questo progetto.'); }
  });

  app.get(`${api}/admin/reports`, requireAuth, (req: AuthRequest, res) => {
    if (isAdmin(db, userOf(req).id)?.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Accesso riservato agli amministratori.');
    res.json(db.query("SELECT r.*, p.name AS project_name, u.display_name AS reporter_name FROM reports r JOIN projects p ON p.id = r.project_id JOIN users u ON u.id = r.reporter_id WHERE r.status = 'pending' ORDER BY r.created_at DESC").all());
  });
  app.get(`${api}/admin/hidden-projects`, requireAuth, (req: AuthRequest, res) => {
    if (isAdmin(db, userOf(req).id)?.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Accesso riservato agli amministratori.');
    res.json(db.query("SELECT id, name, owner_id FROM projects WHERE hidden_at IS NOT NULL ORDER BY hidden_at DESC").all());
  });
  app.get(`${api}/admin/blocked-users`, requireAuth, (req: AuthRequest, res) => {
    if (isAdmin(db, userOf(req).id)?.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Accesso riservato agli amministratori.');
    res.json(db.query("SELECT id, display_name, email, blocked_at FROM users WHERE blocked_at IS NOT NULL ORDER BY blocked_at DESC").all());
  });
  app.patch(`${api}/admin/reports/:id`, requireAuth, (req: AuthRequest, res) => {
    if (isAdmin(db, userOf(req).id)?.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Accesso riservato agli amministratori.');
    const status = req.body?.status; const action = req.body?.action ?? null; const reportId = Number(req.params.id);
    if (!['accepted', 'rejected'].includes(status) || ![null, 'hide_project', 'block_reporter'].includes(action)) return fail(res, 422, 'VALIDATION_ERROR', 'Stato o azione non validi.');
    const report = db.query<{ project_id: number; reporter_id: number }, any[]>('SELECT project_id, reporter_id FROM reports WHERE id = ? AND status = ?').get(reportId, 'pending');
    if (!report) return fail(res, 404, 'NOT_FOUND', 'Segnalazione non trovata o già chiusa.');
    db.query('UPDATE reports SET status = ?, action = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, action, userOf(req).id, reportId);
    if (action === 'hide_project') db.query('UPDATE projects SET hidden_at = CURRENT_TIMESTAMP WHERE id = ?').run(report.project_id);
    if (action === 'block_reporter') { db.query('UPDATE users SET blocked_at = CURRENT_TIMESTAMP, token_version = token_version + 1 WHERE id = ?').run(report.reporter_id); db.query('DELETE FROM sessions WHERE user_id = ?').run(report.reporter_id); io?.in(`user:${report.reporter_id}`).disconnectSockets(true); }
    res.json({ updated: true });
  });
  app.post(`${api}/admin/projects/:id/restore`, requireAuth, (req: AuthRequest, res) => {
    if (isAdmin(db, userOf(req).id)?.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Accesso riservato agli amministratori.');
    db.query('UPDATE projects SET hidden_at = NULL WHERE id = ?').run(Number(req.params.id)); res.json({ restored: true });
  });
  app.post(`${api}/admin/users/:id/unblock`, requireAuth, (req: AuthRequest, res) => {
    if (isAdmin(db, userOf(req).id)?.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Accesso riservato agli amministratori.');
    db.query('UPDATE users SET blocked_at = NULL WHERE id = ?').run(Number(req.params.id)); res.json({ unblocked: true });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'FILE_TOO_LARGE', 'Il file supera il limite consentito.');
    console.error(err);
    fail(res, 500, 'INTERNAL_ERROR', 'Si è verificato un errore. Riprova.');
  });
  return app;
}
