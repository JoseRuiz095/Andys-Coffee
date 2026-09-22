import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { RoleRepository } from '../repositories/role.repository';
import { AuthUser } from './auth.service';
import { AuthorizationError, ConflictError, DuplicateError, NotFoundError, ValidationError } from '../utils/errors';

/**
 * An actor may only give a user a role whose permissions the actor already holds —
 * the same rule RoleService.assignPermissions applies — so users.create/users.update
 * can't be used to mint an account more privileged than the actor (e.g. an ADMIN).
 */
async function assertCanAssignRole(roleId: string, actor: AuthUser) {
  const role = await RoleRepository.findById(roleId);
  if (!role) {
    throw new ValidationError('El rol indicado no existe.');
  }
  const missing = role.permissions
    .map(({ permission }) => permission.name)
    .filter((name) => !actor.permissions?.includes(name));
  if (missing.length > 0) {
    throw new AuthorizationError(`No puedes asignar el rol "${role.name}" porque incluye permisos que no tienes.`);
  }
}

export const UserService = {
  async findAll(user: AuthUser, page: number = 1, limit: number = 20, isActive?: boolean, search?: string, roleId?: string) {
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar usuarios.');
    }

    const where: Prisma.UserWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleId) {
      where.roleId = roleId;
    }

    return UserRepository.findWithPagination(page, limit, where);
  },

  async findById(id: string, user: AuthUser) {
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar usuarios.');
    }

    const foundUser = await UserRepository.findById(id);

    if (!foundUser) {
      throw new NotFoundError('Usuario no encontrado.');
    }

    return foundUser;
  },

  async create(data: { name: string; email: string; password: string; roleId: string }, user: AuthUser) {
    if (!user.permissions?.includes('users.create')) {
      throw new AuthorizationError('No tienes permiso para crear usuarios.');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre del usuario es requerido.');
    }

    if (!data.email || data.email.trim().length === 0) {
      throw new ValidationError('El email del usuario es requerido.');
    }

    await assertCanAssignRole(data.roleId, user);

    // Check if user with same email already exists
    const existing = await UserRepository.findByEmailNormalized(data.email);
    if (existing) {
      throw new DuplicateError('USER', `Ya existe un usuario con el email "${existing.email}".`, existing.id);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    return UserRepository.create({
      name: data.name.trim(),
      email: data.email.trim(),
      passwordHash,
      roleId: data.roleId,
    });
  },

  async update(id: string, data: { name?: string; email?: string; roleId?: string }, user: AuthUser) {
    if (!user.permissions?.includes('users.update')) {
      throw new AuthorizationError('No tienes permiso para actualizar usuarios.');
    }

    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundError('Usuario no encontrado.');
    }

    // Prevent self role change
    if (data.roleId && id === user.id) {
      throw new ValidationError('No puedes cambiar tu propio rol.');
    }

    if (data.roleId && data.roleId !== existingUser.roleId) {
      await assertCanAssignRole(data.roleId, user);
    }

    // If email is being updated, check for duplicates
    if (data.email) {
      const normalized = data.email.trim();
      const duplicate = await UserRepository.findByEmailNormalized(normalized);
      if (duplicate && duplicate.id !== id) {
        throw new DuplicateError('USER', `Ya existe otro usuario con el email "${duplicate.email}".`, duplicate.id);
      }
    }

    // If changing roleId away from ADMIN and is the last active admin, prevent
    if (data.roleId && existingUser.role?.name === 'ADMIN' && data.roleId !== existingUser.roleId) {
      const activeAdminCount = await UserRepository.countActiveAdmins(existingUser.roleId);
      if (activeAdminCount <= 1) {
        throw new ConflictError('No se puede cambiar el rol del último administrador activo.');
      }
    }

    return UserRepository.update(id, {
      name: data.name,
      email: data.email,
      roleId: data.roleId,
    });
  },

  async setActive(id: string, isActive: boolean, user: AuthUser) {
    if (!user.permissions?.includes('users.update')) {
      throw new AuthorizationError('No tienes permiso para modificar usuarios.');
    }

    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundError('Usuario no encontrado.');
    }

    // Prevent self-deactivation
    if (!isActive && id === user.id) {
      throw new ValidationError('No puedes desactivar tu propia cuenta.');
    }

    // Prevent deactivating the last active admin
    if (!isActive && existingUser.role?.name === 'ADMIN') {
      const activeAdminCount = await UserRepository.countActiveAdmins(existingUser.roleId);
      if (activeAdminCount <= 1) {
        throw new ConflictError('No puedes desactivar al último administrador activo.');
      }
    }

    return UserRepository.setActive(id, isActive);
  },

  async deleteUser(id: string, user: AuthUser) {
    if (!user.permissions?.includes('users.delete')) {
      throw new AuthorizationError('No tienes permiso para eliminar usuarios.');
    }

    const existingUser = await UserRepository.findById(id);
    if (!existingUser) {
      throw new NotFoundError('Usuario no encontrado.');
    }

    // Prevent self-deletion
    if (id === user.id) {
      throw new ValidationError('No puedes eliminar tu propia cuenta.');
    }

    // Prevent deleting the last active admin
    if (existingUser.role?.name === 'ADMIN') {
      const activeAdminCount = await UserRepository.countActiveAdmins(existingUser.roleId);
      if (activeAdminCount <= 1) {
        throw new ConflictError('No puedes eliminar al último administrador activo.');
      }
    }

    // Prevent deleting a user with existing history (orders, purchases, movements, etc.)
    const counts = await UserRepository.countRelations(id);
    if (counts && Object.values(counts).some((count) => count > 0)) {
      throw new ConflictError(
        'No se puede eliminar: el usuario tiene historial de actividad registrado. Desactívalo en su lugar.'
      );
    }

    return UserRepository.delete(id);
  },

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await UserRepository.findByIdWithPasswordHash(userId);

    if (!user || !user.isActive) {
      throw new NotFoundError('Usuario no encontrado.');
    }

    // Verify current password
    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthorizationError('La contraseña actual no es correcta.');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    return UserRepository.updatePasswordHash(userId, newPasswordHash);
  },

  async updateOwnProfile(userId: string, data: { name: string }) {
    const user = await UserRepository.findById(userId);

    if (!user || !user.isActive) {
      throw new NotFoundError('Usuario no encontrado.');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre es requerido.');
    }

    return UserRepository.update(userId, {
      name: data.name.trim(),
    });
  },
};
