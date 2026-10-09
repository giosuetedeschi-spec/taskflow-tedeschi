import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { openDatabase } from './db';

const input = createInterface({ input: stdin, output: stdout });
try {
  const displayName = (await input.question('Nome admin: ')).trim();
  const email = (await input.question('Email admin: ')).trim().toLowerCase();
  const password = await input.question('Password admin (almeno 10 caratteri): ');
  if (displayName.length < 2 || !email.includes('@') || password.length < 10) throw new Error('Dati non validi. Nessun account creato.');
  const db = openDatabase();
  db.query("INSERT INTO users (display_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(displayName, email, await Bun.password.hash(password));
  db.close();
  console.info('Account amministratore creato.');
} finally { input.close(); }
