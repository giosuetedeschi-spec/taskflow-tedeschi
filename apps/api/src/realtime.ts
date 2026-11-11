import type { Server } from 'socket.io';
import { verifyAccessToken } from './auth';
import type { AppDatabase } from './db';

export function configureRealtime(io: Server, db: AppDatabase) {
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
}
