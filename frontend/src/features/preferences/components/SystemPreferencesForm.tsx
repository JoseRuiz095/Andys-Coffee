import { useState, useEffect } from 'react'
import { PreferencesAPI } from '../api/preferences.api'
import { sileo } from 'sileo'

export function SystemPreferencesForm() {
  const [preferences, setPreferences] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const data = await PreferencesAPI.getAll()
      const prefs: Record<string, string> = {}
      data.forEach((pref) => {
        prefs[pref.key] = String(pref.value)
      })
      setPreferences(prefs)
    } catch (error) {
      sileo.error({ title: 'Error', description: 'No se pudieron cargar las preferencias' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (key: string) => {
    setSaving(true)
    try {
      await PreferencesAPI.set(key, preferences[key])
      sileo.success({ title: 'Guardado', description: `Preferencia "${key}" actualizada` })
    } catch (error) {
      sileo.error({ title: 'Error', description: 'No se pudo guardar la preferencia' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando preferencias...</div>
  }

  const commonPreferences = [
    { key: 'business_name', label: 'Nombre del negocio', type: 'text' },
    { key: 'business_hours', label: 'Horario (ej: 09:00-22:00)', type: 'text' },
    { key: 'currency', label: 'Moneda', type: 'text' },
    { key: 'currency_symbol', label: 'Símbolo de moneda', type: 'text' },
    { key: 'phone', label: 'Teléfono', type: 'text' },
    { key: 'address', label: 'Dirección', type: 'text' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Preferencias del Sistema
      </h2>

      <div className="space-y-4">
        {commonPreferences.map((pref) => (
          <div key={pref.key} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {pref.label}
              </label>
              <input
                type={pref.type}
                value={(preferences[pref.key] ?? '') as string}
                onChange={(e) => setPreferences({ ...preferences, [pref.key]: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
            <button
              onClick={() => handleSave(pref.key)}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Nota: Puedes agregar más preferencias personalizadas. Cada preferencia se guarda inmediatamente.
        </p>
      </div>
    </div>
  )
}
