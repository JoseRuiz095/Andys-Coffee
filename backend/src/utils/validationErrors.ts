import { z, type ZodError } from 'zod';

// Zod's built-in messages (a .max() without its own text, a missing field…) in Spanish, like the
// rest of the API. Global: it applies to every schema at parse time.
z.config(z.locales.es());

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre', email: 'Correo', password: 'Contraseña', newPassword: 'Nueva contraseña',
  currentPassword: 'Contraseña actual', roleId: 'Rol', notes: 'Notas', note: 'Nota', items: 'Insumos',
  quantity: 'Cantidad', unitCost: 'Costo unitario', price: 'Precio', cost: 'Costo', jumboPrice: 'Precio Jumbo',
  sku: 'SKU', phone: 'Teléfono', address: 'Dirección', customerName: 'Cliente', amount: 'Monto',
  description: 'Descripción', category: 'Categoría', categoryId: 'Categoría', minimumStock: 'Stock mínimo',
  maximumStock: 'Stock máximo', unitId: 'Unidad', ingredientId: 'Insumo', supplierId: 'Proveedor',
  reason: 'Motivo', paymentMethod: 'Método de pago', cashReceived: 'Monto recibido',
  openingAmount: 'Fondo inicial', closingAmount: 'Monto contado', countedQuantity: 'Cantidad contada',
};

// Zod's default (locale) messages don't say which field failed; custom ones already do.
const DEFAULT_MESSAGE = /^(Entrada inválida|Demasiado (grande|pequeño)|Formato inválido|Opción inválida|Número inválido|Valor inválido|Llaves? (no reconocida|inválida)|Elemento inválido)/;

function describeIssue(issue: ZodError['issues'][number]): string {
  if (!DEFAULT_MESSAGE.test(issue.message)) return issue.message;
  const key = [...issue.path].reverse().find((segment) => typeof segment === 'string') as string | undefined;
  if (!key) return issue.message;
  return `${FIELD_LABELS[key] ?? key}: ${issue.message}`;
}

/**
 * Body of every 400 for an invalid request. `message` carries the first reason, because the
 * screens show `message` in their toast; it used to be the generic "Error de validación." and the
 * user never saw what to fix (QA audit 2026-11-18, D-10). `errors` keeps the field errors.
 */
export function validationErrorBody(error: ZodError) {
  const first = error.issues[0];
  return {
    message: first ? describeIssue(first) : 'Error de validación.',
    errors: error.flatten().fieldErrors,
  };
}
