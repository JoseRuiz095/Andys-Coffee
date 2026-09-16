import { PreferenceRepository } from '../repositories/preference.repository';
import { AuthUser } from './auth.service';
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors';

export const PreferenceService = {
  async getAllPreferences(user: AuthUser) {
    // Only admins can view system preferences
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar preferencias del sistema.');
    }

    return PreferenceRepository.findAll();
  },

  async getPreference(key: string, user: AuthUser) {
    if (!user.permissions?.includes('users.read')) {
      throw new AuthorizationError('No tienes permiso para consultar preferencias del sistema.');
    }

    const preference = await PreferenceRepository.findByKey(key);
    if (!preference) {
      throw new NotFoundError(`Preferencia "${key}" no encontrada.`);
    }

    return preference;
  },

  async updatePreference(
    key: string,
    value: string,
    type: string = 'string',
    label?: string,
    description?: string,
    user?: AuthUser
  ) {
    // Only admins can modify system preferences
    if (!user?.permissions?.includes('users.update')) {
      throw new AuthorizationError('No tienes permiso para modificar preferencias del sistema.');
    }

    if (!key || key.trim().length === 0) {
      throw new ValidationError('La clave de preferencia es requerida.');
    }

    if (!value) {
      throw new ValidationError('El valor de preferencia es requerido.');
    }

    return PreferenceRepository.upsert(key, value, type, label, description);
  },

  async deletePreference(key: string, user?: AuthUser) {
    if (!user?.permissions?.includes('users.delete')) {
      throw new AuthorizationError('No tienes permiso para eliminar preferencias del sistema.');
    }

    const exists = await PreferenceRepository.findByKey(key);
    if (!exists) {
      throw new NotFoundError(`Preferencia "${key}" no encontrada.`);
    }

    return PreferenceRepository.delete(key);
  },
};
