import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { verifyAccessToken } from './auth';
import { openDatabase } from './db';

const db = openDatabase();
const io = new Server({
  cors: { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true },
});
const app = createApp(db, io);
const server = createServer(app);
io.attach(server);

io.use((socket, next) => {
  const user = verifyAccessToken(socket.handshake.auth?.token ?? '');
  const current = user && db.query<{ id: number; role: 'user' | 'admin'; token_version: number }, any[]>('SELECT id, role, token_version FROM users WHERE id = ? AND blocked_at IS NULL').get(user.id);
  if (!user || !current || current.token_version !== user.token_version) return next(new Error('unauthorized'));
  user.role = current.role;
  socket.data.user = user;
  next();
});
io.on('connection', (socket) => {
  const user = socket.data.user as { id: number; role: string };
  socket.join(`user:${user.id}`);
  if (user.role === 'admin') socket.join('admins');
  socket.on('project:join', (value: unknown) => {
    const projectId = Number(value);
    const allowed = Number.isInteger(projectId) && db.query('SELECT 1 FROM memberships m JOIN projects p ON p.id = m.project_id WHERE m.project_id = ? AND m.user_id = ? AND m.left_at IS NULL AND p.archived_at IS NULL AND p.hidden_at IS NULL').get(projectId, user.id);
    if (allowed) socket.join(`project:${projectId}`);
  });
  socket.on('project:leave', (value: unknown) => socket.leave(`project:${Number(value)}`));
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '127.0.0.1', () => console.info(`TaskFlow API listening on http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  io.close(); server.close(); db.close(); process.exit(0);
});
