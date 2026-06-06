import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import CarImagePlaceholder from '../components/CarImagePlaceholder.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { canUseChat, createOrGetChatRoom } from '../utils/chat.js';
import { formatDistance, formatFuel, formatPrice } from '../utils/formatters.js';

function SpecItem({ label, value }) {
  return (
    <div className="border-b border-slate-100 py-3.5">
      <p className="text-[12px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value || '-'}</p>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900">{value || '-'}</p>
    </div>
  );
}

function getCarImages(car) {
  if (Array.isArray(car.imageUrls) && car.imageUrls.length > 0) {
    return car.imageUrls.slice(0, 8);
  }

  if (car.imageUrl) {
    return [car.imageUrl];
  }

  return [];
}

function CarDetailImage({ car }) {
  const [hasImageError, setHasImageError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const images = getCarImages(car);
  const selectedImage = images[selectedIndex] || images[0];

  if (!selectedImage || hasImageError) {
    return <CarImagePlaceholder company={car.company} name={car.name} large />;
  }

  return (
    <div>
      <div className="relative flex aspect-[4/3] min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] sm:min-h-[360px] lg:min-h-[420px]">
        <img
          src={selectedImage}
          alt={car.name || '차량 이미지'}
          className="h-full w-full object-contain object-center"
          onError={() => {
            setHasImageError(true);
          }}
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((imageUrl, index) => (
            <button
              key={imageUrl}
              type="button"
              className={`aspect-[4/3] overflow-hidden rounded-lg border bg-white transition ${
                selectedIndex === index ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-200'
              }`}
              onClick={() => {
                setSelectedIndex(index);
                setHasImageError(false);
              }}
            >
              <img src={imageUrl} alt={`${car.name || '차량 이미지'} ${index + 1}`} className="h-full w-full object-contain object-center" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CarDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, profile, isAuthLoading } = useAuth();
  const [car, setCar] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChatStarting, setIsChatStarting] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    async function fetchCar() {
      try {
        setIsLoading(true);
        setError('');

        const response = await api.get(`/api/cars/${id}`);
        setCar(response.data.data);
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || '차량 상세 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCar();
  }, [id]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 py-10">
        <div className="mx-auto max-w-5xl">
          <StatusMessage title="차량 상세 정보를 불러오는 중입니다" message="선택한 매물 정보를 확인하고 있습니다." />
        </div>
      </main>
    );
  }

  if (error || !car) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 py-10">
        <div className="mx-auto max-w-5xl">
          <StatusMessage
            title="차량 정보를 찾을 수 없습니다"
            message={error || '요청한 차량 정보가 존재하지 않습니다.'}
            action={
              <Link className="inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white" to="/">
                목록으로 돌아가기
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const shortId = car._id ? car._id.slice(-6).toUpperCase() : '-';
  const canManageCar = profile?.role === 'dealer' && currentUser?.uid && car.dealerId === currentUser.uid;

  async function handleDelete() {
    if (!window.confirm('정말 이 차량을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setIsDeleting(true);
      setActionError('');
      await api.delete(`/api/cars/${car._id}`, {
        params: {
          uid: currentUser.uid,
        },
      });
      navigate('/');
    } catch (deleteError) {
      setActionError(deleteError.response?.data?.message || '차량 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleStartChat() {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (isAuthLoading) {
      setActionError('사용자 정보를 확인하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const hasChatPermission = canUseChat(profile);

    if (!hasChatPermission) {
      console.warn('Chat permission denied', {
        uid: currentUser.uid,
        role: profile?.role,
      });
      setActionError('상담은 로그인한 일반 사용자 또는 딜러만 이용할 수 있습니다.');
      return;
    }

    if (!car.dealerId) {
      setActionError('딜러 정보가 없어 상담방을 만들 수 없습니다.');
      return;
    }

    if (car.dealerId === currentUser.uid) {
      setActionError('본인이 등록한 차량은 상담방을 만들 수 없습니다.');
      return;
    }

    try {
      setIsChatStarting(true);
      setActionError('');

      const room = await createOrGetChatRoom({ car, currentUser, profile });

      navigate(`/chats/${room.roomId}`);
    } catch (chatError) {
      setActionError(chatError.response?.data?.message || '상담방을 만들지 못했습니다.');
    } finally {
      setIsChatStarting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header subtitle="매물 상세" />

      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-4 sm:px-5 lg:px-6 lg:pt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <Link to="/" className="font-bold text-slate-700 hover:text-blue-700">전체 매물</Link>
          <span>/</span>
          <span>{car.company || '제조사'}</span>
        </div>

        <section className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0">
            <CarDetailImage car={car} />

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <div className="border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">주요 스펙</h2>
                  <p className="mt-1 text-xs text-slate-500">매물 정보를 한눈에 확인하세요.</p>
                </div>
              </div>

              <div className="mt-1 grid gap-x-8 md:grid-cols-2">
                <SpecItem label="제조사" value={car.company} />
                <SpecItem label="연식" value={car.year ? `${car.year}년식` : '-'} />
                <SpecItem label="차종" value={car.type} />
                <SpecItem label="연료" value={formatFuel(car.fuel)} />
                <SpecItem label="주행거리" value={formatDistance(car.mileage)} />
                <SpecItem label="지역" value={car.location || '지역 미정'} />
                <SpecItem label="딜러" value={car.dealerName || '담당 딜러 배정 예정'} />
                <SpecItem label="상태" value="상담 가능" />
              </div>
            </section>

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-black text-slate-950">상세 설명</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {car.description || '등록된 상세 설명이 없습니다. 상담하기를 통해 차량 상태와 방문 가능 일정을 확인해보세요.'}
              </p>
            </section>
          </div>

          <aside className="lg:sticky lg:top-20">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-blue-700">{car.company || '제조사'}</p>
                  <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-slate-950">{car.name}</h1>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">상담 가능</span>
              </div>

              <div className="mt-5 border-y border-slate-100 py-4">
                <p className="text-xs font-semibold text-slate-500">판매가</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{formatPrice(car.price)}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <SummaryItem label="연식" value={car.year ? `${car.year}년식` : '-'} />
                  <SummaryItem label="주행거리" value={formatDistance(car.mileage)} />
                  <SummaryItem label="지역" value={car.location || '미정'} />
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-500">담당 딜러</span>
                  <span className="text-sm font-black text-slate-950">{car.dealerName || '배정 예정'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200/70 pt-3">
                  <span className="text-sm font-semibold text-slate-500">상담 상태</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-black text-blue-700">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    실시간 상담 가능
                  </span>
                </div>
              </div>

              {canManageCar ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link
                      to={`/cars/${car._id}/edit`}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-sm font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-sm font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                  {actionError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{actionError}</p> : null}
                </>
              ) : null}

              <button
                type="button"
                className="mt-5 w-full rounded-lg bg-blue-600 px-6 py-4 text-base font-black text-white shadow-[0_4px_10px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleStartChat}
                disabled={isChatStarting || (Boolean(currentUser) && isAuthLoading)}
              >
                {isChatStarting ? '상담방 여는 중...' : Boolean(currentUser) && isAuthLoading ? '사용자 확인 중...' : '상담하기'}
              </button>
              {actionError && !canManageCar ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{actionError}</p> : null}

              <Link
                to="/"
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
              >
                목록으로 돌아가기
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default CarDetailPage;
