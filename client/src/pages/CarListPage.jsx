import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import api from '../api/api.js';
import CarCard from '../components/CarCard.jsx';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';

const INITIAL_FILTERS = {
  keyword: '',
  type: [],
  company: [],
  minYear: '',
  maxYear: '',
  minMileage: '',
  maxMileage: '',
  minPrice: '',
  maxPrice: '',
  location: [],
  fuel: [],
  transmission: [],
  options: [],
};

const INITIAL_OPEN_SECTIONS = {
  type: false,
  company: false,
  year: false,
  mileage: false,
  price: false,
  location: false,
  fuel: false,
  transmission: false,
  options: false,
};

const CAR_TYPES = ['경차', '소형차', '준중형차', '중형차', '대형차', '스포츠카', 'SUV', 'RV'];
const COMPANIES = [
  { label: 'HYUNDAI', value: '현대' },
  { label: 'KIA', value: '기아' },
  { label: 'GENESIS', value: '제네시스' },
  { label: 'BMW', value: 'BMW' },
  { label: 'BENZ', value: '벤츠' },
  { label: 'CHEVROLET', value: '쉐보레' },
  { label: 'RENAULT', value: '르노' },
  { label: 'KG MOBILITY', value: 'KG' },
  { label: '기타 제조사', value: '기타' },
];
const LOCATIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타'];
const FUELS = ['gasoline', 'diesel', 'LPG', 'hybrid', 'electric', '기타'];
const TRANSMISSIONS = ['auto', 'manual', 'CVT', '기타'];
const OPTIONS = ['선루프', '내비게이션', '스마트키', '후방 카메라', '가죽시트', '에어백', '기타'];

const ARRAY_FILTERS = ['type', 'company', 'location', 'fuel', 'transmission'];
const NUMBER_FILTERS = ['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage'];

function buildSearchParams(filters) {
  const params = {};

  if (filters.keyword.trim()) {
    params.keyword = filters.keyword.trim();
  }

  for (const key of ARRAY_FILTERS) {
    if (filters[key].length > 0) {
      params[key] = filters[key].join(',');
    }
  }

  for (const key of NUMBER_FILTERS) {
    if (filters[key].trim()) {
      params[key] = filters[key].trim();
    }
  }

  return params;
}

function hasActiveSearch(filters) {
  return Object.entries(filters).some(([, value]) => (Array.isArray(value) ? value.length > 0 : value.trim() !== ''));
}

function getCompanyLabel(value) {
  return COMPANIES.find((company) => company.value === value)?.label || value;
}

function getChipLabel(key, value) {
  const labels = {
    keyword: `차량명: ${value}`,
    type: value,
    company: getCompanyLabel(value),
    minYear: `${value}년 이후`,
    maxYear: `${value}년 이전`,
    minMileage: `${Number(value).toLocaleString('ko-KR')}km 이상`,
    maxMileage: `${Number(value).toLocaleString('ko-KR')}km 이하`,
    minPrice: `${Number(value).toLocaleString('ko-KR')}만원 이상`,
    maxPrice: `${Number(value).toLocaleString('ko-KR')}만원 이하`,
    location: value,
    fuel: value,
    transmission: value,
  };

  return labels[key] || value;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function FilterSection({ title, helper, isOpen, onToggle, children }) {
  return (
    <section className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
        onClick={onToggle}
      >
        <span className="text-[13px] font-bold text-slate-950">{title}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          {helper ? <span>{helper}</span> : null}
          <ChevronDown size={15} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen ? <div className="pb-3">{children}</div> : null}
    </section>
  );
}

function CheckboxList({ name, options, selectedValues, onToggle, disabled = false }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => {
        const item = typeof option === 'string' ? { label: option, value: option } : option;

        return (
          <label
            key={item.value}
            className={`flex items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-[12px] ${
              disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-700 hover:text-slate-950'
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={selectedValues.includes(item.value)}
                disabled={disabled}
                onChange={() => onToggle(name, item.value)}
              />
              <span className="truncate">{item.label}</span>
            </span>
            {disabled ? <span className="text-[10px] text-slate-400">준비 중</span> : null}
          </label>
        );
      })}
    </div>
  );
}

function CarListPage() {
  const [cars, setCars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [openSections, setOpenSections] = useState(INITIAL_OPEN_SECTIONS);

  const isSearchMode = useMemo(() => hasActiveSearch(filters), [filters]);
  const activeChips = useMemo(() => {
    const chips = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'options') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => chips.push({ key, value: item, label: getChipLabel(key, item) }));
        return;
      }

      if (value.trim()) {
        chips.push({ key, value, label: getChipLabel(key, value) });
      }
    });

    return chips;
  }, [filters]);

  const totalCars = useMemo(() => cars.length, [cars]);
  const inputClass =
    'h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

  useEffect(() => {
    const controller = new AbortController();

    async function fetchFilteredCars() {
      try {
        setIsLoading(true);
        setError('');

        const params = buildSearchParams(filters);
        const endpoint = Object.keys(params).length > 0 ? '/api/cars/search' : '/api/cars';
        const response = await api.get(endpoint, {
          params,
          signal: controller.signal,
        });

        setCars(response.data.data || []);
      } catch (fetchError) {
        if (fetchError.name === 'CanceledError' || fetchError.code === 'ERR_CANCELED') {
          return;
        }

        setError(fetchError.response?.data?.message || '차량 목록을 불러오지 못했습니다.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(fetchFilteredCars, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [filters]);

  function handleTextFilterChange(event) {
    const { name, value } = event.target;

    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  function handleCheckboxToggle(name, value) {
    if (name === 'options') {
      return;
    }

    setFilters((currentFilters) => {
      const currentValues = currentFilters[name];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...currentFilters,
        [name]: nextValues,
      };
    });
  }

  function handleSectionToggle(section) {
    setOpenSections((currentSections) => ({
      ...currentSections,
      [section]: !currentSections[section],
    }));
  }

  function handleRemoveChip(key, value) {
    setFilters((currentFilters) => {
      if (Array.isArray(currentFilters[key])) {
        return {
          ...currentFilters,
          [key]: currentFilters[key].filter((item) => item !== value),
        };
      }

      return {
        ...currentFilters,
        [key]: '',
      };
    });
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS);
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header />

      <div className="mx-auto max-w-[1200px] px-3 pb-16 pt-3.5 sm:px-4 lg:px-5">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-3.5 py-3">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-950">필터</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">조건을 선택하면 바로 반영됩니다.</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="검색 조건 초기화"
                  onClick={handleReset}
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div className="px-3.5">
                <FilterSection title="차종" helper={filters.type.length ? `${filters.type.length}` : ''} isOpen={openSections.type} onToggle={() => handleSectionToggle('type')}>
                  <CheckboxList name="type" options={CAR_TYPES} selectedValues={filters.type} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection
                  title="제조사/모델/등급"
                  helper={filters.company.length ? `${filters.company.length}` : ''}
                  isOpen={openSections.company}
                  onToggle={() => handleSectionToggle('company')}
                >
                  <CheckboxList name="company" options={COMPANIES} selectedValues={filters.company} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection title="연식" isOpen={openSections.year} onToggle={() => handleSectionToggle('year')}>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="최소 연식">
                      <input className={inputClass} name="minYear" placeholder="2018" type="number" value={filters.minYear} onChange={handleTextFilterChange} />
                    </Field>
                    <Field label="최대 연식">
                      <input className={inputClass} name="maxYear" placeholder="2024" type="number" value={filters.maxYear} onChange={handleTextFilterChange} />
                    </Field>
                  </div>
                </FilterSection>

                <FilterSection title="주행거리" isOpen={openSections.mileage} onToggle={() => handleSectionToggle('mileage')}>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="최소 km">
                      <input className={inputClass} name="minMileage" placeholder="0" type="number" value={filters.minMileage} onChange={handleTextFilterChange} />
                    </Field>
                    <Field label="최대 km">
                      <input className={inputClass} name="maxMileage" placeholder="80000" type="number" value={filters.maxMileage} onChange={handleTextFilterChange} />
                    </Field>
                  </div>
                </FilterSection>

                <FilterSection title="가격" isOpen={openSections.price} onToggle={() => handleSectionToggle('price')}>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="최소 가격">
                      <input className={inputClass} name="minPrice" placeholder="1000" type="number" value={filters.minPrice} onChange={handleTextFilterChange} />
                    </Field>
                    <Field label="최대 가격">
                      <input className={inputClass} name="maxPrice" placeholder="3000" type="number" value={filters.maxPrice} onChange={handleTextFilterChange} />
                    </Field>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">단위: 만원</p>
                </FilterSection>

                <FilterSection
                  title="지역"
                  helper={filters.location.length ? `${filters.location.length}` : ''}
                  isOpen={openSections.location}
                  onToggle={() => handleSectionToggle('location')}
                >
                  <CheckboxList name="location" options={LOCATIONS} selectedValues={filters.location} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection title="연료" helper={filters.fuel.length ? `${filters.fuel.length}` : ''} isOpen={openSections.fuel} onToggle={() => handleSectionToggle('fuel')}>
                  <CheckboxList name="fuel" options={FUELS} selectedValues={filters.fuel} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection
                  title="변속기"
                  helper={filters.transmission.length ? `${filters.transmission.length}` : ''}
                  isOpen={openSections.transmission}
                  onToggle={() => handleSectionToggle('transmission')}
                >
                  <CheckboxList name="transmission" options={TRANSMISSIONS} selectedValues={filters.transmission} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection title="옵션" helper="준비 중" isOpen={openSections.options} onToggle={() => handleSectionToggle('options')}>
                  <CheckboxList name="options" options={OPTIONS} selectedValues={filters.options} onToggle={handleCheckboxToggle} disabled />
                </FilterSection>
              </div>

              <div className="border-t border-slate-100 p-3.5">
                <button
                  type="button"
                  className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  onClick={handleReset}
                >
                  전체 초기화
                </button>
              </div>
            </section>
          </aside>

          <section className="min-w-0">
            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_132px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className={`${inputClass} pl-9`}
                    name="keyword"
                    placeholder="차량명으로 검색"
                    type="text"
                    value={filters.keyword}
                    onChange={handleTextFilterChange}
                  />
                </div>
                <select className={inputClass} defaultValue="latest">
                  <option value="latest">최신순</option>
                  <option value="priceLow">낮은 가격순</option>
                  <option value="priceHigh">높은 가격순</option>
                </select>
              </div>
            </div>

            <div className="mb-2 mt-2.5 flex flex-col gap-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-950">차량 목록</h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    총 {totalCars.toLocaleString('ko-KR')}대의 차량이 검색되었습니다.
                  </p>
                </div>
                {isLoading ? <span className="text-xs font-medium text-blue-600">필터 적용 중...</span> : null}
              </div>

              {activeChips.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeChips.map((chip) => (
                    <button
                      key={`${chip.key}-${chip.value}`}
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
                      onClick={() => handleRemoveChip(chip.key, chip.value)}
                    >
                      {chip.label}
                      <X size={12} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {isLoading && cars.length === 0 ? (
              <StatusMessage
                title={isSearchMode ? '차량을 검색하는 중입니다' : '차량 목록을 불러오는 중입니다'}
                message={isSearchMode ? '선택한 조건에 맞는 매물을 확인하고 있습니다.' : 'Atlas에서 최신 매물 정보를 가져오고 있습니다.'}
              />
            ) : null}

            {!isLoading && error ? (
              <StatusMessage title="목록을 불러오지 못했습니다" message={error} />
            ) : null}

            {!isLoading && !error && cars.length === 0 ? (
              <StatusMessage
                title={isSearchMode ? '조건에 맞는 차량이 없습니다' : '아직 등록된 차량이 없습니다'}
                message={isSearchMode ? '필터를 줄이거나 전체 초기화 후 다시 확인해보세요.' : '새 매물이 등록되면 이곳에 보기 좋은 카드로 표시됩니다.'}
              />
            ) : null}

            {!error && cars.length > 0 ? (
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
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
