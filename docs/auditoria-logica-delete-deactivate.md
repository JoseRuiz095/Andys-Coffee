# AUDITORÍA: Lógica de Desactivación y Eliminación de Ingredientes

## 1. DESACTIVACIÓN (isActive = false)

### Ruta:
- **Controlador**: `InventoryController.setActive()` (línea 346-377)
- **Servicio**: `InventoryService.setIngredientActive()` (línea 245-258)
- **Repositorio**: `InventoryRepository.setActive()`

### Lógica:
```
1. Verificar permiso: inventory.create_ingredient
2. Verificar que el ingrediente existe
3. Actualizar isActive a true/false
```

### Validaciones:
✅ Autenticación requerida
✅ Permiso verificado
✅ Existencia del ingrediente validada
✅ No hay restricciones de relaciones (puede desactivarse aunque tenga movimientos)

### Respuesta HTTP:
- **200 OK**: "Ingrediente activado/desactivado correctamente."
- **403 Forbidden**: Permiso insuficiente
- **404 Not Found**: Ingrediente no existe

---

## 2. ELIMINACIÓN (DELETE físico)

### Ruta:
- **Controlador**: `InventoryController.delete()` (línea 379-408)
- **Servicio**: `InventoryService.deleteIngredient()` (línea 260-290)
- **Repositorio**: `InventoryRepository.delete()` + `countRelations()`

### Lógica:
```
1. Verificar permiso: inventory.delete_ingredient
2. Verificar que el ingrediente existe
3. Contar relaciones asociadas:
   - Movimientos de inventario
   - Compras (purchaseItems)
   - Recetas de productos
   - Recetas de extras
   - Conteos físicos
4. Si hay relaciones → Rechazar con ConflictError
5. Si no hay relaciones → Proceder a eliminar
```

### Validaciones (Restricciones):
✅ NO se puede eliminar si tiene:
  - Movimientos de inventario
  - Items de compra
  - Recetas de productos
  - Recetas de extras
  - Items de conteos físicos

⚠️ **Recomendación**: Desactivar en su lugar

### Respuesta HTTP:
- **200 OK**: "Ingrediente eliminado correctamente."
- **403 Forbidden**: Permiso insuficiente (inventory.delete_ingredient)
- **404 Not Found**: Ingrediente no existe
- **409 Conflict**: Tiene relaciones - No se puede eliminar

---

## 3. EVALUACIÓN DE LA LÓGICA

### Puntos Positivos:
✅ **Soft Delete Implementado**: El campo isActive permite "desactivación" sin perder datos
✅ **Restricciones de Integridad**: Evita eliminar ingredientes que se usan en recetas
✅ **Validaciones Exhaustivas**: Chequea todas las relaciones posibles
✅ **Permisos Granulares**: Permisos diferentes para desactivar vs eliminar
✅ **Mensajes Claros**: Sugiere desactivar si hay conflictos

### Áreas de Mejora:
⚠️ **1. Cascada automática**: Cuando se elimina un ingrediente con movimientos, se podría:
   - Opción A: Rechazar (actual) ✓
   - Opción B: Permitir eliminación lógica (soft-delete) con cascada
   - Opción C: Permitir eliminación física con opción de cascada forzada

⚠️ **2. Recuperación**: No hay forma de "re-activar" un ingrediente eliminado físicamente
   - **Sugerencia**: Considerar implementar soft-delete por defecto

⚠️ **3. Auditoría**: No se registran los eliminados
   - **Sugerencia**: Agregar logs en audit_logs cuando se elimina un ingrediente

⚠️ **4. Permisos**: El permiso para desactivar es `inventory.create_ingredient`
   - **Sugerencia**: Debería ser `inventory.update_ingredient` o `inventory.deactivate_ingredient`

---

## 4. RECOMENDACIONES

### Inmediatas:
1. ✓ La lógica actual es SEGURA y adecuada
2. ✓ Evita pérdida de datos importante
3. ✓ Las restricciones son correctas

### Mejoras sugeridas:
1. **Cambiar permiso de desactivación** de `inventory.create_ingredient` a `inventory.update_ingredient`
2. **Agregar soft-delete**: Marcar eliminados con `deletedAt` timestamp
3. **Registrar en auditoría**: Cada eliminación debe quedar en logs
4. **Permitir cascade delete**: Con confirmación explícita del usuario

---

## 5. CONCLUSIÓN

✅ **ESTADO: CORRECTO**

La lógica es segura y funcional. Los ingredientes se pueden:
- **Desactivar**: Sin restricciones (soft-state)
- **Eliminar**: Solo si no tienen relaciones (hard-delete protegido)

Esto previene pérdida accidental de datos mientras mantiene la flexibilidad.
