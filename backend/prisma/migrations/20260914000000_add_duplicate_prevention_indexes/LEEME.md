# Migración: Prevención de Duplicados en Ingredientes y Proveedores

**Fecha**: 2026-09-14  
**Fase**: 1 de 4 - Integridad de Base de Datos  
**Estado**: REQUIERE AUDITORÍA PREVIA

---

## ¿Qué hace esta migración?

Agrega 4 índices a la base de datos:

1. **`ingredients_name_normalized_unique`** (UNIQUE)
   - Previene que existan dos ingredientes activos con el mismo nombre
   - Ignora mayúsculas/minúsculas y espacios al inicio/final
   - Ejemplo: "Café en grano" = "CAFÉ EN GRANO" = " café en grano "

2. **`suppliers_name_normalized_unique`** (UNIQUE)
   - Previene que existan dos proveedores activos con el mismo nombre
   - Mismo comportamiento de normalización que ingredientes

3. **`ingredients_name_search_idx`** (Index)
   - Mejora velocidad de búsqueda por nombre
   - Permite búsquedas eficientes sin constraint UNIQUE

4. **`suppliers_name_search_idx`** (Index)
   - Lo mismo que el anterior pero para proveedores

---

## ⚠️ IMPORTANTE — ANTES DE APLICAR

### 1. Auditar duplicados actuales

Ejecuta estas queries en la BD para verificar si ya existen duplicados:

```sql
-- Ingredientes con nombre exactamente igual (case-insensitive)
SELECT 
  LOWER(TRIM(name)) as nombre_normalizado,
  COUNT(*) as cantidad,
  array_agg(id) as ids
FROM ingredients
WHERE "isActive" = true
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;

-- Proveedores con nombre exactamente igual (case-insensitive)
SELECT 
  LOWER(TRIM(name)) as nombre_normalizado,
  COUNT(*) as cantidad,
  array_agg(id) as ids
FROM suppliers
WHERE "isActive" = true
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;

-- Ingredientes con SKU duplicado (redundante, pero verificar)
SELECT 
  sku,
  COUNT(*) as cantidad,
  array_agg(id) as ids
FROM ingredients
WHERE sku IS NOT NULL AND "isActive" = true
GROUP BY sku
HAVING COUNT(*) > 1;
```

---

### 2. Si encuentra duplicados

Si la auditoría encuentra duplicados:

1. **NO aplicar la migración aún**
2. **Consolidar duplicados** manualmente:
   - Decidir cuál registro es "canonical"
   - Migrar relaciones del registro "duplicate" al canonical
     - `PurchaseItem.ingredientId` que apunte a duplicate → apuntar a canonical
     - `Recipe.ingredientId` que apunte a duplicate → apuntar a canonical
     - `InventoryCountItem.ingredientId` → apuntar a canonical
     - `InventoryMovement.ingredientId` → apuntar a canonical
   - Eliminar el registro duplicate
3. **DESPUÉS** aplicar la migración

---

### 3. Si NO encuentra duplicados

Si no hay duplicados:

1. Puedes aplicar la migración directamente
2. Ejecutar: `npx prisma migrate deploy`

---

## Rollback (si es necesario)

```sql
-- Remover los índices si necesitas hacer rollback
DROP INDEX IF EXISTS "ingredients_name_normalized_unique";
DROP INDEX IF EXISTS "suppliers_name_normalized_unique";
DROP INDEX IF EXISTS "ingredients_name_search_idx";
DROP INDEX IF EXISTS "suppliers_name_search_idx";
```

---

## Impacto

### Positivo
- ✅ Previene futuros duplicados de ingredientes
- ✅ Previene futuros duplicados de proveedores
- ✅ Búsquedas más rápidas por nombre
- ✅ Integridad de datos reforzada

### Negativo (mínimo)
- ⚠️ INSERT/UPDATE ligeramente más lento (índice que mantener)
- ⚠️ Más almacenamiento en BD (índices adicionales)

---

## Después de aplicar

Una vez aplicada, los siguientes intentos fallarán con error `UNIQUE VIOLATION`:

```typescript
// Esto fallará si "Café en grano" ya existe (case-insensitive)
await prisma.ingredient.create({
  data: {
    name: "CAFÉ EN GRANO",  // ← UNIQUE VIOLATION
    // ...
  }
})
```

El backend debe manejar este error y convertirlo en una respuesta controlada:
```typescript
catch (error) {
  if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
    // Ingrediente ya existe
    return { error: 'INGREDIENT_ALREADY_EXISTS' };
  }
}
```

(Esto será implementado en Fase 2)

---

## Referencia

- **Fase 1**: ✅ Crear índices (esta migración)
- **Fase 2**: Backend - Búsqueda de duplicados y manejo de errores
- **Fase 3**: Frontend - UX de prevención de duplicados
- **Fase 4**: Aplicar patrón a Proveedores (validación)

---

## Notas

- Los índices solo aplican a registros `isActive = true`
- Esto permite que un ingrediente "archivado" no bloquee crear uno nuevo con el mismo nombre
- La normalización (LOWER + TRIM) es consistente con futuras búsquedas en backend
