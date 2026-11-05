import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { createApp } from './app';
import { openDatabase } from './db';
import { configureRealtime } from './realtime';

const db = openDatabase();
const publicOrigin = process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173';
const io = new Server({
  cors: { origin: ['http://localhost:5173', 'http://127.0.0.1:5173', publicOrigin], credentials: true },
});
const app = createApp(db, io);
const webRoot = process.env.WEB_DIST_DIR ?? join(import.meta.dir, '../../../apps/web/dist');
if (process.env.NODE_ENV === 'production' && !existsSync(join(webRoot, 'index.html'))) {
  throw new Error(`Production frontend build not found at ${webRoot}. Run bun run build first.`);
}
if (existsSync(join(webRoot, 'index.html'))) {
  app.use(express.static(webRoot, { index: false, fallthrough: true }));
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/') && !req.path.startsWith('/socket.io')) {
      res.sendFile(join(webRoot, 'index.html'));
    } else next();
  });
}
const server = createServer(app);
io.attach(server);
configureRealtime(io, db);

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '127.0.0.1', () => console.info(`TaskFlow API listening on http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  io.close(); server.close(); db.close(); process.exit(0);
});
