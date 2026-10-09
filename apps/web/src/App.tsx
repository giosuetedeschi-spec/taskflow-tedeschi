import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { TaskPriority, TaskStatus } from '@taskflow/contracts';
import { Board, type BoardTask } from './Board';

type User = { id: number; display_name: string; email: string; role: 'user' | 'admin' };
type Project = { id: number; owner_id: number; name: string; description: string; category: string; technologies: string; visibility: 'public' | 'private'; archived_at: string | null; hidden_at: string | null; cover_path: string | null; owner_name?: string; is_owner?: number; role?: string };
type Member = { id: number; display_name: string; email: string; is_owner: number };
type ChatMessage = { id: number; user_id: number; author_name: string; text: string; created_at: string; attachments: { id: number; original_name: string; mime_type: string; size: number }[] };
type Report = { id: number; project_id: number; reporter_id: number; category: string; details: string; status: string; project_name: string; reporter_name: string };
type HiddenProject = { id: number; name: string; owner_id: number };
type BlockedUser = { id: number; display_name: string; email: string; blocked_at: string };

const apiRoot = '/api/v1';
type ProjectInput = { name: string; description: string; category: string; technologies: string; visibility: 'private' | 'public' };
const emptyProject: ProjectInput = { name: '', description: '', category: 'Altro', technologies: '', visibility: 'private' };
const statusNames: Record<TaskStatus, string> = { todo: 'Da fare', doing: 'In corso', done: 'Completato' };

async function readResponse<T>(response: Response): Promise<T> {
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Richiesta non riuscita. Riprova.');
  return payload as T;
}

function CoverImage({ project, token }: { project: Project; token: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!project.cover_path) { setSrc(''); return; }
    let url = '';
    fetch(`${apiRoot}/projects/${project.id}/cover`, { headers: { Authorization: `Bearer ${token}` } }).then(async (res) => {
      if (res.ok) { url = URL.createObjectURL(await res.blob()); setSrc(url); }
    }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [project.cover_path, project.id, token]);
  return src ? <img className="project-cover" src={src} alt="" /> : <div className="project-cover-placeholder">{project.name.slice(0, 1).toUpperCase()}</div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(() => window.location.pathname.startsWith('/reset/') ? 'reset' : 'login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [catalog, setCatalog] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [hiddenProjects, setHiddenProjects] = useState<HiddenProject[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [transferMember, setTransferMember] = useState('');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [modal, setModal] = useState<'project' | 'task' | 'chat' | 'members' | 'admin' | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectInput>(emptyProject);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editingTask, setEditingTask] = useState<BoardTask | null>(null);
  const [inviteToken] = useState(() => window.location.pathname.match(/^\/invite\/([^/]+)/)?.[1] ?? '');
  const [transferToken] = useState(() => window.location.pathname.match(/^\/transfer\/([^/]+)/)?.[1] ?? '');

  const call = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return readResponse<T>(await fetch(`${apiRoot}${path}`, { ...init, headers, credentials: 'include' }));
  }, [token]);

  const acceptInvite = useCallback(async (invite: string, currentToken: string) => {
    try {
      const data = await readResponse<{ projectId: number }>(await fetch(`${apiRoot}/invites/${invite}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` }, credentials: 'include' }));
      window.history.replaceState({}, '', `/projects/${data.projectId}`);
      setNotice('Invito accettato: ora fai parte del progetto.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Invito non valido.'); }
  }, []);

  const acceptTransfer = useCallback(async (transfer: string, currentToken: string) => {
    try {
      const data = await readResponse<{ projectId: number }>(await fetch(`${apiRoot}/transfers/${transfer}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` }, credentials: 'include' }));
      window.history.replaceState({}, '', `/projects/${data.projectId}`);
      setNotice('Trasferimento accettato: ora sei il proprietario del progetto.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Trasferimento non valido.'); }
  }, []);

  useEffect(() => {
    fetch(`${apiRoot}/auth/refresh`, { method: 'POST', credentials: 'include' }).then((r) => readResponse<{ user: User; accessToken: string }>(r)).then((data) => {
      setUser(data.user); setToken(data.accessToken); if (inviteToken) void acceptInvite(inviteToken, data.accessToken);
      if (transferToken) void acceptTransfer(transferToken, data.accessToken);
    }).catch(() => {}).finally(() => setReady(true));
  }, [acceptInvite, inviteToken, transferToken]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    try { const data = await call<{ projects: Project[]; catalog: Project[] }>('/projects'); setProjects(data.projects); setCatalog(data.catalog); }
    catch (e) { setError(e instanceof Error ? e.message : 'Progetti non disponibili.'); }
  }, [call, user]);
  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const openProject = useCallback(async (project: Project) => {
    setError(''); setActive(project); setModal(null);
    window.history.pushState({}, '', `/projects/${project.id}`);
    try {
      const [details, taskRows, memberRows] = await Promise.all([
        call<Project>(`/projects/${project.id}`), call<BoardTask[]>(`/projects/${project.id}/tasks`), call<Member[]>(`/projects/${project.id}/members`),
      ]);
      setActive(details); setTasks(taskRows); setMembers(memberRows);
      if (details.role === 'member' || details.role === 'owner') {
        const chat = await call<{ items: ChatMessage[] }>(`/projects/${project.id}/messages`); setMessages(chat.items);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Progetto non disponibile.'); }
  }, [call]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/projects\/(\d+)/);
    if (match && projects.length && !active) { const project = projects.find((p) => p.id === Number(match[1])); if (project) void openProject(project); }
  }, [active, openProject, projects]);

  useEffect(() => {
    if (!token || !active) return;
    const socket: Socket = io({ auth: { token } });
    socket.on('connect', () => socket.emit('project:join', active.id));
    const syncTask = (task: BoardTask) => setTasks((old) => old.some((row) => row.id === task.id) ? old.map((row) => row.id === task.id ? task : row) : [task, ...old]);
    socket.on('task.created', (e) => syncTask(e.data));
    socket.on('task.updated', (e) => syncTask(e.data));
    socket.on('task.moved', (e) => syncTask(e.data));
    socket.on('task.assigned', (e) => syncTask(e.data));
    socket.on('chat.message.created', (e) => setMessages((old) => old.some((m) => m.id === e.data.id) ? old : [...old, e.data]));
    socket.on('member.joined', () => void call<Member[]>(`/projects/${active.id}/members`).then(setMembers));
    socket.on('member.left', () => void call<Member[]>(`/projects/${active.id}/members`).then(setMembers));
    socket.on('project.owner.transferred', (e) => { setActive((p) => p ? { ...p, owner_id: e.data.owner.id } : p); void call<Member[]>(`/projects/${active.id}/members`).then(setMembers); });
    return () => { socket.emit('project:leave', active.id); socket.disconnect(); };
  }, [active, call, token]);

  const filteredTasks = useMemo(() => tasks.filter((task) => task.title.toLowerCase().includes(search.toLowerCase()) && (priorityFilter === 'all' || task.priority === priorityFilter)), [priorityFilter, search, tasks]);

  async function finishAuth(data: { user: User; accessToken: string }) {
    setUser(data.user); setToken(data.accessToken); setError(''); setNotice('Accesso effettuato.');
    if (inviteToken) await acceptInvite(inviteToken, data.accessToken);
    if (transferToken) await acceptTransfer(transferToken, data.accessToken);
  }
  async function logout() {
    try { await call('/auth/logout', { method: 'POST' }); } catch {}
    setUser(null); setToken(''); setActive(null); setProjects([]); setCatalog([]); window.history.replaceState({}, '', '/');
  }
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      if (authMode === 'forgot') { const data = await call<{ message: string }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email: form.get('email') }) }); setNotice(data.message); return; }
      if (authMode === 'reset') { const resetToken = window.location.pathname.split('/').pop(); const data = await call<{ message: string }>(`/auth/reset/${resetToken}`, { method: 'POST', body: JSON.stringify({ password: form.get('password') }) }); setNotice(data.message); setAuthMode('login'); return; }
      const path = authMode === 'register' ? '/auth/register' : '/auth/login';
      const body = { email: form.get('email'), password: form.get('password'), ...(authMode === 'register' ? { displayName: form.get('displayName') } : {}) };
      await finishAuth(await call(path, { method: 'POST', body: JSON.stringify(body) }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Non è stato possibile accedere.'); }
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try {
      const projectBody = active?.archived_at ? { description: projectForm.description } : projectForm;
      const saved = await call<Project>(active ? `/projects/${active.id}` : '/projects', { method: active ? 'PATCH' : 'POST', body: JSON.stringify(projectBody) });
      if (coverFile) { const form = new FormData(); form.set('cover', coverFile); await call(`/projects/${saved.id}/cover`, { method: 'POST', body: form }); }
      setProjectForm(emptyProject); setCoverFile(null); setModal(null); await loadProjects(); await openProject(saved);
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio progetto non riuscito.'); }
  }
  async function createInvite() {
    if (!active) return;
    const email = window.prompt('Invia l’invito a un account email specifico? Lascia vuoto per creare un link condivisibile.', '')?.trim();
    if (email === undefined) return;
    try { const data = await call<{ link: string; email: string | null }>(`/projects/${active.id}/invites`, { method: 'POST', ...(email ? { body: JSON.stringify({ email }) } : {}) }); await navigator.clipboard.writeText(data.link); setNotice(email ? `Invito per ${email}: link copiato. Il mock email è visibile nel terminale API.` : 'Link invito copiato negli appunti.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Invito non riuscito.'); }
  }
  async function revokeInvites() {
    if (!active) return;
    try { await call(`/projects/${active.id}/invites/revoke`, { method: 'POST' }); setNotice('Tutti i link d’invito attivi sono stati revocati.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Revoca inviti non riuscita.'); }
  }
  async function createTransfer() {
    if (!active || !transferMember) return;
    try { const data = await call<{ link: string }>(`/projects/${active.id}/transfer`, { method: 'POST', body: JSON.stringify({ memberId: Number(transferMember) }) }); await navigator.clipboard.writeText(data.link); setNotice('Link di trasferimento copiato. Il destinatario deve accettarlo.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Trasferimento non riuscito.'); }
  }
  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active || !editingTask) return;
    const form = new FormData(event.currentTarget);
    const body = { title: form.get('title'), description: form.get('description'), priority: form.get('priority') as TaskPriority, dueDate: form.get('dueDate') || null, assigneeId: form.get('assigneeId') ? Number(form.get('assigneeId')) : null, status: form.get('status') as TaskStatus };
    try {
      if (editingTask.id) { const saved = await call<BoardTask>(`/tasks/${editingTask.id}`, { method: 'PATCH', body: JSON.stringify(body) }); setTasks((old) => old.map((t) => t.id === saved.id ? saved : t)); }
      else { const saved = await call<BoardTask>(`/projects/${active.id}/tasks`, { method: 'POST', body: JSON.stringify(body) }); setTasks((old) => [saved, ...old]); }
      setModal(null); setEditingTask(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio task non riuscito.'); }
  }
  async function moveTask(id: number, status: TaskStatus) {
    try { const saved = await call<BoardTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setTasks((old) => old.map((task) => task.id === id ? saved : task)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Spostamento non riuscito.'); }
  }
  async function loadMessages() {
    if (!active) return;
    try { const data = await call<{ items: ChatMessage[] }>(`/projects/${active.id}/messages`); setMessages(data.items); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chat non disponibile.'); }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return;
    const form = new FormData(event.currentTarget); const text = String(form.get('text') ?? '');
    try { const saved = await call<ChatMessage>(`/projects/${active.id}/messages`, { method: 'POST', body: form }); setMessages((old) => [...old, saved]); event.currentTarget.reset(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Invio del messaggio non riuscito.'); }
  }
  async function downloadAttachment(id: number, name: string) {
    try { const response = await fetch(`${apiRoot}/attachments/${id}/download`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Download non consentito.'); const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
    catch (e) { setError(e instanceof Error ? e.message : 'Download non riuscito.'); }
  }
  async function archiveProject() {
    if (!active) return;
    try { await call(`/projects/${active.id}/archive`, { method: 'POST' }); setActive({ ...active, archived_at: new Date().toISOString() }); await loadProjects(); setNotice('Progetto archiviato.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Archiviazione non riuscita.'); }
  }
  async function restoreProject() {
    if (!active) return;
    try { const saved = await call<Project>(`/projects/${active.id}/restore`, { method: 'POST' }); setActive(saved); await loadProjects(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Riattivazione non riuscita.'); }
  }
  async function deleteProject() {
    if (!active || !window.confirm(`Eliminare definitivamente “${active.name}”?`)) return;
    try { await call(`/projects/${active.id}`, { method: 'DELETE' }); setActive(null); setModal(null); await loadProjects(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Eliminazione non riuscita.'); }
  }
  async function reportProject() {
    if (!active) return;
    const category = window.prompt('Motivo: spam, inappropriate, illegal, ip, misleading, other', 'other'); if (!category) return;
    try { await call(`/projects/${active.id}/reports`, { method: 'POST', body: JSON.stringify({ category }) }); setNotice('Segnalazione inviata agli amministratori.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Segnalazione non riuscita.'); }
  }
  async function openAdmin() {
    try {
      const [pending, hidden, blocked] = await Promise.all([call<Report[]>('/admin/reports'), call<HiddenProject[]>('/admin/hidden-projects'), call<BlockedUser[]>('/admin/blocked-users')]);
      setReports(pending); setHiddenProjects(hidden); setBlockedUsers(blocked); setModal('admin');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Area admin non disponibile.'); }
  }
  async function reviewReport(report: Report, status: 'accepted' | 'rejected', action: string | null) {
    try { await call(`/admin/reports/${report.id}`, { method: 'PATCH', body: JSON.stringify({ status, action }) }); setReports((old) => old.filter((item) => item.id !== report.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Revisione non riuscita.'); }
  }
  async function restoreHiddenProject(project: HiddenProject) {
    try { await call(`/admin/projects/${project.id}/restore`, { method: 'POST' }); setHiddenProjects((old) => old.filter((item) => item.id !== project.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ripristino progetto non riuscito.'); }
  }
  async function unblockAccount(account: BlockedUser) {
    try { await call(`/admin/users/${account.id}/unblock`, { method: 'POST' }); setBlockedUsers((old) => old.filter((item) => item.id !== account.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sblocco account non riuscito.'); }
  }

  if (!ready) return <div className="loading">TaskFlow</div>;
  if (!user) return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">T</div><h1>{authMode === 'register' ? 'Crea il tuo account' : authMode === 'forgot' ? 'Recupera la password' : authMode === 'reset' ? 'Scegli una nuova password' : 'Accedi a TaskFlow'}</h1><p className="muted">Progetti, attività e conversazioni in un unico posto.</p>
    <form onSubmit={submitAuth} className="form-stack">
      {authMode === 'register' && <label>Nome visualizzato<input name="displayName" required minLength={2} maxLength={60} autoComplete="name" /></label>}
      {authMode !== 'reset' && <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>}
      {authMode !== 'forgot' && <label>Password<input name="password" type="password" required minLength={10} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} /></label>}
      <button className="primary-button">{authMode === 'register' ? 'Registrati' : authMode === 'forgot' ? 'Invia link' : authMode === 'reset' ? 'Aggiorna password' : 'Accedi'}</button>
    </form>
    <div className="auth-links">{authMode === 'login' && <button onClick={() => setAuthMode('forgot')}>Password dimenticata?</button>}{authMode !== 'login' && <button onClick={() => setAuthMode('login')}>Torna all’accesso</button>}<button onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Hai già un account? Accedi' : 'Crea un account'}</button></div>
    {(error || notice) && <p className={error ? 'alert error' : 'alert'} role="status">{error || notice}</p>}
  </div><footer>TaskFlow • Workspace collaborativo locale</footer></main>;

  return <div className="app-shell">
    <header className="topbar"><button className="menu-button" aria-label="Apri elenco progetti" onClick={() => { setActive(null); window.history.pushState({}, '', '/'); }}>☰</button><div className="brand-mark small">T</div><div className="breadcrumbs"><button onClick={() => { setActive(null); window.history.pushState({}, '', '/'); }}>TaskFlow</button><span>/</span><button onClick={() => { setActive(null); }}>Progetti</button>{active && <><span>/</span><strong>{active.name}{active.visibility === 'private' ? ' 🔒' : ''}</strong></>}</div><div className="topbar-spacer" /><label className="global-search"><span>⌕</span><input aria-label="Cerca task" placeholder="Cerca nella board" value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>/</kbd></label><button className="avatar" title={user.email}>{user.display_name.slice(0, 1).toUpperCase()}</button><button className="text-button" onClick={() => void logout()}>Esci</button></header>
    {active ? <>
      <div className="project-titlebar"><div><div className="eyebrow">Progetto {active.visibility === 'private' ? 'privato' : 'pubblico'}{active.archived_at && ' · archiviato'}</div><h1>{active.name}</h1><p>{active.description || 'Aggiungi una descrizione al progetto.'}</p></div><div className="title-actions"><button className="outline-button" onClick={() => setModal('chat')}>☷ Chat <span className="count">{messages.length}</span></button><button className="outline-button" onClick={() => setModal('members')}>♙ Membri <span className="count">{members.length}</span></button><button className="primary-button compact" onClick={() => { setEditingTask({ id: 0, title: '', description: '', status: 'todo', priority: 'medium' }); setModal('task'); }} disabled={!!active.archived_at}>＋ Nuovo task</button></div></div>
      <nav className="view-tabs"><button className="active-tab">▦ Board</button><button onClick={() => setModal('chat')}>☷ Conversazione</button><div className="tab-spacer" /><select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filtra priorità"><option value="all">Tutte le priorità</option><option value="high">Alta priorità</option><option value="medium">Media priorità</option><option value="low">Bassa priorità</option></select>{active.owner_id !== user.id && <button onClick={() => void reportProject()}>Segnala progetto</button>}{active.owner_id === user.id && <button onClick={() => { setProjectForm({ name: active.name, description: active.description, category: active.category, technologies: active.technologies, visibility: active.visibility }); setModal('project'); }}>Modifica progetto</button>}</nav>
      <main className="board-page"><div className="board-toolbar"><div className="filter-input">⌕ <input aria-label="Filtra task" placeholder="Filtra per parola chiave" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="toolbar-actions">{active.owner_id === user.id && <><button className="icon-button" title="Copia link invito" onClick={() => void createInvite()}>♧</button>{active.archived_at ? <button className="outline-button" onClick={() => void restoreProject()}>Riattiva</button> : <button className="outline-button" onClick={() => void archiveProject()}>Archivia</button>}<button className="icon-button danger-text" title="Elimina progetto" onClick={() => void deleteProject()}>⋯</button></>}</div></div>
        {notice && <div className="notice-banner" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}{error && <div className="notice-banner error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
        <Board tasks={filteredTasks} onMove={(id, status) => void moveTask(id, status)} onOpen={(task) => { setEditingTask(task); setModal('task'); }} readOnly={!!active.archived_at} />
      </main>
    </> : <main className="home-page">
      <div className="home-heading"><div><div className="eyebrow">La tua area di lavoro</div><h1>Progetti</h1><p className="muted">Ciao {user.display_name}, ecco cosa succede nei tuoi progetti.</p></div><button className="primary-button" onClick={() => { setProjectForm(emptyProject); setCoverFile(null); setModal('project'); }}>＋ Nuovo progetto</button></div>
      {error && <div className="notice-banner error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}{notice && <div className="notice-banner">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <section className="project-section"><h2>I tuoi progetti <span className="count">{projects.length}</span></h2>{projects.length ? <div className="project-grid">{projects.map((project) => <button className="project-card" key={project.id} onClick={() => void openProject(project)}><CoverImage project={project} token={token} /><span className="project-card-copy"><strong>{project.name}</strong><span>{project.description || 'Nessuna descrizione'}</span><small>{project.visibility === 'private' ? '🔒 Privato' : '◎ Pubblico'}{project.archived_at ? ' · Archiviato' : ''}</small></span></button>)}</div> : <div className="empty-home"><div className="empty-icon">▦</div><strong>Ancora nessun progetto</strong><span>Crea il primo workspace del tuo team.</span><button className="outline-button" onClick={() => { setProjectForm(emptyProject); setModal('project'); }}>Crea progetto</button></div>}</section>
      <section className="project-section"><h2>Esplora progetti pubblici <span className="count">{catalog.length}</span></h2>{catalog.length ? <div className="project-grid">{catalog.map((project) => <article className="project-card public-card" key={project.id}><CoverImage project={project} token={token} /><span className="project-card-copy"><strong>{project.name}</strong><span>{project.description || 'Nessuna descrizione'}</span><small>{project.category} · {project.owner_name}</small><button className="outline-button" onClick={async () => { try { await call(`/projects/${project.id}/join`, { method: 'POST' }); await loadProjects(); setNotice(`Ti sei unito a ${project.name}.`); } catch (e) { setError(e instanceof Error ? e.message : 'Iscrizione non riuscita.'); } }}>Unisciti</button></span></article>)}</div> : <div className="empty-inline">Nessun progetto pubblico disponibile.</div>}</section>
      {user.role === 'admin' && <button className="outline-button" onClick={() => void openAdmin()}>Area amministrazione</button>}
    </main>}

    {modal === 'project' && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="modal-card"><header><div><div className="eyebrow">Workspace</div><h2>{active ? 'Modifica progetto' : 'Crea progetto'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Chiudi">×</button></header><form className="form-stack" onSubmit={submitProject}>
      <label>Nome<input required minLength={2} maxLength={100} value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></label><label>Descrizione<textarea maxLength={2000} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></label><div className="form-row"><label>Categoria<input maxLength={60} value={projectForm.category} onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })} /></label><label>Tecnologie<input maxLength={200} placeholder="React, SQLite…" value={projectForm.technologies} onChange={(e) => setProjectForm({ ...projectForm, technologies: e.target.value })} /></label></div><label>Visibilità<select value={projectForm.visibility} onChange={(e) => setProjectForm({ ...projectForm, visibility: e.target.value as 'public' | 'private' })}><option value="private">Privato</option><option value="public">Pubblico</option></select></label><label>Copertina PNG/JPG, max 5 MiB<input type="file" accept="image/png,image/jpeg" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} /></label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setModal(null)}>Annulla</button><button className="primary-button">Salva progetto</button></div></form></section></div>}

    {modal === 'task' && editingTask && <div className="modal-backdrop"><section className="modal-card"><header><div><div className="eyebrow">Task</div><h2>{editingTask.id ? 'Modifica attività' : 'Nuova attività'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Chiudi">×</button></header><form className="form-stack" onSubmit={saveTask}><label>Titolo<input name="title" required maxLength={160} defaultValue={editingTask.title} /></label><label>Descrizione<textarea name="description" maxLength={4000} defaultValue={editingTask.description} /></label><div className="form-row"><label>Stato<select name="status" defaultValue={editingTask.status}>{Object.entries(statusNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>Priorità<select name="priority" defaultValue={editingTask.priority}><option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option></select></label></div><div className="form-row"><label>Scadenza<input name="dueDate" type="date" defaultValue={editingTask.due_date ?? ''} /></label><label>Assegnatario<select name="assigneeId" defaultValue=""><option value="">Nessuno</option>{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label></div><div className="modal-actions">{editingTask.id && ((editingTask as BoardTask & { creator_id?: number }).creator_id === user.id || active?.owner_id === user.id) && <button type="button" className="danger-button" onClick={async () => { try { await call(`/tasks/${editingTask.id}`, { method: 'DELETE' }); setTasks((old) => old.filter((task) => task.id !== editingTask.id)); setModal(null); } catch (e) { setError(e instanceof Error ? e.message : 'Eliminazione non riuscita.'); } }}>Elimina</button>}<span className="tab-spacer" /><button type="button" className="outline-button" onClick={() => setModal(null)}>Annulla</button><button className="primary-button">Salva task</button></div></form></section></div>}

    {modal === 'chat' && <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><aside className="chat-drawer"><header><div><div className="eyebrow">Progetto</div><h2>Conversazione</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Chiudi chat">×</button></header><button className="subtle-button" onClick={() => void loadMessages()}>↻ Ricarica cronologia</button><div className="chat-messages">{messages.map((message) => <article className="chat-message" key={message.id}><div className="chat-avatar">{message.author_name.slice(0, 1)}</div><div><div className="chat-meta"><strong>{message.author_name}</strong><time>{new Date(message.created_at).toLocaleString('it-IT')}</time></div><p>{message.text}</p>{message.attachments.map((file) => <button className="attachment" key={file.id} onClick={() => void downloadAttachment(file.id, file.original_name)}>↧ {file.original_name} <small>{Math.ceil(file.size / 1024)} KB</small></button>)}</div></article>)}{!messages.length && <div className="empty-inline">La conversazione inizia qui.</div>}</div><form className="chat-compose" onSubmit={sendMessage}><textarea name="text" required maxLength={5000} placeholder="Scrivi un messaggio…" /><div><label className="file-label">＋ Allegato<input name="file" type="file" accept=".txt,.png,.jpg,.pdf" /></label><button className="primary-button compact" disabled={!!active?.archived_at}>Invia ↗</button></div></form></aside></div>}

    {modal === 'members' && <div className="modal-backdrop"><section className="modal-card"><header><div><div className="eyebrow">Accesso al progetto</div><h2>Membri e inviti</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Chiudi">×</button></header><div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><div className="avatar">{member.display_name.slice(0, 1)}</div><span><strong>{member.display_name}</strong><small>{member.email}</small></span>{member.is_owner ? <span className="pill">Proprietario</span> : active?.owner_id === user.id && <button className="text-button danger-text" onClick={async () => { try { await call(`/projects/${active.id}/members/${member.id}`, { method: 'DELETE' }); setMembers((old) => old.filter((m) => m.id !== member.id)); } catch (e) { setError(e instanceof Error ? e.message : 'Rimozione non riuscita.'); } }}>Rimuovi</button>}</div>)}</div>{active?.owner_id === user.id && <><button className="primary-button full-width" onClick={() => void createInvite()}>♧ Crea link di invito</button><button className="outline-button full-width" onClick={() => void revokeInvites()}>Revoca link attivi</button><div className="form-row transfer-row"><select aria-label="Nuovo proprietario" value={transferMember} onChange={(e) => setTransferMember(e.target.value)}><option value="">Scegli un membro</option>{members.filter((member) => member.id !== user.id).map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}</select><button className="outline-button" disabled={!transferMember} onClick={() => void createTransfer()}>Proponi trasferimento</button></div></>}{active?.owner_id !== user.id && <button className="outline-button full-width" onClick={async () => { try { await call(`/projects/${active?.id}/leave`, { method: 'POST' }); setModal(null); setActive(null); await loadProjects(); } catch (e) { setError(e instanceof Error ? e.message : 'Uscita non riuscita.'); } }}>Lascia il progetto</button>}</section></div>}

    {modal === 'admin' && <div className="modal-backdrop"><section className="modal-card wide-modal"><header><div><div className="eyebrow">Moderazione</div><h2>Console amministratore</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Chiudi">×</button></header><h3 className="admin-section-title">Segnalazioni in attesa <span className="count">{reports.length}</span></h3>{reports.length ? <div className="report-list">{reports.map((report) => <article className="report-card" key={report.id}><strong>{report.project_name}</strong><p>{report.category} · Segnalato da {report.reporter_name}</p><p>{report.details || 'Nessun dettaglio aggiuntivo.'}</p><div className="modal-actions"><button className="outline-button" onClick={() => void reviewReport(report, 'rejected', null)}>Respingi</button><button className="outline-button" onClick={() => void reviewReport(report, 'accepted', 'hide_project')}>Accogli e nascondi progetto</button><button className="danger-button" onClick={() => void reviewReport(report, 'accepted', 'block_reporter')}>Accogli e blocca utente</button></div></article>)}</div> : <div className="empty-inline">Nessuna segnalazione in attesa.</div>}<h3 className="admin-section-title">Progetti nascosti <span className="count">{hiddenProjects.length}</span></h3>{hiddenProjects.map((project) => <div className="admin-row" key={project.id}><strong>{project.name}</strong><button className="outline-button" onClick={() => void restoreHiddenProject(project)}>Ripristina</button></div>)}{!hiddenProjects.length && <div className="empty-inline">Nessun progetto nascosto.</div>}<h3 className="admin-section-title">Account bloccati <span className="count">{blockedUsers.length}</span></h3>{blockedUsers.map((account) => <div className="admin-row" key={account.id}><span><strong>{account.display_name}</strong><small>{account.email}</small></span><button className="outline-button" onClick={() => void unblockAccount(account)}>Sblocca</button></div>)}{!blockedUsers.length && <div className="empty-inline">Nessun account bloccato.</div>}</section></div>}
    <footer className="app-footer">TaskFlow · Dati salvati localmente {user.role === 'admin' && !active && <button onClick={() => void openAdmin()}>Moderazione</button>}</footer>
  </div>;
}
