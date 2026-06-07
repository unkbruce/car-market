import { Router } from 'express';
import { createMessage, createOrGetRoom, getMyRooms, getRoomMessages, leaveRoom } from '../controllers/chatController.js';

const router = Router();

router.post('/rooms', createOrGetRoom);
router.get('/rooms', getMyRooms);
router.patch('/rooms/:roomId/leave', leaveRoom);
router.get('/rooms/:roomId/messages', getRoomMessages);
router.post('/rooms/:roomId/messages', createMessage);

export default router;
