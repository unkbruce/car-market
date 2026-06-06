import { Server } from 'socket.io';
import { getAllowedOrigins } from './config/cors.js';
import { getDB } from './config/db.js';
import { saveMessageToRoom } from './controllers/chatController.js';

async function isRoomParticipant(roomId, uid) {
  if (!roomId || !uid) {
    return false;
  }

  const room = await getDB().collection('chat_rooms').findOne({ roomId });
  return Boolean(room && (room.buyerId === uid || room.dealerId === uid));
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomId, uid } = {}, callback) => {
      if (!(await isRoomParticipant(roomId, uid))) {
        if (typeof callback === 'function') {
          callback({
            success: false,
            message: 'You can only join your own chat room.',
          });
        }
        return;
      }

      socket.join(roomId);

      if (typeof callback === 'function') {
        callback({
          success: true,
        });
      }
    });

    socket.on('leave-room', ({ roomId } = {}) => {
      if (!roomId) {
        return;
      }

      socket.leave(roomId);
    });

    socket.on('send-message', async (payload = {}, callback) => {
      try {
        const { roomId, senderId, senderName, text } = payload;
        const message = await saveMessageToRoom({
          roomId,
          senderId,
          senderName,
          text,
        });

        io.to(roomId).emit('receive-message', message);

        if (typeof callback === 'function') {
          callback({
            success: true,
            data: message,
          });
        }
      } catch (error) {
        if (typeof callback === 'function') {
          callback({
            success: false,
            message: error.message,
          });
        }
      }
    });
  });

  return io;
}

export default setupSocket;
