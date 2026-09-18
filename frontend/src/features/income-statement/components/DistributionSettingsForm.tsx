import React from 'react';
import { sileo } from 'sileo';
import { useDistributionSettings, useUpdateDistributionSettings } from '../hooks/useIncomeStatement';

export function DistributionSettingsForm() {
  const { data, isLoading } = useDistributionSettings();
  const { mutate: updateSettings, isPending } = useUpdateDistributionSettings();

  const [savingsPercent, setSavingsPercent] = React.useState('10');
  const [businessFundPercent, setBusinessFundPercent] = React.useState('20');
  const [suppliesPercent, setSuppliesPercent] = React.useState('70');

  React.useEffect(() => {
    if (!data) return;
    setSavingsPercent(String(data.savingsPercent));
    setBusinessFundPercent(String(data.businessFundPercent));
    setSuppliesPercent(String(data.suppliesPercent));
  }, [data]);

  const savings = Number(savingsPercent) || 0;
  const business = Number(businessFundPercent) || 0;
  const supplies = Number(suppliesPercent) || 0;
  const sum = savings + business + supplies;
  const sumIsValid = Math.abs(sum - 100) < 0.01;

  // Per-field validation
  const isSavingsValid = savings >= 0 && savings <= 100;
  const isBusinessValid = business >= 0 && business <= 100;
  const isSuppliesValid = supplies >= 0 && supplies <= 100;
  const allFieldsValid = isSavingsValid && isBusinessValid && isSuppliesValid && sumIsValid;

  const handleSave = () => {
    if (!allFieldsValid) {
      sileo.error({ title: 'Error', description: 'Corrige los errores antes de guardar.' });
      return;
    }
    updateSettings(
      {
        savingsPercent: savings,
        businessFundPercent: business,
        suppliesPercent: supplies,
      },
      {
        onSuccess: () => sileo.success({ title: 'Guardado', description: 'Porcentajes de distribución actualizados.' }),
        onError: (error: any) =>
          sileo.error({
            title: 'Error',
            description: error?.response?.data?.message ?? 'No se pudieron guardar los porcentajes.',
          }),
      },
    );
  };

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
        Distribución del Estado de Resultados
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Porcentaje de la ganancia neta diaria destinado a cada categoría. Deben sumar 100%.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Ahorro (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={savingsPercent}
              onChange={(e) => setSavingsPercent(e.target.value)}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ ...fieldStyle, borderColor: !isSavingsValid ? 'var(--color-danger)' : fieldStyle.borderColor }}
            />
          </label>
          {!isSavingsValid && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
              Debe estar entre 0 y 100
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Fondo del Negocio (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={businessFundPercent}
              onChange={(e) => setBusinessFundPercent(e.target.value)}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ ...fieldStyle, borderColor: !isBusinessValid ? 'var(--color-danger)' : fieldStyle.borderColor }}
            />
          </label>
          {!isBusinessValid && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
              Debe estar entre 0 y 100
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Surtido (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={suppliesPercent}
              onChange={(e) => setSuppliesPercent(e.target.value)}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ ...fieldStyle, borderColor: !isSuppliesValid ? 'var(--color-danger)' : fieldStyle.borderColor }}
            />
          </label>
          {!isSuppliesValid && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
              Debe estar entre 0 y 100
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span
          className="text-sm font-semibold"
          style={{ color: sumIsValid ? 'var(--color-success)' : 'var(--color-danger)' }}
        >
          Suma: {sum.toFixed(2)}%
        </span>
        {!sumIsValid && (
          <span className="text-sm" style={{ color: 'var(--color-danger)' }}>
            Los porcentajes deben sumar exactamente 100%.
          </span>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={!allFieldsValid || isPending}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
