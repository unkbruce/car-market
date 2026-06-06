import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

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

function ChatPage() {
  const { roomId } = useParams();
  const { currentUser, profile, isAuthLoading } = useAuth();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const canUseChat = Boolean(currentUser && ['buyer', 'dealer'].includes(profile?.role));

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

      const response = await api.post(`/api/chats/rooms/${roomId}/messages`, {
        senderId: currentUser.uid,
        senderName: profile?.displayName || currentUser.displayName || currentUser.email,
        text: trimmedMessage,
      });

      setMessages((prevMessages) => [...prevMessages, response.data.data]);
      setMessageText('');
    } catch (sendError) {
      setError(sendError.response?.data?.message || '메시지 전송에 실패했습니다.');
    } finally {
      setIsSending(false);
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
            <p className="mt-1 text-sm text-slate-500">
              {room?.buyerName || '구매자'} · {room?.dealerName || '딜러'}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">저장형 상담</span>
        </div>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 sm:p-5">
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
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        isMine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      {!isMine ? <p className="mb-1 text-xs font-bold text-slate-500">{message.senderName || '상대방'}</p> : null}
                      <p className="whitespace-pre-line text-sm leading-6">{message.text}</p>
                      <p className={`mt-1 text-right text-[11px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>{formatMessageTime(message.createdAt)}</p>
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
