import { RoleRepository, PermissionRepository } from '../repositories/role.repository';
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

class DuplicateError extends Error {
  public readonly type: 'ROLE';
  public readonly existingId: string;

  constructor(message: string, existingId: string) {
    super(message);
    this.name = 'DuplicateError';
    this.type = 'ROLE';
    this.existingId = existingId;
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export const RoleService = {
  async findAll(user: AuthUser) {
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar roles.');
    }

    return RoleRepository.findAll();
  },

  async findById(id: string, user: AuthUser) {
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar roles.');
    }

    const role = await RoleRepository.findById(id);

    if (!role) {
      throw new NotFoundError('Rol no encontrado.');
    }

    return role;
  },

  async create(data: { name: string; description?: string }, user: AuthUser) {
    if (!user.permissions?.includes('users.create')) {
      throw new AuthorizationError('No tienes permiso para crear roles.');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('El nombre del rol es requerido.');
    }

    // Check if role with same name already exists
    const existing = await RoleRepository.findByNameNormalized(data.name);
    if (existing) {
      throw new DuplicateError(`Ya existe un rol con el nombre "${existing.name}".`, existing.id);
    }

    return RoleRepository.create({
      name: data.name.trim(),
      description: data.description?.trim(),
    });
  },

  async update(id: string, data: { name?: string; description?: string }, user: AuthUser) {
    if (!user.permissions?.includes('users.update')) {
      throw new AuthorizationError('No tienes permiso para actualizar roles.');
    }

    const existingRole = await RoleRepository.findById(id);
    if (!existingRole) {
      throw new NotFoundError('Rol no encontrado.');
    }

    // Prevent renaming built-in roles (using isSystem flag)
    if (data.name && existingRole.name !== data.name) {
      if (existingRole.isSystem) {
        throw new ValidationError('No se puede renombrar un rol del sistema.');
      }

      // Check for duplicate names on rename
      const normalized = data.name.trim();
      const duplicate = await RoleRepository.findByNameNormalized(normalized);
      if (duplicate && duplicate.id !== id) {
        throw new DuplicateError(`Ya existe otro rol con el nombre "${duplicate.name}".`, duplicate.id);
      }
    }

    return RoleRepository.update(id, {
      name: data.name,
      description: data.description,
    });
  },

  async deleteRole(id: string, user: AuthUser) {
    if (!user.permissions?.includes('users.delete')) {
      throw new AuthorizationError('No tienes permiso para eliminar roles.');
    }

    const existingRole = await RoleRepository.findById(id);
    if (!existingRole) {
      throw new NotFoundError('Rol no encontrado.');
    }

    // Prevent deleting built-in roles
    if (existingRole.isSystem) {
      throw new ValidationError('No se puede eliminar un rol del sistema.');
    }

    // Check if role has users assigned
    const userCount = await RoleRepository.countUsersWithRole(id);
    if (userCount > 0) {
      throw new ConflictError(
        `No se puede eliminar: el rol tiene ${userCount} usuario(s) asignado(s). Asigne los usuarios a otro rol primero.`
      );
    }

    return RoleRepository.delete(id);
  },

  async assignPermissions(roleId: string, permissionIds: string[], user: AuthUser) {
    if (!user.permissions?.includes('users.update')) {
      throw new AuthorizationError('No tienes permiso para asignar permisos.');
    }

    const existingRole = await RoleRepository.findById(roleId);
    if (!existingRole) {
      throw new NotFoundError('Rol no encontrado.');
    }

    // Prevent modifying system role permissions unless you have explicit permission
    if (existingRole.isSystem) {
      if (!user.permissions?.includes('roles.manage_system_permissions')) {
        throw new AuthorizationError('No tienes permiso para modificar los permisos de los roles del sistema.');
      }
    }

    // Validate that all permission IDs exist and that actor possesses each permission
    if (permissionIds.length > 0) {
      const allPermissions = await PermissionRepository.findAll();
      const allPermissionIds = new Set(allPermissions.map((p) => p.id));
      const allPermissionNames = new Map(allPermissions.map((p) => [p.id, p.name]));

      for (const permissionId of permissionIds) {
        if (!allPermissionIds.has(permissionId)) {
          throw new ValidationError(`El permiso con ID "${permissionId}" no existe.`);
        }

        // Check that actor possesses this permission
        const permissionName = allPermissionNames.get(permissionId);
        if (permissionName && !user.permissions?.includes(permissionName)) {
          throw new AuthorizationError(`No tienes el permiso "${permissionName}" que intentas otorgar.`);
        }
      }
    }

    return RoleRepository.replacePermissions(roleId, permissionIds);
  },

  async listPermissions(user: AuthUser) {
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar permisos.');
    }

    return PermissionRepository.findAll();
  },
};
