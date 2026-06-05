import { Router } from 'express';
import {
  createCar,
  deleteCar,
  getCarById,
  getCars,
  searchCars,
  updateCar,
} from '../controllers/carController.js';
import upload from '../middleware/upload.js';

const router = Router();

router.get('/', getCars);
router.get('/search', searchCars);
router.get('/:id', getCarById);
router.post('/', upload.array('images', 6), createCar);
router.put('/:id', upload.array('images', 6), updateCar);
router.delete('/:id', deleteCar);

export default router;
