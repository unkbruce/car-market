import { Router } from 'express';
import {
  createCar,
  deleteCar,
  getCarById,
  getCars,
  searchCars,
  updateCar,
} from '../controllers/carController.js';

const router = Router();

router.get('/', getCars);
router.get('/search', searchCars);
router.get('/:id', getCarById);
router.post('/', createCar);
router.put('/:id', updateCar);
router.delete('/:id', deleteCar);

export default router;
