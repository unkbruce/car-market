import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { canUseChat } from '../utils/chat.js';

function formatRoomTime(value) {
  if (!value) {
    return '최근 메시지 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getOtherUserName(room, currentUser) {
  if (room.buyerId === currentUser.uid) {
    return room.dealerName || '딜러';
  }

  return room.buyerName || '구매자';
}

function ChatListPage() {
  const { currentUser, profile, isAuthLoading } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leavingRoomId, setLeavingRoomId] = useState('');
  const [error, setError] = useState('');
  const hasChatPermission = Boolean(currentUser && canUseChat(profile));

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    async function fetchRooms() {
      if (!hasChatPermission) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');

        const response = await api.get('/api/chats/rooms', {
          params: {
            uid: currentUser.uid,
          },
        });

        setRooms(response.data.data || []);
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || '상담 목록을 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRooms();
  }, [currentUser, hasChatPermission, isAuthLoading]);

  async function handleLeaveRoom(event, roomId) {
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm('상담방을 나가시겠습니까? 기존 메시지는 유지됩니다.')) {
      return;
    }

    try {
      setLeavingRoomId(roomId);
      setError('');

      await api.patch(`/api/chats/rooms/${roomId}/leave`, {
        uid: currentUser.uid,
      });

      setRooms((currentRooms) => currentRooms.filter((room) => room.roomId !== roomId));
    } catch (leaveError) {
      setError(leaveError.response?.data?.message || '상담방 나가기에 실패했습니다.');
    } finally {
      setLeavingRoomId('');
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Header subtitle="상담 목록" />
        <div className="mx-auto max-w-4xl px-5 py-8">
          <StatusMessage title="상담 목록을 불러오는 중입니다" message="내 차량 상담방을 확인하고 있습니다." />
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Header subtitle="상담 목록" />
        <div className="mx-auto max-w-4xl px-5 py-8">
          <StatusMessage
            title="로그인이 필요합니다"
            message="상담 목록은 로그인한 사용자만 확인할 수 있습니다."
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

  if (!hasChatPermission) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Header subtitle="상담 목록" />
        <div className="mx-auto max-w-4xl px-5 py-8">
          <StatusMessage title="상담 권한이 없습니다" message="상담 목록은 일반 사용자 또는 딜러 계정으로 이용할 수 있습니다." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header subtitle="상담 목록" />

      <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">상담 목록</h1>
            <p className="mt-1 text-sm text-slate-500">총 {rooms.length.toLocaleString('ko-KR')}개의 상담방이 있습니다.</p>
          </div>
          <Link to="/" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            차량 목록
          </Link>
        </div>

        {error ? <StatusMessage title="상담 목록을 불러오지 못했습니다" message={error} /> : null}

        {!error && rooms.length === 0 ? (
          <StatusMessage title="아직 상담방이 없습니다" message="관심 있는 차량에서 상담하기를 눌러 대화를 시작해보세요." />
        ) : null}

        {!error && rooms.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {rooms.map((room) => (
              <Link
                key={room.roomId}
                to={`/chats/${room.roomId}`}
                className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-base font-black text-slate-950">{room.carName || '차량 상담'}</h2>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                      {getOtherUserName(room, currentUser)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">{room.lastMessage || '아직 메시지가 없습니다.'}</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <p className="text-right text-xs font-semibold text-slate-400">{formatRoomTime(room.lastMessageAt || room.updatedAt)}</p>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={(event) => handleLeaveRoom(event, room.roomId)}
                    disabled={leavingRoomId === room.roomId}
                  >
                    {leavingRoomId === room.roomId ? '나가는 중' : '나가기'}
                  </button>
                </div>
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default ChatListPage;
