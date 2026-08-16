import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';

const router = Router();

router.get('/', MenuController.getMenuItems);

export default router;