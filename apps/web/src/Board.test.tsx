import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

afterEach(cleanup);

describe('TaskFlow board', () => {
  it('shows exactly three task columns and their cards', () => {
    render(<Board tasks={[{ id: 1, title: 'Preparare demo', description: '', status: 'doing', priority: 'high' }]} onMove={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Da fare' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In corso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completato' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparare demo' })).toBeInTheDocument();
  });

  it('moves a task to the next state and opens its editor', async () => {
    const user = userEvent.setup();
    const task = { id: 21, title: 'Rivedere i permessi', description: 'Controllo accessi', status: 'todo' as const, priority: 'high' as const };
    const onMove = vi.fn();
    const onOpen = vi.fn();
    render(<Board tasks={[task]} onMove={onMove} onOpen={onOpen} />);

    await user.click(screen.getByText('→ In corso'));
    expect(onMove).toHaveBeenCalledWith(task.id, 'doing');
    await user.click(screen.getByRole('button', { name: task.title }));
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it('makes archived boards read-only', () => {
    const task = { id: 22, title: 'Task archiviato', description: '', status: 'doing' as const, priority: 'medium' as const };
    render(<Board tasks={[task]} onMove={vi.fn()} onOpen={vi.fn()} readOnly />);

    expect(document.querySelectorAll('.column-header .icon-button')).toHaveLength(0);
    expect(document.querySelectorAll('.move-button')).toHaveLength(0);
    expect(screen.getByRole('article')).toHaveAttribute('draggable', 'false');
    expect(screen.getByRole('button', { name: task.title })).toBeInTheDocument();
  });
});
