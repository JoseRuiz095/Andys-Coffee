-- Fase 1: Prevención de Duplicados en Ingredientes y Proveedores
-- Objetivo: Evitar registros duplicados mediante índices UNIQUE normalizados

-- ============================================================================
-- ÍNDICE UNIQUE NORMALIZADO PARA INGREDIENTES
-- ============================================================================
-- Asegura que no existan dos ingredientes con el mismo nombre (case-insensitive, trimmed)
-- Solo aplica a ingredientes activos para permitir "archivar" un registro
-- PREREQUISITO: Auditar e consolidar duplicados existentes antes de aplicar

CREATE UNIQUE INDEX IF NOT EXISTS "ingredients_name_normalized_unique"
ON "ingredients"(LOWER(TRIM("name")))
WHERE "isActive" = true;

-- ============================================================================
-- ÍNDICE UNIQUE NORMALIZADO PARA PROVEEDORES
-- ============================================================================
-- Asegura que no existan dos proveedores con el mismo nombre (case-insensitive, trimmed)
-- Solo aplica a proveedores activos

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_name_normalized_unique"
ON "suppliers"(LOWER(TRIM("name")))
WHERE "isActive" = true;

-- ============================================================================
-- ÍNDICE PARA BÚSQUEDA RÁPIDA DE INGREDIENTES POR NOMBRE
-- ============================================================================
-- Mejora la velocidad de búsqueda por nombre sin constraints UNIQUE
-- Permite búsquedas de ingredientes inactivos o en búsqueda fuzzy

CREATE INDEX IF NOT EXISTS "ingredients_name_search_idx"
ON "ingredients"(LOWER(TRIM("name")))
WHERE "isActive" = true;

-- ============================================================================
-- ÍNDICE PARA BÚSQUEDA RÁPIDA DE PROVEEDORES POR NOMBRE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "suppliers_name_search_idx"
ON "suppliers"(LOWER(TRIM("name")))
WHERE "isActive" = true;
