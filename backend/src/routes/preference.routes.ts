import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { checkPermission } from '../middleware/authorization';
import { listPreferences, getPreference, updatePreference, deletePreference } from '../controllers/preference.controller';

const router = Router();

router.use(requireAuth);

router.get('/', checkPermission('users.read'), listPreferences);
router.get('/:key', checkPermission('users.read'), getPreference);
router.patch('/:key', checkPermission('users.update'), (req, res) => updatePreference(req, res));
router.delete('/:key', checkPermission('users.delete'), deletePreference);

export default router;
