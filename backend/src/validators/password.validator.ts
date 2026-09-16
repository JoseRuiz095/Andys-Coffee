import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede exceder 72 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe contener al menos una letra.')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número.');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida.'),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.').max(255),
});
