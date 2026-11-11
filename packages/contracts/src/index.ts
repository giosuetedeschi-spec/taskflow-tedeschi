import { z } from 'zod';

export const taskStatus = z.enum(['todo', 'doing', 'done']);
export const taskPriority = z.enum(['low', 'medium', 'high']);
export const projectVisibility = z.enum(['private', 'public']);

export const idSchema = z.coerce.number().int().positive();
export const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(2).max(60).optional(),
});
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).default(''),
  priority: taskPriority.default('medium'),
  dueDate: z.iso.date().nullable().optional(),
  assigneeId: idSchema.nullable().optional(),
});
export const projectInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(2000).default(''),
  category: z.string().trim().max(60).default('Altro'),
  technologies: z.string().trim().max(200).default(''),
  visibility: projectVisibility.default('private'),
});
export const messageInputSchema = z.object({ text: z.string().trim().min(1).max(5000) });
export const reportInputSchema = z.object({
  category: z.enum(['spam', 'inappropriate', 'illegal', 'ip', 'misleading', 'other']),
  details: z.string().trim().max(2000).default(''),
});

export type TaskStatus = z.infer<typeof taskStatus>;
export type TaskPriority = z.infer<typeof taskPriority>;
