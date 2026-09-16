import { z } from 'zod';

export const preferenceSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  label: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

export const updatePreferenceSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  label: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});
