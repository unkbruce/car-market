import { Router } from 'express';
import {
  createCar,
  deleteCar,
  getCarById,
  getCars,
  updateCar,
} from '../controllers/carController.js';

const router = Router();

router.get('/', getCars);
router.get('/:id', getCarById);
router.post('/', createCar);
router.put('/:id', updateCar);
router.delete('/:id', deleteCar);

export default router;

