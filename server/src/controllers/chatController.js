import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';

const CHAT_ROOMS_COLLECTION = 'chat_rooms';
const MESSAGES_COLLECTION = 'messages';
const CARS_COLLECTION = 'cars';

function getChatRoomsCollection() {
  return getDB().collection(CHAT_ROOMS_COLLECTION);
}

function getMessagesCollection() {
  return getDB().collection(MESSAGES_COLLECTION);
}

function getCarsCollection() {
  return getDB().collection(CARS_COLLECTION);
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

function buildRoomId(carId, buyerId, dealerId) {
  return `${carId}_${buyerId}_${dealerId}`;
}

function isRoomParticipant(room, uid) {
  return Boolean(uid && room && (room.buyerId === uid || room.dealerId === uid));
}

export async function createOrGetRoom(req, res) {
  try {
    const { carId, buyerId, buyerName, dealerId } = req.body;

    if (!carId || !buyerId || !dealerId) {
      return sendError(res, 400, 'carId, buyerId, and dealerId are required.');
    }

    const roomId = buildRoomId(carId, buyerId, dealerId);
    const now = new Date();
    const car = ObjectId.isValid(carId) ? await getCarsCollection().findOne({ _id: new ObjectId(carId) }) : null;
    const result = await getChatRoomsCollection().findOneAndUpdate(
      { roomId },
      {
        $set: {
          carId,
          buyerId,
          dealerId,
          carName: car?.name || req.body.carName || '',
          buyerName: buyerName?.trim() || req.body.buyerName || '',
          dealerName: car?.dealerName || req.body.dealerName || '',
          updatedAt: now,
        },
        $setOnInsert: {
          roomId,
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    return res.status(201).json({
      success: true,
      data: result?.value || result,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function getMyRooms(req, res) {
  try {
    const uid = req.query.uid?.trim();

    if (!uid) {
      return sendError(res, 400, 'uid query parameter is required.');
    }

    const rooms = await getChatRoomsCollection()
      .find({
        $or: [{ buyerId: uid }, { dealerId: uid }],
      })
      .sort({ updatedAt: -1 })
      .toArray();

    return res.json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function getRoomMessages(req, res) {
  try {
    const { roomId } = req.params;
    const uid = req.query.uid?.trim();

    if (!uid) {
      return sendError(res, 400, 'uid query parameter is required.');
    }

    const room = await getChatRoomsCollection().findOne({ roomId });

    if (!room) {
      return sendError(res, 404, 'Chat room not found.');
    }

    if (!isRoomParticipant(room, uid)) {
      return sendError(res, 403, 'You can only view your own chat room.');
    }

    const messages = await getMessagesCollection().find({ roomId }).sort({ createdAt: 1 }).toArray();

    return res.json({
      success: true,
      data: {
        room,
        messages,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

export async function createMessage(req, res) {
  try {
    const { roomId } = req.params;
    const { senderId, senderName, text } = req.body;

    if (!senderId || !text?.trim()) {
      return sendError(res, 400, 'senderId and text are required.');
    }

    const room = await getChatRoomsCollection().findOne({ roomId });

    if (!room) {
      return sendError(res, 404, 'Chat room not found.');
    }

    if (!isRoomParticipant(room, senderId)) {
      return sendError(res, 403, 'You can only send messages to your own chat room.');
    }

    const now = new Date();
    const newMessage = {
      roomId,
      senderId,
      senderName: senderName?.trim() || '',
      text: text.trim(),
      createdAt: now,
    };
    const result = await getMessagesCollection().insertOne(newMessage);

    await getChatRoomsCollection().updateOne(
      { roomId },
      {
        $set: {
          lastMessage: newMessage.text,
          lastMessageAt: now,
          updatedAt: now,
        },
      },
    );

    return res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        ...newMessage,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}
