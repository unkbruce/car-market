import api from '../api/api.js';

function canUseChat(profile) {
  return profile?.role === 'buyer' || profile?.role === 'dealer';
}

async function createOrGetChatRoom({ car, currentUser, profile }) {
  const response = await api.post('/api/chats/rooms', {
    carId: car._id,
    buyerId: currentUser.uid,
    buyerName: profile?.displayName || currentUser.displayName || currentUser.email,
    dealerId: car.dealerId,
    dealerName: car.dealerName || '',
    carName: car.name || '',
    uid: currentUser.uid,
  });

  return response.data.data;
}

export { canUseChat, createOrGetChatRoom };
