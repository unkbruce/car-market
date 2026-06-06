import { Server } from 'socket.io';
import { getAllowedOrigins } from './config/cors.js';
import { getDB } from './config/db.js';
import { saveMessageToRoom } from './controllers/chatController.js';

const onlineDealers = new Map();

async function getParticipantRoom(roomId, uid) {
  if (!roomId || !uid) {
    return null;
  }

  const room = await getDB().collection('chat_rooms').findOne({ roomId });
  return room && (room.buyerId === uid || room.dealerId === uid) ? room : null;
}

function isDealerOnline(dealerId) {
  return Boolean(dealerId && onlineDealers.has(dealerId));
}

function markDealerOnline(io, socket, dealerId) {
  if (!dealerId) {
    return;
  }

  socket.data.dealerId = dealerId;
  onlineDealers.set(dealerId, (onlineDealers.get(dealerId) || 0) + 1);
  io.emit('dealer-online', {
    dealerId,
  });
}

function markDealerOffline(io, socket) {
  const dealerId = socket.data.dealerId;

  if (!dealerId) {
    return;
  }

  socket.data.dealerId = null;
  const nextCount = (onlineDealers.get(dealerId) || 1) - 1;

  if (nextCount > 0) {
    onlineDealers.set(dealerId, nextCount);
    return;
  }

  onlineDealers.delete(dealerId);
  io.emit('dealer-offline', {
    dealerId,
  });
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
    socket.on('dealer-online', ({ uid, role } = {}) => {
      if (role !== 'dealer' || !uid) {
        return;
      }

      if (socket.data.dealerId === uid) {
        io.emit('dealer-online', {
          dealerId: uid,
        });
        return;
      }

      markDealerOnline(io, socket, uid);
    });

    socket.on('dealer-offline', () => {
      markDealerOffline(io, socket);
    });

    socket.on('join-room', async ({ roomId, uid } = {}, callback) => {
      const room = await getParticipantRoom(roomId, uid);

      if (!room) {
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
          dealerOnline: isDealerOnline(room.dealerId),
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

    socket.on('disconnect', () => {
      markDealerOffline(io, socket);
    });
  });

  return io;
}

export default setupSocket;
