import { useEffect, useMemo, useState } from 'react';
import { Car, CirclePlus, RotateCcw, Search } from 'lucide-react';
import api from '../api/api.js';
import CarCard from '../components/CarCard.jsx';
import StatusMessage from '../components/StatusMessage.jsx';

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-900">{label}</label>
      {children}
    </div>
  );
}

function CarListPage() {
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCars() {
      try {
        setIsLoading(true);
        setError('');

        const response = await api.get('/api/cars');
        setCars(response.data.data || []);
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || '차량 목록을 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCars();
  }, []);

  const totalCars = useMemo(() => cars.length, [cars]);
  const inputClass =
    'h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Car size={19} strokeWidth={2.4} />
            </div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">실시간 Car Market</h1>
          </div>

          <nav className="flex items-center gap-1.5 text-sm font-medium text-slate-600 sm:gap-3">
            <button type="button" className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
              차량 목록
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition hover:bg-slate-100 hover:text-slate-950 sm:px-2.5">
              <CirclePlus size={16} />
              차량 등록
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-3 pb-16 pt-3.5 sm:px-4 lg:px-5">
        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-950">필터</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">검색 조건</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="검색 조건 초기화"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <Field label="제조사">
                  <select className={inputClass} defaultValue="">
                    <option value="">전체</option>
                    <option value="hyundai">현대</option>
                    <option value="kia">기아</option>
                    <option value="genesis">제네시스</option>
                    <option value="renault">르노</option>
                  </select>
                </Field>

                <Field label="최저 가격 (만원)">
                  <input className={inputClass} placeholder="예: 1000" type="text" />
                </Field>

                <Field label="최고 가격 (만원)">
                  <input className={inputClass} placeholder="예: 3000" type="text" />
                </Field>

                <Field label="최소 연식">
                  <input className={inputClass} placeholder="2018" type="text" />
                </Field>

                <Field label="최대 연식">
                  <input className={inputClass} placeholder="2024" type="text" />
                </Field>
              </div>

              <button
                type="button"
                className="mt-2.5 inline-flex h-8 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                초기화
              </button>
            </section>
          </aside>

          <section className="min-w-0">
            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_132px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input className={`${inputClass} pl-9`} placeholder="차량명으로 검색" type="text" />
                </div>
                <select className={inputClass} defaultValue="latest">
                  <option value="latest">최신순</option>
                  <option value="priceLow">낮은 가격순</option>
                  <option value="priceHigh">높은 가격순</option>
                </select>
              </div>
            </div>

            <div className="mb-2 mt-2.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">차량 목록</h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  총 {totalCars.toLocaleString('ko-KR')}대의 차량이 검색되었습니다.
                </p>
              </div>
            </div>

            {isLoading ? (
              <StatusMessage title="차량 목록을 불러오는 중입니다" message="Atlas에서 최신 매물 정보를 가져오고 있습니다." />
            ) : null}

            {!isLoading && error ? (
              <StatusMessage title="목록을 불러오지 못했습니다" message={error} />
            ) : null}

            {!isLoading && !error && cars.length === 0 ? (
              <StatusMessage title="아직 등록된 차량이 없습니다" message="새 매물이 등록되면 이곳에 보기 좋은 카드로 표시됩니다." />
            ) : null}

            {!isLoading && !error && cars.length > 0 ? (
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {cars.map((car) => (
                  <CarCard key={car._id} car={car} />
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

export default CarListPage;
