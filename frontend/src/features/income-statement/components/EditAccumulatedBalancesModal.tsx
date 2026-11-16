import React, { useId } from 'react';
import { sileo } from 'sileo';
import { getTodayDateString } from '../../../shared/utils/dateUtils';
import { useUpdateAccumulatedBalances } from '../hooks/useIncomeStatement';
import { getErrorMessage } from '../../../shared/utils/errors';
import { Modal } from '../../../shared/components/Modal';
import { parseNonNegativeAmount } from '../../../shared/utils/numbers';
import { formatCurrency } from '../../../shared/utils/formatCurrency'

interface EditAccumulatedBalancesModalProps {
  isOpen: boolean;
  date: string;
  currentValues: {
    ahorroAcumulado: number;
    fondoNegocioAcumulado: number;
    surtidoAcumulado: number;
  };
  ganciaNeta?: number;
  onClose: () => void;
}

export function EditAccumulatedBalancesModal({
  isOpen,
  date,
  currentValues,
  ganciaNeta = 0,
  onClose,
}: EditAccumulatedBalancesModalProps) {
  const { mutate: updateBalances, isPending } = useUpdateAccumulatedBalances();
  const titleId = useId();
  // Escape, the backdrop and "Cancelar" are ignored while saving.
  const handleClose = () => {
    if (!isPending) onClose();
  };

  const [ahorro, setAhorro] = React.useState(String(currentValues.ahorroAcumulado));
  const [fondo, setFondo] = React.useState(String(currentValues.fondoNegocioAcumulado));
  const [surtido, setSurtido] = React.useState(String(currentValues.surtidoAcumulado));

  // Reset the fields each time the modal opens (adjusting state during render, not in an effect).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setAhorro(String(currentValues.ahorroAcumulado));
      setFondo(String(currentValues.fondoNegocioAcumulado));
      setSurtido(String(currentValues.surtidoAcumulado));
    }
  }

  // null = empty or invalid: saving it as 0 would wipe the balance.
  const ahorroNum = parseNonNegativeAmount(ahorro);
  const fondoNum = parseNonNegativeAmount(fondo);
  const surtidoNum = parseNonNegativeAmount(surtido);

  const isToday = date === getTodayDateString();

  const handleSave = () => {
    if (isPending) return;

    if (!isToday) {
      sileo.error({ title: 'Error', description: 'Solo se pueden editar los saldos del día actual.' });
      return;
    }

    if (ahorroNum === null || fondoNum === null || surtidoNum === null) {
      sileo.error({ title: 'Error', description: 'Captura los tres saldos: deben ser números mayores o iguales a 0.' });
      return;
    }

    updateBalances(
      {
        date,
        input: {
          ahorroAcumulado: ahorroNum,
          fondoNegocioAcumulado: fondoNum,
          surtidoAcumulado: surtidoNum,
        },
      },
      {
        onSuccess: () => {
          sileo.success({ title: 'Guardado', description: 'Saldos acumulados actualizados.' });
          onClose();
        },
        onError: (error: unknown) =>
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudieron guardar los cambios.'),
          }),
      },
    );
  };

  if (!isOpen) return null;

  const fieldStyle: React.CSSProperties = {
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-input-bg)',
    color: 'var(--color-input-text)',
  };

  return (
    <Modal isOpen onClose={handleClose} ariaLabelledBy={titleId}>
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Editar Saldos Acumulados
        </h2>

        {!isToday && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))', color: 'var(--color-danger)' }}
          >
            Solo se pueden editar los saldos del día actual.
          </div>
        )}

        {ganciaNeta > 0 && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-info) 12%, var(--color-surface))', color: 'var(--color-text-primary)' }}
          >
            <strong>Ganancia Neta del día:</strong> {formatCurrency(ganciaNeta)}
          </div>
        )}

        <div className="space-y-3 mb-4">
          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Ahorro Acumulado
            <input
              type="number"
              min={0}
              step={0.01}
              value={ahorro}
              onChange={(e) => setAhorro(e.target.value)}
              disabled={!isToday || isPending}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              style={fieldStyle}
            />
          </label>

          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Fondo Negocio Acumulado
            <input
              type="number"
              min={0}
              step={0.01}
              value={fondo}
              onChange={(e) => setFondo(e.target.value)}
              disabled={!isToday || isPending}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              style={fieldStyle}
            />
          </label>

          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Surtido Acumulado
            <input
              type="number"
              min={0}
              step={0.01}
              value={surtido}
              onChange={(e) => setSurtido(e.target.value)}
              disabled={!isToday || isPending}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              style={fieldStyle}
            />
          </label>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isToday || isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-text)] transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
