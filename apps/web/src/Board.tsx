import type { TaskPriority, TaskStatus } from '@taskflow/contracts';

export type BoardTask = {
  id: number; title: string; description: string; status: TaskStatus; priority: TaskPriority;
  due_date?: string | null; assignee_name?: string | null;
};

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'Da fare', color: 'gray' },
  { id: 'doing', label: 'In corso', color: 'blue' },
  { id: 'done', label: 'Completato', color: 'green' },
];
const next: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' };

export function Board({ tasks, onMove, onOpen, readOnly = false }: {
  tasks: BoardTask[]; onMove: (id: number, status: TaskStatus) => void; onOpen: (task: BoardTask) => void; readOnly?: boolean;
}) {
  return <div className="board" aria-label="Bacheca TaskFlow">
    {columns.map((column) => {
      const cards = tasks.filter((task) => task.status === column.id);
      return <section className="board-column" key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault(); const id = Number(event.dataTransfer.getData('text/taskflow-id')); if (id) onMove(id, column.id);
      }}>
        <header className="column-header"><span className={`status-dot ${column.color}`} />
          <h2>{column.label}</h2><span className="count">{cards.length}</span>
          {!readOnly && <button className="icon-button" aria-label={`Aggiungi task ${column.label}`} onClick={() => onOpen({ id: 0, title: '', description: '', status: column.id, priority: 'medium' })}>＋</button>}
        </header>
        <div className="column-hint">{column.id === 'todo' ? 'Da iniziare' : column.id === 'doing' ? 'Attività in lavorazione' : 'Attività completate'}</div>
        <div className="task-list">
          {cards.map((task) => <article className="task-card" key={task.id} draggable={!readOnly} onDragStart={(event) => event.dataTransfer.setData('text/taskflow-id', String(task.id))}>
            <button className="task-title" onClick={() => onOpen(task)}>{task.title}</button>
            {task.description && <p className="task-description">{task.description}</p>}
            <div className="task-meta"><span className={`priority ${task.priority}`}>{task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Bassa' : 'Media'}</span>
              {task.due_date && <time dateTime={task.due_date}>{new Date(`${task.due_date}T12:00:00`).toLocaleDateString('it-IT')}</time>}
              {task.assignee_name && <span className="assignee" title={task.assignee_name}>{task.assignee_name}</span>}
            </div>
            {!readOnly && <button className="move-button" onClick={() => onMove(task.id, next[task.status])}>{task.status === 'todo' ? '→ In corso' : task.status === 'doing' ? '→ Completato' : '↶ Da fare'}</button>}
          </article>)}
          {!cards.length && <div className="empty-column">Nessun task</div>}
        </div>
      </section>;
    })}
  </div>;
}
