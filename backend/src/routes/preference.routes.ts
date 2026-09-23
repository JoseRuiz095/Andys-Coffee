import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
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
router.patch('/general', checkPermission('users.update'), upsertGeneralPreferences);

// Generic routes after
router.get('/:key', checkPermission('users.read'), getPreference);
router.patch('/:key', checkPermission('users.update'), (req, res) => updatePreference(req, res));
router.delete('/:key', checkPermission('users.delete'), deletePreference);

export default router;
