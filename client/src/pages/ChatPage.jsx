import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/api.js';
import socket from '../api/socket.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { canUseChat as canProfileUseChat } from '../utils/chat.js';

function formatMessageTime(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getMessageKey(message) {
  return message?._id || `${message?.roomId}-${message?.senderId}-${message?.createdAt}-${message?.text}`;
}

function appendMessageIfNew(currentMessages, nextMessage) {
  const nextMessageKey = getMessageKey(nextMessage);
  const hasSameMessage = currentMessages.some((message) => getMessageKey(message) === nextMessageKey);

  if (hasSameMessage) {
    return currentMessages;
  }

  return [...currentMessages, nextMessage];
}

function getCounterpartLabel(room, currentUser, isDealerOnline) {
  if (!room || !currentUser) {
    return null;
  }

  if (currentUser.uid === room.dealerId) {
    return {
      label: `구매자 ${room.buyerName || '이름 미정'}`,
      showDealerStatus: false,
    };
  }

  return {
    label: `딜러 ${room.dealerName || '이름 미정'}`,
    showDealerStatus: true,
    statusText: isDealerOnline ? '온라인' : '오프라인',
  };
}

function ChatPage() {
  const { roomId } = useParams();
  const { currentUser, profile, isAuthLoading } = useAuth();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDealerOnline, setIsDealerOnline] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const canUseChat = Boolean(currentUser && canProfileUseChat(profile));
  const dealerId = room?.dealerId;
  const counterpart = getCounterpartLabel(room, currentUser, isDealerOnline);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    async function fetchMessages() {
      if (!canUseChat) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        const response = await api.get(`/api/chats/rooms/${roomId}/messages`, {
          params: {
            uid: currentUser.uid,
          },
        });

        setRoom(response.data.data.room);
        setMessages(response.data.data.messages || []);
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || '상담 메시지를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMessages();
  }, [canUseChat, currentUser, isAuthLoading, roomId]);

  useEffect(() => {
    if (!canUseChat || !currentUser || isAuthLoading) {
      return undefined;
    }

    function handleReceiveMessage(message) {
      if (message.roomId !== roomId) {
        return;
      }

      setMessages((currentMessages) => appendMessageIfNew(currentMessages, message));
    }

    function handleDealerOnline({ dealerId: onlineDealerId } = {}) {
      if (onlineDealerId === dealerId) {
        setIsDealerOnline(true);
      }
    }

    function handleDealerOffline({ dealerId: offlineDealerId } = {}) {
      if (offlineDealerId === dealerId) {
        setIsDealerOnline(false);
      }
    }

    function handleConnect() {
      if (profile?.role === 'dealer') {
        socket.emit('dealer-online', {
          uid: currentUser.uid,
          role: profile.role,
        });
      }

      socket.emit(
        'join-room',
        {
          roomId,
          uid: currentUser.uid,
        },
        (response) => {
          if (!response?.success) {
            setError(response?.message || '상담방에 입장하지 못했습니다.');
            return;
          }

          setIsDealerOnline(Boolean(response.dealerOnline));
        },
      );
    }

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('dealer-online', handleDealerOnline);
    socket.on('dealer-offline', handleDealerOffline);

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    return () => {
      socket.emit('leave-room', {
        roomId,
        uid: currentUser.uid,
      });
      if (profile?.role === 'dealer') {
        socket.emit('dealer-offline', {
          uid: currentUser.uid,
        });
      }
      socket.off('receive-message', handleReceiveMessage);
      socket.off('dealer-online', handleDealerOnline);
      socket.off('dealer-offline', handleDealerOffline);
      socket.off('connect', handleConnect);
      socket.disconnect();
    };
  }, [canUseChat, currentUser, dealerId, isAuthLoading, profile, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || !currentUser) {
      return;
    }

    try {
      setIsSending(true);
      setError('');

      socket.emit('send-message', {
        roomId,
        senderId: currentUser.uid,
        senderName: profile?.displayName || currentUser.displayName || currentUser.email,
        text: trimmedMessage,
      }, (response) => {
        setIsSending(false);

        if (!response?.success) {
          setError(response?.message || '메시지 전송에 실패했습니다.');
          return;
        }

        setMessageText('');
      });
    } catch {
      setIsSending(false);
      setError('메시지 전송에 실패했습니다.');
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Header subtitle="상담" />
        <div className="mx-auto max-w-4xl px-5 py-8">
          <StatusMessage title="상담방을 불러오는 중입니다" message="저장된 메시지와 상담방 정보를 확인하고 있습니다." />
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Header subtitle="상담" />
        <div className="mx-auto max-w-4xl px-5 py-8">
          <StatusMessage
            title="로그인이 필요합니다"
            message="상담방은 로그인한 사용자만 입장할 수 있습니다."
            action={
              <Link className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white" to="/login">
                로그인하기
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  if (!canUseChat) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Header subtitle="상담" />
        <div className="mx-auto max-w-4xl px-5 py-8">
          <StatusMessage title="상담 권한이 없습니다" message="상담 기능은 일반 사용자 또는 딜러 계정으로 이용할 수 있습니다." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header subtitle="상담" />

      <div className="mx-auto flex max-w-4xl flex-col px-5 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={room?.carId ? `/cars/${room.carId}` : '/'} className="text-sm font-bold text-blue-600 hover:text-blue-700">
              매물 상세로 돌아가기
            </Link>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{room?.carName || '차량 상담'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{counterpart?.label || '상대방 정보 확인 중'}</span>
              {counterpart?.showDealerStatus ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className={`h-2.5 w-2.5 rounded-full ${isDealerOnline ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
                  {counterpart.statusText}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">실시간 상담</span>
          </div>
        </div>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
          <div className="flex-1 space-y-3.5 overflow-y-auto bg-slate-50/70 p-4 sm:p-5">
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p> : null}
            {messages.length === 0 ? (
              <div className="grid h-full min-h-[360px] place-items-center text-center">
                <div>
                  <p className="text-base font-bold text-slate-800">아직 메시지가 없습니다</p>
                  <p className="mt-2 text-sm text-slate-500">첫 메시지를 보내 상담을 시작해보세요.</p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isMine = message.senderId === currentUser.uid;

                return (
                  <div key={message._id || `${message.senderId}-${message.createdAt}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine ? <p className="mb-1 px-1 text-[11px] font-bold text-slate-500">{message.senderName || '상대방'}</p> : null}
                      <div
                        className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                          isMine ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                      </div>
                      <p className={`mt-1 px-1 text-[11px] ${isMine ? 'text-slate-400' : 'text-slate-400'}`}>{formatMessageTime(message.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="flex gap-2 border-t border-slate-200 bg-white p-3 sm:p-4" onSubmit={handleSubmit}>
            <textarea
              className="min-h-11 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="메시지를 입력하세요"
              rows={1}
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSending || !messageText.trim()}
            >
              {isSending ? '전송 중' : '전송'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default ChatPage;
