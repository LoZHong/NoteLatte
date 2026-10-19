import { z } from 'zod';

export const noteStatusSchema = z.enum(['Todo', 'In-Progress', 'On-Hold', 'Done']);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Please enter a valid email address.')
  .max(254, 'Please enter a valid email address.')
  .email('Please enter a valid email address.');

// bcrypt silently truncates input beyond 72 bytes, so cap it explicitly.
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters.')
  .max(72, 'Password must be at most 72 characters.');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200, 'Title is too long.'),
  content: z.string().max(20000, 'Content is too long.').optional().default(''),
  status: noteStatusSchema.optional().default('Todo'),
});

export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(200, 'Title is too long.').optional(),
    content: z.string().max(20000, 'Content is too long.').optional(),
    status: noteStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update.' });

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}
