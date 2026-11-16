import { SETTINGS_PERMISSION } from '../config/permissions';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { validate } from '../middleware/validate';
import { generalPreferencesSchema } from '../validators/preference.validator';
import {
  listPreferences,
  getPreference,
  updatePreference,
  deletePreference,
  getGeneralPreferences,
  upsertGeneralPreferences,
} from '../controllers/preference.controller';

const router = Router();

// Public, read-only business profile (login screen, every role) — see PreferenceService (N-02).
router.get('/general', getGeneralPreferences);

router.use(requireAuth);

// Specific routes first (avoid /:key matching /general)
router.get('/', checkPermission('users.read'), listPreferences);
router.patch('/general', checkPermission(SETTINGS_PERMISSION), validate(generalPreferencesSchema), upsertGeneralPreferences);

// Generic routes after
router.get('/:key', checkPermission('users.read'), getPreference);
// The controller validates this one: the key comes from the URL and is part of the schema.
router.patch('/:key', checkPermission(SETTINGS_PERMISSION), updatePreference);
router.delete('/:key', checkPermission(SETTINGS_PERMISSION), deletePreference);

export default router;
