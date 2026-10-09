import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import request from 'supertest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db';
import { issueAccessToken, type User } from '../src/auth';
import type { AppDatabase } from '../src/db';

let db: AppDatabase;
let app: ReturnType<typeof createApp>;

async function account(email: string, displayName = 'Test User', role: 'user' | 'admin' = 'user') {
  const password = await Bun.password.hash('correct horse battery');
  const result = db.query('INSERT INTO users (display_name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(displayName, email, password, role);
  const user: User = { id: Number(result.lastInsertRowid), display_name: displayName, email, role };
  return { user, token: issueAccessToken(user) };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => { db = openDatabase(':memory:'); app = createApp(db); });
afterEach(() => db.close());

describe('account and project board API', () => {
  it('registers, authenticates and rotates a refresh session', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({ displayName: 'Ada Lovelace', email: 'ada@example.test', password: 'correct horse battery' }).expect(201);
    expect(registered.body.user.display_name).toBe('Ada Lovelace');
    expect(registered.body.accessToken.split('.')).toHaveLength(3);
    const cookie = registered.headers['set-cookie'][0].split(';')[0];
    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.headers['set-cookie'][0]).not.toBe(cookie);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('recovers a password with a one-use mock-email link', async () => {
    const user = await account('recovery@example.test');
    const originalInfo = console.info;
    let emailMock = '';
    console.info = (...args: unknown[]) => { emailMock = args.join(' '); };
    try {
      await request(app).post('/api/v1/auth/forgot').send({ email: user.user.email }).expect(200);
    } finally { console.info = originalInfo; }
    const token = emailMock.match(/\/reset\/([\w-]+)/)?.[1];
    expect(token).toBeTruthy();
    await request(app).post(`/api/v1/auth/reset/${token}`).send({ password: 'new secure password' }).expect(200);
    await request(app).post(`/api/v1/auth/reset/${token}`).send({ password: 'another password' }).expect(400);
    await request(app).post('/api/v1/auth/login').send({ email: user.user.email, password: 'correct horse battery' }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: user.user.email, password: 'new secure password' }).expect(200);
  });

  it('enforces private project membership and the three task states', async () => {
    const owner = await account('owner@example.test');
    const outside = await account('outside@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Alpha', visibility: 'private' }).expect(201);
    await request(app).get(`/api/v1/projects/${project.body.id}/tasks`).set(auth(outside.token)).expect(404);
    const task = await request(app).post(`/api/v1/projects/${project.body.id}/tasks`).set(auth(owner.token)).send({ title: 'Prima attività', priority: 'high' }).expect(201);
    expect(task.body.status).toBe('todo');
    const moved = await request(app).patch(`/api/v1/tasks/${task.body.id}`).set(auth(owner.token)).send({ status: 'doing' }).expect(200);
    expect(moved.body.status).toBe('doing');
    await request(app).patch(`/api/v1/tasks/${task.body.id}`).set(auth(owner.token)).send({ status: 'blocked' }).expect(422);
  });

  it('shares an invite link, accepts it and persists member chat', async () => {
    const owner = await account('owner@example.test');
    const guest = await account('guest@example.test');
    const intruder = await account('intruder@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Team', visibility: 'private' }).expect(201);
    const invitation = await request(app).post(`/api/v1/projects/${project.body.id}/invites`).set(auth(owner.token)).send({ email: guest.user.email }).expect(201);
    const token = invitation.body.link.split('/').pop();
    await request(app).post(`/api/v1/invites/${token}/accept`).set(auth(intruder.token)).expect(403);
    await request(app).post(`/api/v1/invites/${token}/accept`).set(auth(guest.token)).expect(200);
    await request(app).post(`/api/v1/projects/${project.body.id}/messages`).set(auth(guest.token)).field('text', 'Ciao team').expect(201);
    const history = await request(app).get(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).expect(200);
    expect(history.body.items[0].text).toBe('Ciao team');
  });

  it('validates local covers and attachments and restricts file downloads to members', async () => {
    const owner = await account('owner@example.test');
    const outsider = await account('outsider@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Files' }).expect(201);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    await request(app).post(`/api/v1/projects/${project.body.id}/cover`).set(auth(owner.token)).attach('cover', png, { filename: 'cover.png', contentType: 'image/png' }).expect(200);
    await request(app).post(`/api/v1/projects/${project.body.id}/cover`).set(auth(owner.token)).attach('cover', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' }).expect(422);
    const message = await request(app).post(`/api/v1/projects/${project.body.id}/messages`).set(auth(owner.token)).field('text', 'File allegato').attach('file', Buffer.from('testo locale'), { filename: 'note.txt', contentType: 'text/plain' }).expect(201);
    const attachmentId = message.body.attachments[0].id;
    await request(app).get(`/api/v1/attachments/${attachmentId}/download`).set(auth(outsider.token)).expect(404);
    await request(app).get(`/api/v1/attachments/${attachmentId}/download`).set(auth(owner.token)).expect(200);
    await request(app).delete(`/api/v1/projects/${project.body.id}`).set(auth(owner.token)).expect(204);
  });

  it('revokes invite links and transfers project ownership only after acceptance', async () => {
    const owner = await account('owner@example.test');
    const member = await account('member@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Transfer' }).expect(201);
    const invite = await request(app).post(`/api/v1/projects/${project.body.id}/invites`).set(auth(owner.token)).expect(201);
    const inviteToken = invite.body.link.split('/').pop();
    await request(app).post(`/api/v1/invites/${inviteToken}/accept`).set(auth(member.token)).expect(200);
    const transfer = await request(app).post(`/api/v1/projects/${project.body.id}/transfer`).set(auth(owner.token)).send({ memberId: member.user.id }).expect(201);
    const transferToken = transfer.body.link.split('/').pop();
    await request(app).post(`/api/v1/transfers/${transferToken}/accept`).set(auth(owner.token)).expect(404);
    await request(app).post(`/api/v1/transfers/${transferToken}/accept`).set(auth(member.token)).expect(200);
    const members = await request(app).get(`/api/v1/projects/${project.body.id}/members`).set(auth(member.token)).expect(200);
    expect(members.body.find((row: { id: number }) => row.id === member.user.id).is_owner).toBe(1);
    await request(app).post(`/api/v1/projects/${project.body.id}/leave`).set(auth(owner.token)).expect(204);
    const pendingInvite = await request(app).post(`/api/v1/projects/${project.body.id}/invites`).set(auth(member.token)).expect(201);
    const pendingToken = pendingInvite.body.link.split('/').pop();
    await request(app).post(`/api/v1/projects/${project.body.id}/invites/revoke`).set(auth(member.token)).expect(200);
    await request(app).post(`/api/v1/invites/${pendingToken}/accept`).set(auth((await account('pending@example.test')).token)).expect(404);
  });

  it('keeps archived projects read only and revokes their outstanding invites', async () => {
    const owner = await account('owner@example.test');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Archived', visibility: 'public' }).expect(201);
    const invite = await request(app).post(`/api/v1/projects/${project.body.id}/invites`).set(auth(owner.token)).expect(201);
    const inviteToken = invite.body.link.split('/').pop();
    await request(app).post(`/api/v1/projects/${project.body.id}/archive`).set(auth(owner.token)).expect(200);
    await request(app).post(`/api/v1/invites/${inviteToken}/accept`).set(auth(await account('guest@example.test').then((x) => x.token))).expect(404);
    await request(app).post(`/api/v1/projects/${project.body.id}/tasks`).set(auth(owner.token)).send({ title: 'Bloccato' }).expect(423);
    await request(app).post(`/api/v1/projects/${project.body.id}/restore`).set(auth(owner.token)).expect(200);
    await request(app).post(`/api/v1/projects/${project.body.id}/tasks`).set(auth(owner.token)).send({ title: 'Dopo la riattivazione' }).expect(201);
  });

  it('creates reports and restricts moderation to admins', async () => {
    const owner = await account('owner@example.test');
    const normal = await account('normal@example.test');
    const admin = await account('admin@example.test', 'Admin', 'admin');
    const project = await request(app).post('/api/v1/projects').set(auth(owner.token)).send({ name: 'Public', visibility: 'public' }).expect(201);
    await request(app).post(`/api/v1/projects/${project.body.id}/join`).set(auth(normal.token)).expect(201);
    const report = await request(app).post(`/api/v1/projects/${project.body.id}/reports`).set(auth(normal.token)).send({ category: 'spam' }).expect(201);
    await request(app).get('/api/v1/admin/reports').set(auth(normal.token)).expect(403);
    await request(app).get('/api/v1/admin/reports').set(auth(admin.token)).expect(200);
    await request(app).patch(`/api/v1/admin/reports/${report.body.id}`).set(auth(admin.token)).send({ status: 'accepted', action: 'hide_project' }).expect(200);
    await request(app).get(`/api/v1/projects/${project.body.id}`).expect(404);
    const secondReport = await request(app).post(`/api/v1/projects/${project.body.id}/reports`).set(auth(normal.token)).send({ category: 'other' }).expect(201);
    await request(app).patch(`/api/v1/admin/reports/${secondReport.body.id}`).set(auth(admin.token)).send({ status: 'accepted', action: 'block_reporter' }).expect(200);
    await request(app).get('/api/v1/auth/me').set(auth(normal.token)).expect(401);
    const blocked = await request(app).get('/api/v1/admin/blocked-users').set(auth(admin.token)).expect(200);
    expect(blocked.body.some((row: { id: number }) => row.id === normal.user.id)).toBe(true);
    await request(app).post(`/api/v1/admin/users/${normal.user.id}/unblock`).set(auth(admin.token)).expect(200);
    await request(app).get('/api/v1/auth/me').set(auth(normal.token)).expect(401);
    const relogin = await request(app).post('/api/v1/auth/login').send({ email: normal.user.email, password: 'correct horse battery' }).expect(200);
    await request(app).get('/api/v1/auth/me').set(auth(relogin.body.accessToken)).expect(200);
  });
});
