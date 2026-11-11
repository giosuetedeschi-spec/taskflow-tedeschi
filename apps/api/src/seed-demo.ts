import { openDatabase } from './db';

const demoAccounts = [
  { name: 'Ada Demo', email: 'ada.demo@example.test', password: 'TaskflowDemo-Ada-2026', role: 'user' },
  { name: 'Luca Demo', email: 'luca.demo@example.test', password: 'TaskflowDemo-Luca-2026', role: 'user' },
  { name: 'Sara Admin Demo', email: 'admin.demo@example.test', password: 'TaskflowDemo-Admin-2026', role: 'admin' },
] as const;

const db = openDatabase();
try {
  const hashes = await Promise.all(demoAccounts.map((account) => Bun.password.hash(account.password)));
  const seed = db.transaction(() => {
    const users = demoAccounts.map((account, index) => {
      const found = db.query<{ id: number }, any[]>('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(account.email);
      if (found) {
        db.query('UPDATE users SET display_name = ?, password_hash = ?, role = ?, blocked_at = NULL WHERE id = ?').run(account.name, hashes[index], account.role, found.id);
        return found.id;
      }
      const inserted = db.query('INSERT INTO users (display_name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(account.name, account.email, hashes[index], account.role);
      return Number(inserted.lastInsertRowid);
    });
    const [adaId, lucaId] = users;
    const project = (ownerId: number, name: string, description: string, category: string, technologies: string, visibility: 'public' | 'private') => {
      const found = db.query<{ id: number }, any[]>('SELECT id FROM projects WHERE owner_id = ? AND name = ?').get(ownerId, name);
      if (found) return found.id;
      const inserted = db.query('INSERT INTO projects (owner_id, name, description, category, technologies, visibility) VALUES (?, ?, ?, ?, ?, ?)').run(ownerId, name, description, category, technologies, visibility);
      const id = Number(inserted.lastInsertRowid);
      db.query('INSERT INTO memberships (project_id, user_id) VALUES (?, ?)').run(id, ownerId);
      return id;
    };
    const teamId = project(adaId, 'TaskFlow sprint demo', 'Board privata con dati inventati per provare TaskFlow.', 'Sviluppo', 'Bun, React, SQLite', 'private');
    const publicId = project(lucaId, 'Ricerca UX accessibile', 'Progetto pubblico di esempio per provare il catalogo e i filtri.', 'Design', 'Figma, React', 'public');
    db.query('INSERT OR IGNORE INTO memberships (project_id, user_id) VALUES (?, ?)').run(teamId, adaId);
    db.query('INSERT OR IGNORE INTO memberships (project_id, user_id) VALUES (?, ?)').run(publicId, lucaId);
    db.query('INSERT OR IGNORE INTO memberships (project_id, user_id) VALUES (?, ?)').run(teamId, lucaId);
    const today = new Date().toISOString().slice(0, 10);
    const dueSoon = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    const addTask = (creatorId: number, assigneeId: number | null, title: string, description: string, status: 'todo' | 'doing' | 'done', priority: 'low' | 'medium' | 'high', dueDate: string | null) => {
      if (db.query('SELECT 1 FROM tasks WHERE project_id = ? AND title = ?').get(teamId, title)) return;
      db.query('INSERT INTO tasks (project_id, creator_id, assignee_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(teamId, creatorId, assigneeId, title, description, status, priority, dueDate);
    };
    addTask(lucaId, adaId, '[Demo] Verificare il flusso di registrazione', 'Controlla login, dashboard e filtri del catalogo.', 'todo', 'high', today);
    addTask(adaId, adaId, '[Demo] Preparare la board del team', 'Task inventato assegnato ad Ada per la dashboard personale.', 'doing', 'medium', dueSoon);
    addTask(adaId, lucaId, '[Demo] Rivedere gli allegati della chat', 'Prova a inviare più file ammessi in un solo messaggio.', 'todo', 'low', null);
    addTask(adaId, adaId, '[Demo] Chiudere il prototipo', 'Task completato di esempio.', 'done', 'low', null);
    if (!db.query('SELECT 1 FROM messages WHERE project_id = ?').get(teamId)) {
      db.query('INSERT INTO messages (project_id, user_id, text) VALUES (?, ?, ?)').run(teamId, lucaId, 'Ciao Ada! Questo è un messaggio demo per provare la chat.');
    }
    return { users, teamId, publicId };
  });
  const { users, teamId, publicId } = seed();
  console.info('Dati demo locali pronti. Tutti gli account usano password fittizie:');
  demoAccounts.forEach((account) => console.info(`  ${account.role}: ${account.email} / ${account.password}`));
  console.info(`  Board privata: ${teamId} · progetto pubblico per i filtri: ${publicId}`);
} finally { db.close(); }
