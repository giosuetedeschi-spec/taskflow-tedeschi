import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { openDatabase } from './db';
import { configureRealtime } from './realtime';

const db = openDatabase();
const io = new Server({
  cors: { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true },
});
const app = createApp(db, io);
const server = createServer(app);
io.attach(server);
configureRealtime(io, db);

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '127.0.0.1', () => console.info(`TaskFlow API listening on http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  io.close(); server.close(); db.close(); process.exit(0);
});
