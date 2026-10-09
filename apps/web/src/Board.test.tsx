import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

describe('TaskFlow board', () => {
  it('shows exactly three task columns and their cards', () => {
    render(<Board tasks={[{ id: 1, title: 'Preparare demo', description: '', status: 'doing', priority: 'high' }]} onMove={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Da fare' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In corso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completato' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparare demo' })).toBeInTheDocument();
  });
});
