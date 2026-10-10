import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

const reply = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('TaskFlow app flow', () => {
  it('registers a user, creates a project and opens its three-column board', async () => {
    const user = userEvent.setup();
    const owner = { id: 1, display_name: 'Ada Lovelace', email: 'ada@example.test', role: 'user' };
    const project = { id: 7, owner_id: 1, name: 'Progetto demo', description: '', category: 'Altro', technologies: '', visibility: 'private', archived_at: null, hidden_at: null, cover_path: null, role: 'owner' };
    const catalogProject = { ...project, id: 8, owner_id: 2, name: 'Progetto filtrato', category: 'Design', technologies: 'React', visibility: 'public', role: 'visitor' };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/auth/refresh')) return reply({ error: { message: 'Scaduta' } }, 401);
      if (path.endsWith('/auth/register')) return reply({ user: owner, accessToken: 'test.jwt.token' }, 201);
      if (path.endsWith('/api/v1/projects') && init?.method === 'POST') return reply(project, 201);
      if (path.endsWith('/dashboard')) return reply({ createdProjects: [project], joinedProjects: [], assignedTasks: [{ id: 9, project_id: 7, project_name: project.name, title: 'Revisionare il flusso demo', description: '', status: 'todo', priority: 'high', due_date: '2026-10-11' }] });
      if (path.includes('/api/v1/projects?')) return reply({ projects: [project], catalog: [catalogProject] });
      if (path.endsWith('/api/v1/projects')) return reply({ projects: [project], catalog: [] });
      if (path.endsWith('/api/v1/projects/7')) return reply(project);
      if (path.endsWith('/tasks')) return reply([]);
      if (path.endsWith('/members')) return reply([{ id: 1, display_name: 'Ada Lovelace', email: owner.email, is_owner: 1 }]);
      if (path.endsWith('/messages') && init?.method === 'POST') return reply({ id: 10, project_id: 7, user_id: 1, author_name: owner.display_name, text: 'File demo', attachments: [] }, 201);
      if (path.endsWith('/messages')) return reply({ items: [] });
      return reply({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Crea un account' }));
    await user.type(screen.getByLabelText('Nome visualizzato'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), owner.email);
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Registrati' }));
    await user.click(await screen.findByRole('button', { name: '＋ Nuovo progetto' }));
    await user.type(screen.getByLabelText('Nome'), 'Progetto demo');
    await user.click(screen.getByRole('button', { name: 'Salva progetto' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Da fare' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'In corso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completato' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Chat/ }));
    await user.type(screen.getByPlaceholderText('Scrivi un messaggio…'), 'File demo');
    const files = [new File(['primo'], 'primo.txt', { type: 'text/plain' }), new File(['secondo'], 'secondo.txt', { type: 'text/plain' })];
    const fileInput = screen.getByLabelText(/Allega fino a 5 file/);
    await user.upload(fileInput, files);
    expect((fileInput as HTMLInputElement).files).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Invia ↗' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/projects/7/messages'), expect.objectContaining({ method: 'POST', body: expect.any(FormData) })));
    await user.click(screen.getByRole('button', { name: 'Chiudi chat' }));
    await user.click(screen.getByRole('button', { name: 'Progetti' }));
    expect(await screen.findByText('Revisionare il flusso demo')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Filtra catalogo per categoria' }), 'Design');
    await user.type(screen.getByRole('textbox', { name: 'Filtra catalogo per tecnologia' }), 'React');
    await user.type(screen.getByLabelText('Data iniziale catalogo'), '2026-01-01');
    await user.type(screen.getByLabelText('Data finale catalogo'), '2026-12-31');
    await user.click(screen.getByRole('button', { name: 'Filtra' }));
    expect(await screen.findByText('Progetto filtrato')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/projects?category=Design&technology=React&createdFrom=2026-01-01&createdTo=2026-12-31'), expect.any(Object));
  });
});
