import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';

const router = Router();

// La ruta completa es /api/menu, definida al montar este router.
router.get('/', MenuController.getMenu);

export default router;