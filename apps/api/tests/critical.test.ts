import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import request from 'supertest';
import type { Server } from 'socket.io';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app';
import { issueAccessToken, type User } from '../src/auth';
import { openDatabase, type AppDatabase } from '../src/db';
import { configureRealtime } from '../src/realtime';

let db: AppDatabase;
let app: ReturnType<typeof createApp>;
let uploads: string;

async function account(email: string, role: 'user' | 'admin' = 'user') {
  const password = 'correct horse battery';
  const hash = await Bun.password.hash(password);
  const result = db.query('INSERT INTO users (display_name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(email.split('@')[0], email, hash, role);
  const user: User = { id: Number(result.lastInsertRowid), display_name: email.split('@')[0], email, role };
  return { user, password, token: issueAccessToken(user) };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const cookie = (response: request.Response) => response.headers['set-cookie'][0].split(';')[0];

beforeEach(() => {
  uploads = mkdtempSync(join(tmpdir(), 'taskflow-critical-test-'));
  db = openDatabase(':memory:');
  app = createApp(db, null, uploads);
});

afterEach(() => {
  db.close();
  rmSync(uploads, { recursive: true, force: true });
});

describe('critical security and lifecycle guarantees', () => {
  it('authenticates sockets and only joins active project rooms for current members', async () => {
    const owner = await account('owner@example.test');
    const member = await account('member@example.test');
    const admin = await account('admin@example.test', 'admin');
    const active = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Active realtime' }).expect(201);
    const archived = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Archived realtime' }).expect(201);
    const hidden = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Hidden realtime' }).expect(201);
    db.query('UPDATE projects SET archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(archived.body.id);
    db.query('UPDATE projects SET hidden_at = CURRENT_TIMESTAMP WHERE id = ?').run(hidden.body.id);
    for (const project of [active.body, archived.body, hidden.body]) db.query('INSERT INTO memberships (project_id, user_id) VALUES (?, ?)').run(project.id, member.user.id);

    let authenticate: ((socket: any, next: (error?: Error) => void) => void) | undefined;
    let onConnect: ((socket: any) => void) | undefined;
    const fakeIo = {
      use: (handler: typeof authenticate) => { authenticate = handler; },
      on: (event: string, handler: typeof onConnect) => { if (event === 'connection') onConnect = handler; },
    } as unknown as Server;
    configureRealtime(fakeIo, db);

    const joined: string[] = [];
    const left: string[] = [];
    const handlers = new Map<string, (value: unknown) => void>();
    const socket = {
      handshake: { auth: { token: member.token } }, data: {},
      join: (room: string) => joined.push(room), leave: (room: string) => left.push(room),
      on: (event: string, handler: (value: unknown) => void) => handlers.set(event, handler),
    };
    let authError: Error | undefined;
    authenticate!(socket, (error) => { authError = error; });
    expect(authError).toBeUndefined();
    onConnect!(socket);
    handlers.get('project:join')!(active.body.id);
    handlers.get('project:join')!(archived.body.id);
    handlers.get('project:join')!(hidden.body.id);
    handlers.get('project:join')!(9999);
    handlers.get('project:leave')!(active.body.id);
    expect(joined).toEqual([`user:${member.user.id}`, `project:${active.body.id}`]);
    expect(left).toEqual([`project:${active.body.id}`]);

    const adminSocket = { ...socket, handshake: { auth: { token: admin.token } }, data: {} };
    authenticate!(adminSocket, (error) => { authError = error; });
    onConnect!(adminSocket);
    expect(joined).toContain('admins');
    const blocked = await account('blocked@example.test');
    db.query('UPDATE users SET blocked_at = CURRENT_TIMESTAMP WHERE id = ?').run(blocked.user.id);
    authenticate!({ ...socket, handshake: { auth: { token: blocked.token } } }, (error) => { authError = error; });
    expect(authError?.message).toBe('unauthorized');
    authenticate!({ ...socket, handshake: { auth: { token: 'invalid' } } }, (error) => { authError = error; });
    expect(authError?.message).toBe('unauthorized');
  });

  it('validates credentials and revokes refresh and access sessions after logout and password reset', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({ displayName: 'Ada Demo', email: 'ada@example.test', password: 'correct horse battery' }).expect(201);
    const oldAccess = registered.body.accessToken as string;
    const oldCookie = cookie(registered);

    await request(app).post('/api/v1/auth/register').send({ displayName: 'Ada Demo', email: 'ADA@example.test', password: 'correct horse battery' }).expect(409);
    await request(app).post('/api/v1/auth/register').send({ displayName: 'A', email: 'invalid', password: 'short' }).expect(422);
    await request(app).get('/api/v1/auth/me').set(auth(oldAccess)).expect(200);
    await request(app).post('/api/v1/auth/logout').set('Cookie', oldCookie).expect(204);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: 'ada@example.test', password: 'wrong password' }).expect(401);

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'ada@example.test', password: 'correct horse battery' }).expect(200);
    const resetCookie = cookie(login);
    const originalInfo = console.info;
    let resetLog = '';
    console.info = (...args: unknown[]) => { resetLog = args.join(' '); };
    try { await request(app).post('/api/v1/auth/forgot').send({ email: 'ADA@example.test' }).expect(200); }
    finally { console.info = originalInfo; }
    const resetToken = resetLog.match(/\/reset\/([\w-]+)/)?.[1];
    expect(resetToken).toBeTruthy();
    await request(app).post(`/api/v1/auth/reset/${resetToken}`).send({ password: 'new correct password' }).expect(200);
    await request(app).get('/api/v1/auth/me').set(auth(login.body.accessToken)).expect(401);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', resetCookie).expect(401);
    await request(app).post(`/api/v1/auth/reset/${resetToken}`).send({ password: 'another correct password' }).expect(400);
    await request(app).post('/api/v1/auth/login').send({ email: 'ada@example.test', password: 'new correct password' }).expect(200);
  });

  it('rejects cross-site writes, unauthenticated private reads and malformed bearer tokens', async () => {
    const owner = await account('owner@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Private board' }).expect(201);
    const headers = await request(app).get('/api/v1/health').expect(200);
    expect(headers.headers['x-content-type-options']).toBe('nosniff');
    expect(headers.headers['referrer-policy']).toBe('same-origin');
    await request(app).post('/api/v1/projects').set(auth(owner.token)).set('Origin', 'https://attacker.example').send({ name: 'Blocked' }).expect(403);
    await request(app).post('/api/v1/projects').set(auth(owner.token)).set('Content-Type', 'application/json').send('{"name":').expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_JSON'));
    await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'A'.repeat(1_100_000) }).expect(413).expect(({ body }) => expect(body.error.code).toBe('REQUEST_TOO_LARGE'));
    await request(app).get(`/api/v1/projects/${project.body.id}`).expect(404);
    await request(app).get('/api/v1/dashboard').set(auth('not.a.valid.token')).expect(401);
    await request(app).get('/api/v1/dashboard').expect(401);
  });

  it('enforces public join, owner-only changes, leave and the no-rejoin rule', async () => {
    const owner = await account('owner@example.test');
    const member = await account('member@example.test');
    const outside = await account('outside@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Public board', visibility: 'public' }).expect(201);

    await request(app).get(`/api/v1/projects/${project.body.id}`).expect(200);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(member.token)).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(member.token)).expect(200).expect(({ body }) => expect(body.joined).toBe(true));
    await request(app).patch(`/api/v1/projects/${project.body.id}`).set(auth(member.token)).send({ name: 'Hijack' }).expect(403);
    await request(app).post(`/api/v1/projects/${project.body.id}/leave`).set(auth(owner.token)).expect(409);
    await request(app).post(`/api/v1/projects/${project.body.id}/leave`).set(auth(member.token)).expect(204);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(member.token)).expect(403);
    await request(app).delete(`/api/v1/projects/${project.body.id}/members/${member.user.id}`).set(auth(owner.token)).expect(404);
    await request(app).delete(`/api/v1/projects/${project.body.id}`).set(auth(outside.token)).expect(404);
    await request(app).patch(`/api/v1/projects/${project.body.id}`).set(auth(owner.token)).send({ description: 'Updated' }).expect(200);
    expect((await request(app).get('/api/v1/projects').set(auth(owner.token))).body.projects).toHaveLength(1);
  });

  it('requires active project membership for task assignment and limits deletion to its author or owner', async () => {
    const owner = await account('owner@example.test');
    const author = await account('author@example.test');
    const member = await account('member@example.test');
    const outside = await account('outside@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Tasks', visibility: 'public' }).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(author.token)).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(member.token)).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/tasks`).set(auth(author.token)).send({ title: 'Bad assignee', assigneeId: outside.user.id }).expect(422);
    const task = await request(app).post(`/api/v1/projects/${project.body.id}/tasks`).set(auth(author.token)).send({ title: 'Member task', assigneeId: member.user.id }).expect(201);
    await request(app).patch(`/api/v1/tasks/${task.body.id}`).set(auth(outside.token)).send({ status: 'done' }).expect(404);
    await request(app).delete(`/api/v1/tasks/${task.body.id}`).set(auth(member.token)).expect(403);
    await request(app).patch(`/api/v1/tasks/${task.body.id}`).set(auth(member.token)).send({ title: 'Updated by member' }).expect(200);
    await request(app).delete(`/api/v1/tasks/${task.body.id}`).set(auth(author.token)).expect(204);
    await request(app).delete(`/api/v1/tasks/${task.body.id}`).set(auth(author.token)).expect(404);
  });

  it('starts joined members at the chat history boundary and paginates history without leaking earlier messages', async () => {
    const owner = await account('owner@example.test');
    const member = await account('member@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Chat history', visibility: 'public' }).expect(201);
    for (let index = 0; index < 51; index++) {
      await request(app).post(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).field('text', `Old ${index}`).expect(201);
    }
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(member.token)).expect(201);
    expect((await request(app).get(`/api/v1/projects/${project.body.id}/messages`).set(auth(member.token)).expect(200)).body.items).toEqual([]);

    const first = await request(app).get(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).expect(200);
    expect(first.body.items).toHaveLength(50);
    expect(first.body.items[0].text).toBe('Old 1');
    expect(first.body.items.at(-1).text).toBe('Old 50');
    expect(first.body.nextCursor).toBe(first.body.items[0].id);
    const second = await request(app).get(`/api/v1/projects/${project.body.id}/messages?before=${first.body.nextCursor}`).set(auth(owner.token)).expect(200);
    expect(second.body.items.map((message: { text: string }) => message.text)).toEqual(['Old 0']);
    expect(second.body.nextCursor).toBeNull();
  });

  it('checks attachment signatures and removes every uploaded file when a batch is rejected', async () => {
    const owner = await account('owner@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Attachment checks' }).expect(201);
    const validPngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await request(app).post(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).field('text', 'MIME mismatch').attach('files', validPngSignature, { filename: 'image.png', contentType: 'image/jpeg' }).expect(422);
    await request(app).post(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).field('text', 'Invalid UTF-8').attach('files', Buffer.from([0xff, 0xfe]), { filename: 'invalid.txt', contentType: 'text/plain' }).expect(422);
    await request(app).post(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).field('text', 'Unsupported type').attach('files', Buffer.from('valid'), { filename: 'valid.txt', contentType: 'text/plain' }).attach('files', Buffer.from('not executable'), { filename: 'payload.exe', contentType: 'application/octet-stream' }).expect(422);

    const history = await request(app).get(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).expect(200);
    expect(history.body.items).toHaveLength(0);
    expect(readdirSync(join(uploads, 'attachments'))).toHaveLength(0);
  });

  it('closes duplicate reports, rejects invalid admin actions and restores hidden projects', async () => {
    const owner = await account('owner@example.test');
    const reporter = await account('reporter@example.test');
    const admin = await account('admin@example.test', 'admin');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Report target', visibility: 'public' }).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(reporter.token)).expect(201);
    const report = await request(app).post(`/api/v1/projects/${project.body.id}/reports`).set(auth(reporter.token)).send({ category: 'spam' }).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/reports`).set(auth(reporter.token)).send({ category: 'other' }).expect(409);
    await request(app).patch(`/api/v1/admin/reports/${report.body.id}`).set(auth(admin.token)).send({ status: 'pending', action: 'hide_project' }).expect(422);
    await request(app).patch(`/api/v1/admin/reports/${report.body.id}`).set(auth(admin.token)).send({ status: 'accepted', action: 'hide_project' }).expect(200);
    await request(app).get(`/api/v1/projects/${project.body.id}`).expect(404);
    const hidden = await request(app).get('/api/v1/admin/hidden-projects').set(auth(admin.token)).expect(200);
    expect(hidden.body.map((item: { id: number }) => item.id)).toContain(project.body.id);
    await request(app).post(`/api/v1/admin/projects/${project.body.id}/restore`).set(auth(admin.token)).expect(200);
    expect((await request(app).get(`/api/v1/projects/${project.body.id}`).expect(200)).body.hidden_at).toBeNull();
  });
});
