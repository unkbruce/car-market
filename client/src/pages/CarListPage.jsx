import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import api from '../api/api.js';
import CarCard from '../components/CarCard.jsx';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import {
  COMPANY_GROUPS,
  COMPANY_OPTIONS,
  FUEL_OPTIONS,
  LOCATION_OPTIONS,
  TRANSMISSION_OPTIONS,
  TYPE_OPTIONS,
  getOptionLabel,
  getQueryValues,
} from '../utils/carOptions.js';

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

const INITIAL_COMPANY_GROUP_OPEN_SECTIONS = {
  domestic: true,
  imported: true,
};

const OPTIONS = ['선루프', '내비게이션', '스마트키', '후방 카메라', '가죽시트', '에어백', '기타'];
const CARS_PER_PAGE = 9;

const ARRAY_FILTERS = ['type', 'company', 'location', 'fuel', 'transmission'];
const NUMBER_FILTERS = ['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage'];
const SEARCH_VALUE_OPTIONS = {
  company: COMPANY_OPTIONS,
  fuel: FUEL_OPTIONS,
  transmission: TRANSMISSION_OPTIONS,
};

function buildSearchParams(filters) {
  const params = {};

  if (filters.keyword.trim()) {
    params.keyword = filters.keyword.trim();
  }

  for (const key of ARRAY_FILTERS) {
    if (filters[key].length > 0) {
      const values = filters[key].flatMap((value) => (
        SEARCH_VALUE_OPTIONS[key] ? getQueryValues(SEARCH_VALUE_OPTIONS[key], value) : [value]
      ));

      params[key] = Array.from(new Set(values)).join(',');
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
  return getOptionLabel(COMPANY_OPTIONS, value);
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
    fuel: getOptionLabel(FUEL_OPTIONS, value),
    transmission: getOptionLabel(TRANSMISSION_OPTIONS, value),
  };

  return labels[key] || value;
}

function getCarTimestamp(car) {
  const createdTime = car.createdAt ? new Date(car.createdAt).getTime() : 0;

  if (Number.isFinite(createdTime) && createdTime > 0) {
    return createdTime;
  }

  return car._id ? Number.parseInt(car._id.slice(0, 8), 16) : 0;
}

function sortCars(cars, sortOrder) {
  return [...cars].sort((firstCar, secondCar) => {
    if (sortOrder === 'priceLow') {
      return Number(firstCar.price || 0) - Number(secondCar.price || 0);
    }

    if (sortOrder === 'priceHigh') {
      return Number(secondCar.price || 0) - Number(firstCar.price || 0);
    }

    return getCarTimestamp(secondCar) - getCarTimestamp(firstCar);
  });
}

function CompanyFilterGroups({ groupOpenSections, selectedValues, onGroupToggle, onToggle }) {
  return (
    <div className="grid gap-2">
      {COMPANY_GROUPS.map((group) => (
        <div key={group.key} className="rounded-lg bg-slate-50/70 px-2 py-1.5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 py-1 text-left text-[12px] font-bold text-slate-700"
            onClick={() => onGroupToggle(group.key)}
          >
            <span>{group.label}</span>
            <ChevronDown size={14} className={`text-slate-400 transition ${groupOpenSections[group.key] ? 'rotate-180' : ''}`} />
          </button>

          {groupOpenSections[group.key] ? (
            <div className="mt-1">
              <CheckboxList name="company" options={group.options} selectedValues={selectedValues} onToggle={onToggle} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
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
  const [sortOrder, setSortOrder] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [openSections, setOpenSections] = useState(INITIAL_OPEN_SECTIONS);
  const [companyGroupOpenSections, setCompanyGroupOpenSections] = useState(INITIAL_COMPANY_GROUP_OPEN_SECTIONS);

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

  const sortedCars = useMemo(() => sortCars(cars, sortOrder), [cars, sortOrder]);
  const totalCars = useMemo(() => sortedCars.length, [sortedCars]);
  const totalPages = Math.max(1, Math.ceil(totalCars / CARS_PER_PAGE));
  const paginatedCars = useMemo(() => {
    const startIndex = (currentPage - 1) * CARS_PER_PAGE;

    return sortedCars.slice(startIndex, startIndex + CARS_PER_PAGE);
  }, [currentPage, sortedCars]);
  const pageNumbers = useMemo(() => {
    const visiblePageCount = Math.min(5, totalPages);
    const halfVisiblePages = Math.floor(visiblePageCount / 2);
    let startPage = Math.max(1, currentPage - halfVisiblePages);
    const endPage = Math.min(totalPages, startPage + visiblePageCount - 1);

    startPage = Math.max(1, endPage - visiblePageCount + 1);

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [currentPage, totalPages]);
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

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function handleTextFilterChange(event) {
    const { name, value } = event.target;

    setCurrentPage(1);
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  }

  function handleCheckboxToggle(name, value) {
    if (name === 'options') {
      return;
    }

    setCurrentPage(1);
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

  function handleCompanyGroupToggle(section) {
    setCompanyGroupOpenSections((currentSections) => ({
      ...currentSections,
      [section]: !currentSections[section],
    }));
  }

  function handleRemoveChip(key, value) {
    setCurrentPage(1);
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
    setCurrentPage(1);
    setFilters(INITIAL_FILTERS);
  }

  function handleSortChange(event) {
    setSortOrder(event.target.value);
    setCurrentPage(1);
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header />

      <div className="mx-auto max-w-[1200px] px-3 pb-16 pt-3.5 sm:px-4 lg:px-5">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-3.5 py-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-slate-950">차량 조건</h2>
                  <span className="shrink-0 text-sm font-semibold text-blue-700">{totalCars.toLocaleString('ko-KR')}대</span>
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
                  <CheckboxList name="type" options={TYPE_OPTIONS} selectedValues={filters.type} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection
                  title="제조사/모델/등급"
                  isOpen={openSections.company}
                  onToggle={() => handleSectionToggle('company')}
                >
                  <CompanyFilterGroups
                    groupOpenSections={companyGroupOpenSections}
                    selectedValues={filters.company}
                    onGroupToggle={handleCompanyGroupToggle}
                    onToggle={handleCheckboxToggle}
                  />
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
                  <CheckboxList name="location" options={LOCATION_OPTIONS} selectedValues={filters.location} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection title="연료" helper={filters.fuel.length ? `${filters.fuel.length}` : ''} isOpen={openSections.fuel} onToggle={() => handleSectionToggle('fuel')}>
                  <CheckboxList name="fuel" options={FUEL_OPTIONS} selectedValues={filters.fuel} onToggle={handleCheckboxToggle} />
                </FilterSection>

                <FilterSection
                  title="변속기"
                  helper={filters.transmission.length ? `${filters.transmission.length}` : ''}
                  isOpen={openSections.transmission}
                  onToggle={() => handleSectionToggle('transmission')}
                >
                  <CheckboxList name="transmission" options={TRANSMISSION_OPTIONS} selectedValues={filters.transmission} onToggle={handleCheckboxToggle} />
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
                <select className={inputClass} value={sortOrder} onChange={handleSortChange}>
                  <option value="latest">최신순</option>
                  <option value="priceLow">낮은 가격순</option>
                  <option value="priceHigh">높은 가격순</option>
                </select>
              </div>
            </div>

            {isLoading && cars.length > 0 ? <div className="mt-2.5 text-xs font-medium text-blue-600">필터 적용 중...</div> : null}

            {activeChips.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
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
              <>
                <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedCars.map((car) => (
                    <CarCard key={car._id} car={car} />
                  ))}
                </div>

                <div className="mt-6 flex justify-center">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      이전
                    </button>
                    {pageNumbers.map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold transition ${
                          currentPage === page
                            ? 'border-blue-600 bg-blue-600 text-white shadow-[0_4px_10px_rgba(37,99,235,0.18)]'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => setCurrentPage(page)}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                    >
                      다음
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

export default CarListPage;
