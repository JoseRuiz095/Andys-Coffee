import React from 'react';
import { sileo } from 'sileo';
import { useFixedExpenseSettings, useUpsertFixedExpenseConcept, useDeleteFixedExpenseConcept } from '../hooks/useIncomeStatement';
import type { FixedExpenseConcept } from '../api/income-statement.api';
import { getErrorMessage } from '../../../shared/utils/errors';

export function FixedExpenseSettingsForm() {
  const { data, isLoading } = useFixedExpenseSettings();
  const { mutate: upsertConcept, isPending: isUpsertPending } = useUpsertFixedExpenseConcept();
  const { mutate: deleteConcept, isPending: isDeletePending } = useDeleteFixedExpenseConcept();

  const [concepts, setConcepts] = React.useState<FixedExpenseConcept[]>([]);
  const [newLabel, setNewLabel] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');

  // Load the saved concepts whenever fresh data arrives (adjusting state during render).
  const [loadedData, setLoadedData] = React.useState<typeof data>(undefined);
  if (data && data !== loadedData) {
    setLoadedData(data);
    setConcepts(data.concepts);
  }

  const generateSlug = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  };

  const handleAddConcept = () => {
    if (!newLabel.trim()) return;
    const slug = generateSlug(newLabel);
    upsertConcept(
      { slug, input: { label: newLabel, amount: 0 } },
      {
        onSuccess: (updated) => {
          setConcepts(updated.concepts);
          setNewLabel('');
          sileo.success({ title: 'Concepto agregado', description: `Se agregó "${newLabel}" exitosamente.` });
        },
        onError: (error: unknown) =>
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo agregar el concepto.'),
          }),
      },
    );
  };

  const handleSaveConcept = (slug: string) => {
    if (!editLabel.trim() || editAmount === '' || Number(editAmount) < 0) {
      sileo.error({ title: 'Error', description: 'El monto debe ser mayor o igual a 0.' });
      return;
    }
    upsertConcept(
      { slug, input: { label: editLabel, amount: Number(editAmount) } },
      {
        onSuccess: (updated) => {
          setConcepts(updated.concepts);
          setEditingId(null);
          setEditLabel('');
          setEditAmount('');
          sileo.success({ title: 'Guardado', description: 'El concepto se actualizó correctamente.' });
        },
        onError: (error: unknown) =>
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo guardar el concepto.'),
          }),
      },
    );
  };

  const handleDeleteConcept = (slug: string) => {
    if (confirm(`¿Eliminar concepto "${concepts.find((c) => c.slug === slug)?.label}"?`)) {
      deleteConcept(slug, {
        onSuccess: (updated) => {
          setConcepts(updated.concepts);
          sileo.success({ title: 'Eliminado', description: 'El concepto se eliminó correctamente.' });
        },
        onError: (error: unknown) =>
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo eliminar el concepto.'),
          }),
      });
    }
  };

  const startEdit = (concept: FixedExpenseConcept) => {
    setEditingId(concept.slug);
    setEditLabel(concept.label);
    setEditAmount(String(concept.amount));
  };

  const total = concepts.reduce((sum, c) => sum + c.amount, 0);

  if (isLoading) {
    return <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Cargando…</div>;
  }

  const fieldStyle: React.CSSProperties = {
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-input-bg)',
    color: 'var(--color-input-text)',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Gastos Operativos Fijos
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Configura los conceptos de gastos fijos recurrentes. Estos se aplican diariamente a los días con operación.
      </p>

      {/* Existing concepts */}
      <div className="space-y-2">
        {concepts.map((concept) => (
          <div key={concept.slug} className="flex items-end gap-2 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            {editingId === concept.slug ? (
              <>
                <label className="flex-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Concepto
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Monto
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
                <button
                  onClick={() => handleSaveConcept(concept.slug)}
                  disabled={isUpsertPending}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition"
                  style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {concept.label}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    ${concept.amount.toFixed(2)} MXN
                  </div>
                </div>
                <button
                  onClick={() => startEdit(concept)}
                  disabled={isUpsertPending}
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteConcept(concept.slug)}
                  disabled={isDeletePending}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new concept */}
      <div className="space-y-2 p-3 rounded-lg border-dashed border-2" style={{ borderColor: 'var(--color-border)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Agregar Concepto
        </div>
        <div className="flex items-end gap-2">
          <input
            type="text"
            placeholder="Ej: Luz, Sueldos, Agua..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddConcept();
            }}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={fieldStyle}
          />
          <button
            onClick={handleAddConcept}
            disabled={!newLabel.trim() || isUpsertPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Agregar
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Total de Gastos Fijos Diarios:
        </span>
        <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
          ${total.toFixed(2)} MXN
        </span>
      </div>
    </div>
  );
}
