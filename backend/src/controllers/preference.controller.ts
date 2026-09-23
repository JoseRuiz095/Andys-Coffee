import type { Request, Response } from 'express';
import type { z } from 'zod';
import { PreferenceService } from '../services/preference.service';
import { updatePreferenceSchema, generalPreferencesSchema } from '../validators/preference.validator';
import type { AuthUser } from '../services/auth.service';

export async function listPreferences(req: Request, res: Response) {
  const user = req.user as AuthUser;

  const preferences = await PreferenceService.getAllPreferences(user);
  return res.json({ data: preferences });
}

export async function getPreference(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const key = req.params.key as string;

  const preference = await PreferenceService.getPreference(key, user);
  return res.json({ data: preference });
}

export async function updatePreference(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const key = req.params.key as string;
  const data = updatePreferenceSchema.parse({ ...req.body, key });

  const preference = await PreferenceService.updatePreference(
    data.key,
    data.value,
    data.type,
    data.label,
    data.description,
    user
  );
  return res.json({ data: preference });
}

export async function deletePreference(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const key = req.params.key as string;

  await PreferenceService.deletePreference(key, user);
  return res.status(204).send();
}

export async function getGeneralPreferences(_req: Request, res: Response) {
  const preferences = await PreferenceService.getGeneralPreferences();
  return res.json({ data: preferences });
}

export async function upsertGeneralPreferences(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const data = req.body as z.infer<typeof generalPreferencesSchema>;

  const preferences = await PreferenceService.upsertGeneralPreferences(data, user);
  return res.json({ data: preferences });
}
