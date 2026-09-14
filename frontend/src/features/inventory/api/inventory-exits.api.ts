import { apiClient } from '../../../app/api';

export type ExitReason = 'waste' | 'sample' | 'internal_consumption' | 'donation' | 'other';

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  waste: 'Merma / Desperdicio',
  sample: 'Muestra / Degustación',
  internal_consumption: 'Consumo interno',
  donation: 'Donación',
  other: 'Otro',
};

export interface CreateExitPayload {
  ingredientId: string;
  quantity: number;
  reason: ExitReason;
  notes?: string;
}

export interface ExitResult {
  ingredient: { id: string; currentStock: number };
  movement: { id: string; quantity: number; createdAt: string };
}

export const inventoryExitsApi = {
  create: async (payload: CreateExitPayload) => {
    const response = await apiClient.post<ExitResult>('/inventory/exits', payload);
    return response.data;
  },
};
