import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import multer from 'multer';

const router = Router();

// Configuramos multer para que guarde los archivos en memoria como un buffer.
// Esto es eficiente porque no necesitamos guardarlos en el disco del servidor.
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', ProductController.findAll);
router.get('/:id', ProductController.findOne);

// Usamos `upload.single('image')` para indicar que esperamos un solo archivo en el campo 'image'.
router.post('/', upload.single('image'), ProductController.create);
router.patch('/:id', upload.single('image'), ProductController.update);
router.delete('/:id', ProductController.remove);

export default router;