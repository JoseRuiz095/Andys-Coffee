import React from 'react';
import { sileo } from 'sileo';
import { useFixedExpenseSettings, useUpsertFixedExpenseConcept, useDeleteFixedExpenseConcept } from '../hooks/useIncomeStatement';
import type { FixedExpenseConcept } from '../api/income-statement.api';
import { getErrorMessage } from '../../../shared/utils/errors';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { RowActions } from '../../../shared/components/RowActions';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Button } from '../../../shared/components/Button';
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles';
import { getNewConceptError, slugifyConceptLabel } from '../utils/fixedExpenseConcepts';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

/** Daily fixed operating expenses (light, wages...): applied to every day with operation. */
export function FixedExpenseSettingsForm({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useFixedExpenseSettings();
  const { mutate: upsertConcept, isPending: isUpsertPending } = useUpsertFixedExpenseConcept();
  const { mutate: deleteConcept, isPending: isDeletePending } = useDeleteFixedExpenseConcept();

  const [newLabel, setNewLabel] = React.useState('');
  const [newLabelError, setNewLabelError] = React.useState<string | null>(null);
  const [editingSlug, setEditingSlug] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = React.useState<string | null>(null);

  const concepts: FixedExpenseConcept[] = data?.concepts ?? [];
  const total = concepts.reduce((sum, c) => sum + c.amount, 0);

  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || isUpsertPending) return;
    // Adding is an upsert by slug with amount 0: an existing concept must never be reset.
    const conceptError = getNewConceptError(newLabel, concepts);
    setNewLabelError(conceptError);
    if (conceptError) return;
    const label = newLabel.trim();
    upsertConcept(
      { slug: slugifyConceptLabel(label), input: { label, amount: 0 } },
      {
        onSuccess: () => {
          setNewLabel('');
          sileo.success({ title: 'Concepto agregado', description: `Ahora edita "${label}" para ponerle su monto diario.` });
        },
        onError: (err: unknown) =>
          sileo.error({ title: 'No se pudo agregar el concepto', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
      },
    );
  };

  const startEdit = (concept: FixedExpenseConcept) => {
    setEditingSlug(concept.slug);
    setEditLabel(concept.label);
    setEditAmount(String(concept.amount));
    setEditError(null);
  };

  const handleSaveConcept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlug || isUpsertPending) return;
    const amount = Number(editAmount);
    if (!editLabel.trim()) return setEditError('Ingresa el nombre del concepto.');
    if (editAmount.trim() === '' || !Number.isFinite(amount) || amount < 0) return setEditError('El monto debe ser mayor o igual a 0.');
    setEditError(null);
    upsertConcept(
      { slug: editingSlug, input: { label: editLabel.trim(), amount } },
      {
        onSuccess: () => {
          setEditingSlug(null);
          sileo.success({ title: 'Concepto guardado' });
        },
        onError: (err: unknown) =>
          sileo.error({ title: 'No se pudo guardar el concepto', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
      },
    );
  };

  const handleDeleteConcept = () => {
    if (!deletingSlug) return;
    deleteConcept(deletingSlug, {
      onSuccess: () => {
        setDeletingSlug(null);
        sileo.success({ title: 'Concepto eliminado' });
      },
      onError: (err: unknown) =>
        sileo.error({ title: 'No se pudo eliminar el concepto', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
    });
  };

  return (
    <section aria-labelledby="fixed-expenses-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="fixed-expenses-title" className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Gastos fijos diarios
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Se restan de la ganancia de cada día con operación.
          </p>
        </div>
        {data && (
          <p className="text-right">
            <span className="block text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total por día</span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {formatCurrency(total)}
            </span>
          </p>
        )}
      </div>

      {isError ? (
        <QueryErrorState error={error} subject="los gastos fijos" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : isLoading || !data ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (
        <>
          {concepts.length === 0 ? (
            <p className="rounded-xl border px-4 py-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              No hay gastos fijos configurados.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
              {concepts.map((concept) => (
                <li key={concept.slug} className="px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                  {editingSlug === concept.slug ? (
                    <form onSubmit={handleSaveConcept} noValidate className="flex flex-wrap items-end gap-3">
                      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Concepto
                        <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={FILTER_FIELD_CLASS} />
                      </label>
                      <label className="flex w-36 flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Monto diario
                        <input type="number" min={0} step={0.01} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className={FILTER_FIELD_CLASS} />
                      </label>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setEditingSlug(null)} disabled={isUpsertPending}>
                          Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={isUpsertPending}>
                          {isUpsertPending ? 'Guardando...' : 'Guardar'}
                        </Button>
                      </div>
                      {editError && (
                        <p role="alert" className="w-full text-sm" style={{ color: 'var(--color-danger)' }}>
                          {editError}
                        </p>
                      )}
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{concept.label}</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatCurrency(concept.amount)} por día</p>
                      </div>
                      {canEdit && (
                        <RowActions
                          actions={[
                            { label: 'Editar', ariaLabel: `Editar ${concept.label}`, onClick: () => startEdit(concept), disabled: isUpsertPending },
                            { label: 'Eliminar', ariaLabel: `Eliminar ${concept.label}`, onClick: () => setDeletingSlug(concept.slug), disabled: isDeletePending, danger: true },
                          ]}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <form onSubmit={handleAddConcept} noValidate className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Nuevo concepto
                <input
                  type="text"
                  placeholder="Ej. Luz, Sueldos, Agua..."
                  value={newLabel}
                  aria-invalid={newLabelError ? true : undefined}
                  aria-describedby={newLabelError ? 'fixed-expense-new-error' : undefined}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    setNewLabelError(null);
                  }}
                  disabled={isUpsertPending}
                  className={FILTER_FIELD_CLASS}
                />
              </label>
              <Button type="submit" variant="primary" disabled={!newLabel.trim() || isUpsertPending}>
                Agregar
              </Button>
              {newLabelError && (
                <p id="fixed-expense-new-error" role="alert" className="w-full text-sm" style={{ color: 'var(--color-danger)' }}>
                  {newLabelError}
                </p>
              )}
            </form>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={deletingSlug !== null}
        title="Eliminar concepto"
        message={`¿Eliminar el concepto "${concepts.find((c) => c.slug === deletingSlug)?.label ?? ''}"? Dejará de sumarse a los gastos fijos diarios.`}
        confirmText="Eliminar"
        isDangerous
        isLoading={isDeletePending}
        onConfirm={handleDeleteConcept}
        onCancel={() => setDeletingSlug(null)}
      />
    </section>
  );
}
