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
  name: z.string().trim().min(1, 'El nombre es requerido.').max(255),
});

export const loginSchema = z.object({
  // D-02: the address is matched ignoring case and surrounding spaces.
  email: z.string().trim().toLowerCase().min(1, 'El email es requerido.').email('El email debe ser válido.'),
  password: z.string().min(1, 'La contraseña es requerida.').max(72),
});
