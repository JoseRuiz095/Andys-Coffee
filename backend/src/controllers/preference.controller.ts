import type { Request, Response } from 'express';
import { PreferenceService } from '../services/preference.service';
import { preferenceSchema, updatePreferenceSchema, generalPreferencesSchema } from '../validators/preference.validator';
import type { AuthUser } from '../services/auth.service';

export async function listPreferences(req: Request, res: Response) {
  const user = req.user as AuthUser;

  try {
    const preferences = await PreferenceService.getAllPreferences(user);
    return res.json({ data: preferences });
  } catch (error: any) {
    if (error.name === 'AuthorizationError') {
      return res.status(403).json({ message: error.message, statusCode: 403 });
    }
    throw error;
  }
}

export async function getPreference(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const key = req.params.key as string;

  try {
    const preference = await PreferenceService.getPreference(key, user);
    return res.json({ data: preference });
  } catch (error: any) {
    if (error.name === 'AuthorizationError') {
      return res.status(403).json({ message: error.message, statusCode: 403 });
    }
    if (error.name === 'NotFoundError') {
      return res.status(404).json({ message: error.message, statusCode: 404 });
    }
    throw error;
  }
}

export async function updatePreference(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const key = req.params.key as string;
  const data = updatePreferenceSchema.parse({ ...req.body, key });

  try {
    const preference = await PreferenceService.updatePreference(
      data.key,
      data.value,
      data.type,
      data.label,
      data.description,
      user
    );
    return res.json({ data: preference });
  } catch (error: any) {
    if (error.name === 'AuthorizationError') {
      return res.status(403).json({ message: error.message, statusCode: 403 });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message, statusCode: 400 });
    }
    throw error;
  }
}

export async function deletePreference(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const key = req.params.key as string;

  try {
    await PreferenceService.deletePreference(key, user);
    return res.status(204).send();
  } catch (error: any) {
    if (error.name === 'AuthorizationError') {
      return res.status(403).json({ message: error.message, statusCode: 403 });
    }
    if (error.name === 'NotFoundError') {
      return res.status(404).json({ message: error.message, statusCode: 404 });
    }
    throw error;
  }
}

export async function getGeneralPreferences(req: Request, res: Response) {
  const user = req.user as AuthUser;

  try {
    const preferences = await PreferenceService.getGeneralPreferences(user);
    return res.json({ data: preferences });
  } catch (error: any) {
    if (error.name === 'AuthorizationError') {
      return res.status(403).json({ message: error.message, statusCode: 403 });
    }
    throw error;
  }
}

export async function upsertGeneralPreferences(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const data = generalPreferencesSchema.parse(req.body);

  try {
    const preferences = await PreferenceService.upsertGeneralPreferences(data, user);
    return res.json({ data: preferences });
  } catch (error: any) {
    if (error.name === 'AuthorizationError') {
      return res.status(403).json({ message: error.message, statusCode: 403 });
    }
    throw error;
  }
}
