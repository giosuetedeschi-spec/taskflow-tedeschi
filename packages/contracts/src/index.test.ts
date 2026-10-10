import { describe, expect, it } from 'bun:test';
import {
  credentialsSchema,
  idSchema,
  messageInputSchema,
  projectInputSchema,
  reportInputSchema,
  taskInputSchema,
  taskPriority,
  taskStatus,
} from './index';

describe('shared API contracts', () => {
  it('validates account fields and length limits', () => {
    expect(credentialsSchema.safeParse({ email: 'ada@example.test', password: 'long enough password' }).success).toBe(true);
    expect(credentialsSchema.safeParse({ email: 'not-an-email', password: 'long enough password' }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: 'ada@example.test', password: 'short' }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: 'ada@example.test', password: 'long enough password', displayName: ' A ' }).success).toBe(false);
  });

  it('applies project defaults and rejects invalid names or visibility', () => {
    expect(projectInputSchema.parse({ name: 'Planning' })).toMatchObject({
      name: 'Planning', description: '', category: 'Altro', technologies: '', visibility: 'private',
    });
    expect(projectInputSchema.safeParse({ name: ' ', visibility: 'team' }).success).toBe(false);
    expect(projectInputSchema.safeParse({ name: 'A'.repeat(101) }).success).toBe(false);
  });

  it('applies task defaults and restricts status, priority, ids and due dates', () => {
    expect(taskInputSchema.parse({ title: '  Review  ' })).toMatchObject({ title: 'Review', description: '', priority: 'medium' });
    expect(taskInputSchema.safeParse({ title: 'Task', priority: 'urgent' }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: 'Task', dueDate: 'tomorrow' }).success).toBe(false);
    expect(taskStatus.safeParse('doing').success).toBe(true);
    expect(taskStatus.safeParse('blocked').success).toBe(false);
    expect(taskPriority.safeParse('high').success).toBe(true);
    expect(idSchema.safeParse(1).success).toBe(true);
    expect(idSchema.safeParse(0).success).toBe(false);
    expect(idSchema.safeParse(1.5).success).toBe(false);
  });

  it('requires non-empty bounded chat messages and known report categories', () => {
    expect(messageInputSchema.safeParse({ text: '  Ciao  ' }).success).toBe(true);
    expect(messageInputSchema.safeParse({ text: '   ' }).success).toBe(false);
    expect(messageInputSchema.safeParse({ text: 'x'.repeat(5001) }).success).toBe(false);
    expect(reportInputSchema.parse({ category: 'spam' })).toMatchObject({ category: 'spam', details: '' });
    expect(reportInputSchema.safeParse({ category: 'made-up' }).success).toBe(false);
  });
});
