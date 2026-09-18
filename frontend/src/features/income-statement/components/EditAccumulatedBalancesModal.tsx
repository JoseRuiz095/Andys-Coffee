import React from 'react';
import { sileo } from 'sileo';
import { useUpdateAccumulatedBalances } from '../hooks/useIncomeStatement';

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

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

  const [ahorro, setAhorro] = React.useState(String(currentValues.ahorroAcumulado));
  const [fondo, setFondo] = React.useState(String(currentValues.fondoNegocioAcumulado));
  const [surtido, setSurtido] = React.useState(String(currentValues.surtidoAcumulado));

  React.useEffect(() => {
    if (!isOpen) return;
    setAhorro(String(currentValues.ahorroAcumulado));
    setFondo(String(currentValues.fondoNegocioAcumulado));
    setSurtido(String(currentValues.surtidoAcumulado));
  }, [isOpen, currentValues]);

  const ahorroNum = Number(ahorro) || 0;
  const fondoNum = Number(fondo) || 0;
  const surtidoNum = Number(surtido) || 0;

  const isToday = date === getTodayDateString();

  const handleSave = () => {
    if (!isToday) {
      sileo.error({ title: 'Error', description: 'Solo se pueden editar los saldos del día actual.' });
      return;
    }

    if (ahorroNum < 0 || fondoNum < 0 || surtidoNum < 0) {
      sileo.error({ title: 'Error', description: 'Los saldos acumulados no pueden ser negativos.' });
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
        onError: (error: any) =>
          sileo.error({
            title: 'Error',
            description: error?.response?.data?.message ?? 'No se pudieron guardar los cambios.',
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Editar Saldos Acumulados
        </h2>

        {!isToday && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
          >
            Solo se pueden editar los saldos del día actual.
          </div>
        )}

        {ganciaNeta > 0 && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--color-info-light, #E3F2FD)', color: 'var(--color-text-primary)' }}
          >
            <strong>Ganancia Neta del día:</strong> ${ganciaNeta.toFixed(2)}
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
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isToday || isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
