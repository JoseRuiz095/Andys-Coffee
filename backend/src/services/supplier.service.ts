import { SupplierRepository } from '../repositories/supplier.repository';
import { AuthUser } from './auth.service';

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthorizationError extends Error {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const SupplierService = {
  async findAll(user: AuthUser, page: number = 1, limit: number = 20) {
    // No requiere permiso especial — información pública de proveedores
    return SupplierRepository.findWithPagination(page, limit, { isActive: true });
  },

  async findById(id: string, user: AuthUser) {
    const supplier = await SupplierRepository.findById(id);

    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    return supplier;
  },

  async search(query: string, user: AuthUser) {
    if (!query || query.trim().length < 2) {
      throw new ValidationError('La búsqueda debe tener al menos 2 caracteres.');
    }

    return SupplierRepository.searchByName(query.trim(), 20);
  },

  async create(data: { name: string; phone?: string; email?: string; address?: string }, user: AuthUser) {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre del proveedor es requerido.');
    }

    // Check if supplier with same name already exists
    const existing = await SupplierRepository.findByNameNormalized(data.name);
    if (existing) {
      throw new ValidationError(`Ya existe un proveedor con el nombre "${existing.name}".`);
    }

    // Create supplier
    return SupplierRepository.create({
      name: data.name.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
    });
  },
};
