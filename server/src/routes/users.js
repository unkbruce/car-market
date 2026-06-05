import { Router } from 'express';
import { createOrUpdateUser, getDealers, getMyProfile } from '../controllers/userController.js';

const router = Router();

router.post('/', createOrUpdateUser);
router.get('/me', getMyProfile);
router.get('/dealers', getDealers);

export default router;
