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

export const generalPreferencesSchema = z
  .object({
    businessName: z.string().min(1).max(100),
    businessHoursOpen: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:MM)'),
    businessHoursClose: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:MM)'),
    currency: z.enum(['MXN', 'USD', 'CAD']),
    currencySymbol: z.string().min(1).max(3),
    phone: z
      .string()
      .max(20)
      .regex(/^[\d\s\-()+]*$/, 'El teléfono solo puede contener números, espacios, guiones, paréntesis y +')
      .refine((val) => !val || /\d/.test(val), { message: 'El teléfono debe contener al menos un dígito' })
      .optional(),
    address: z.string().max(250).optional(),
  })
  .refine(
    (data) => {
      const [openHour, openMin] = data.businessHoursOpen.split(':').map(Number);
      const [closeHour, closeMin] = data.businessHoursClose.split(':').map(Number);
      const openTime = openHour * 60 + openMin;
      const closeTime = closeHour * 60 + closeMin;
      return closeTime > openTime;
    },
    { message: 'La hora de cierre debe ser posterior a la hora de apertura.', path: ['businessHoursClose'] }
  );

export type GeneralPreferencesInput = z.infer<typeof generalPreferencesSchema>;
