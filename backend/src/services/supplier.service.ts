import { Prisma } from '@prisma/client';
import { SupplierRepository } from '../repositories/supplier.repository';
import { AuthUser } from './auth.service';
import { AuthorizationError, ConflictError, DuplicateError, NotFoundError, ValidationError } from '../utils/errors';

export const SupplierService = {
  async findAll(user: AuthUser, page: number = 1, limit: number = 20, isActive?: boolean, search?: string) {
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver proveedores.');
    }

    const where: Prisma.SupplierWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    return SupplierRepository.findWithPagination(page, limit, where);
  },

  async findById(id: string, user: AuthUser) {
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver proveedores.');
    }

    const supplier = await SupplierRepository.findById(id);

    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    return supplier;
  },

  async search(query: string, user: AuthUser) {
    if (!user.permissions?.includes('inventory.view')) {
      throw new AuthorizationError('No tienes permiso para ver proveedores.');
    }

    if (!query || query.trim().length < 2) {
      throw new ValidationError('La búsqueda debe tener al menos 2 caracteres.');
    }

    return SupplierRepository.searchByName(query.trim(), 20);
  },

  async create(data: { name: string; phone?: string; email?: string; address?: string }, user: AuthUser) {
    if (!user.permissions?.includes('inventory.manage_suppliers')) {
      throw new AuthorizationError('No tienes permiso para crear proveedores.');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre del proveedor es requerido.');
    }

    // Check if supplier with same name already exists
    const existing = await SupplierRepository.findByNameNormalized(data.name);
    if (existing) {
      throw new DuplicateError('SUPPLIER', `Ya existe un proveedor con el nombre "${existing.name}".`, existing.id);
    }

    // Create supplier
    return SupplierRepository.create({
      name: data.name.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
    });
  },

  async update(id: string, data: { name?: string; phone?: string; email?: string; address?: string }, user: AuthUser) {
    if (!user.permissions?.includes('inventory.manage_suppliers')) {
      throw new AuthorizationError('No tienes permiso para editar proveedores.');
    }

    const supplier = await SupplierRepository.findById(id);
    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    // If name is being updated, check for duplicates
    if (data.name) {
      const normalized = data.name.trim();
      const existing = await SupplierRepository.findByNameNormalized(normalized);
      if (existing && existing.id !== id) {
        throw new DuplicateError('SUPPLIER', `Ya existe otro proveedor con el nombre "${existing.name}".`, existing.id);
      }
    }

    return SupplierRepository.update(id, {
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
    });
  },

  async setActive(id: string, isActive: boolean, user: AuthUser) {
    if (!user.permissions?.includes('inventory.manage_suppliers')) {
      throw new AuthorizationError('No tienes permiso para modificar proveedores.');
    }

    const supplier = await SupplierRepository.findById(id);
    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    return SupplierRepository.setActive(id, isActive);
  },

  async deleteSupplier(id: string, user: AuthUser) {
    if (!user.permissions?.includes('inventory.delete_supplier')) {
      throw new AuthorizationError('No tienes permiso para eliminar proveedores.');
    }

    const supplier = await SupplierRepository.findById(id);
    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    // Check for related records
    const counts = await SupplierRepository.countRelations(id);
    if (counts && counts.purchases > 0) {
      throw new ConflictError(
        `No se puede eliminar: el proveedor tiene ${counts.purchases} compra(s) registrada(s). Desactívalo en su lugar.`
      );
    }

    return SupplierRepository.delete(id);
  },
};
