import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import { saveMessageToRoom } from '../controllers/chatController.js';

async function getChatContext(roomId) {
  const db = getDB();
  const room = await db.collection('chat_rooms').findOne({ roomId });
  const car =
    room?.carId && ObjectId.isValid(room.carId)
      ? await db.collection('cars').findOne({ _id: new ObjectId(room.carId) })
      : null;
  const previousMessages = await db
    .collection('messages')
    .find({ roomId })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return {
    room,
    car,
    previousMessages: previousMessages.reverse(),
  };
}

async function generateAgentReply() {
  return null;
}

async function handleChatMessage({ payload, isDealerOnline }) {
  const { roomId, senderId, senderName, text } = payload;
  const message = await saveMessageToRoom({
    roomId,
    senderId,
    senderName,
    text,
  });

  const context = await getChatContext(roomId);

  // 딜러가 오프라인일 때 이 지점에서 차량 정보와 이전 메시지를 바탕으로 AI 상담 응답을 확장할 수 있습니다.
  const agentReply = isDealerOnline(context.room?.dealerId)
    ? null
    : await generateAgentReply({
        room: context.room,
        car: context.car,
        previousMessages: context.previousMessages,
        message,
      });

  return {
    message,
    agentReply,
  };
}

export { generateAgentReply, handleChatMessage };
