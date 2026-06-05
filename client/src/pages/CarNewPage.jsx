import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export const INITIAL_CAR_FORM = {
  name: '',
  company: '',
  price: '',
  year: '',
  type: '',
  fuel: '',
  mileage: '',
  location: '',
  description: '',
  transmission: '',
};

export const controlClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10';
export const inputClass = `${controlClass} text-slate-900`;
export const textareaClass =
  'min-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10';

export const selectPlaceholder = (
  <option className="text-slate-400" value="">
    선택해주세요
  </option>
);
export const COMPANY_OPTIONS = [
  { label: 'HYUNDAI', value: '현대' },
  { label: 'KIA', value: '기아' },
  { label: 'GENESIS', value: '제네시스' },
  { label: 'BMW', value: 'BMW' },
  { label: 'BENZ', value: '벤츠' },
  { label: 'CHEVROLET', value: '쉐보레' },
  { label: 'RENAULT', value: '르노' },
  { label: 'KG MOBILITY', value: 'KG' },
  { label: '기타', value: '기타' },
];
export const TYPE_OPTIONS = ['경차', '소형차', '준중형차', '중형차', '대형차', '스포츠카', 'SUV', 'RV'];
export const FUEL_OPTIONS = [
  { label: '가솔린', value: 'gasoline' },
  { label: '디젤', value: 'diesel' },
  { label: 'LPG', value: 'LPG' },
  { label: '하이브리드', value: 'hybrid' },
  { label: '전기', value: 'electric' },
  { label: '기타', value: '기타' },
];
export const LOCATION_OPTIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타'];
export const TRANSMISSION_OPTIONS = [
  { label: '오토', value: 'auto' },
  { label: '수동', value: 'manual' },
  { label: 'CVT', value: 'CVT' },
  { label: '기타', value: '기타' },
];
export const MAX_IMAGE_COUNT = 6;

export function getSelectClass(value) {
  return `${controlClass} ${value ? 'text-slate-900' : 'text-slate-400'}`;
}

export function Field({ label, children, required = false }) {
  return (
    <label className="grid gap-1.5 text-[13px] font-semibold text-slate-700">
      <span>
        {label}
        {required ? <span className="text-blue-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function CarNewPage() {
  const navigate = useNavigate();
  const { currentUser, profile, isAuthenticated, isAuthLoading } = useAuth();
  const [form, setForm] = useState(INITIAL_CAR_FORM);
  const [imageFiles, setImageFiles] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    if (selectedFiles.length > MAX_IMAGE_COUNT) {
      setError(`이미지는 최대 ${MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.`);
      event.target.value = '';
      setImageFiles([]);
      return;
    }

    setError('');
    setImageFiles(selectedFiles);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');

      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      formData.append('dealerId', currentUser.uid);
      formData.append('dealerName', profile?.displayName || currentUser.displayName || currentUser.email);

      imageFiles.forEach((imageFile) => {
        formData.append('images', imageFile);
      });

      const response = await api.post('/api/cars', formData);

      const createdCar = response.data.data;
      navigate(createdCar?._id ? `/cars/${createdCar._id}` : '/');
    } catch (createError) {
      setError(createError.response?.data?.message || '차량 등록에 실패했습니다. 입력 정보를 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage title="권한을 확인하는 중입니다" message="로그인 상태와 딜러 권한을 확인하고 있습니다." />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage
            title="로그인이 필요합니다"
            message="차량 등록은 딜러 계정으로 로그인한 뒤 이용할 수 있습니다."
            action={
              <Link to="/login" className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700">
                로그인하러 가기
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  if (profile?.role !== 'dealer') {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage
            title="권한이 없습니다"
            message="차량 등록은 딜러 계정만 이용할 수 있습니다."
            action={
              <Link to="/" className="inline-flex rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                차량 목록으로 돌아가기
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header subtitle="딜러 차량 등록" />

      <section className="mx-auto max-w-[1200px] px-4 py-6 sm:px-5">
        <div className="mb-4">
          <p className="text-sm font-bold text-blue-600">딜러 전용</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">차량 등록</h2>
        </div>

        <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" onSubmit={handleSubmit}>
          <div className="grid gap-3.5 md:grid-cols-2">
            <Field label="차량명" required>
              <input className={inputClass} name="name" value={form.name} onChange={handleChange} placeholder="예: G80 2.5 터보" required />
            </Field>

            <Field label="제조사" required>
              <select className={getSelectClass(form.company)} name="company" value={form.company} onChange={handleChange} required>
                {selectPlaceholder}
                {COMPANY_OPTIONS.map((option) => (
                  <option className="text-slate-900" key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="가격(만원)" required>
              <input className={inputClass} name="price" type="number" min="0" value={form.price} onChange={handleChange} placeholder="예: 2800" required />
            </Field>

            <Field label="연식" required>
              <input className={inputClass} name="year" type="number" min="1900" value={form.year} onChange={handleChange} placeholder="예: 2023" required />
            </Field>

            <Field label="차종">
              <select className={getSelectClass(form.type)} name="type" value={form.type} onChange={handleChange}>
                {selectPlaceholder}
                {TYPE_OPTIONS.map((option) => (
                  <option className="text-slate-900" key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="연료">
              <select className={getSelectClass(form.fuel)} name="fuel" value={form.fuel} onChange={handleChange}>
                {selectPlaceholder}
                {FUEL_OPTIONS.map((option) => (
                  <option className="text-slate-900" key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="주행거리(km)">
              <input className={inputClass} name="mileage" type="number" min="0" value={form.mileage} onChange={handleChange} placeholder="예: 35000" />
            </Field>

            <Field label="지역">
              <select className={getSelectClass(form.location)} name="location" value={form.location} onChange={handleChange}>
                {selectPlaceholder}
                {LOCATION_OPTIONS.map((option) => (
                  <option className="text-slate-900" key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="변속기">
              <select className={getSelectClass(form.transmission)} name="transmission" value={form.transmission} onChange={handleChange}>
                {selectPlaceholder}
                {TRANSMISSION_OPTIONS.map((option) => (
                  <option className="text-slate-900" key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="설명">
              <textarea
                className={textareaClass}
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="차량 상태, 정비 이력, 특이사항을 입력해주세요."
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="차량 사진">
              <input
                className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:bg-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                name="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
              />
              <span className="text-xs font-medium text-slate-500">
                JPG, PNG 등 이미지 파일을 최대 {MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.
                {imageFiles.length > 0 ? ` 현재 ${imageFiles.length}장 선택됨.` : ''}
              </span>
            </Field>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p> : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </Link>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : '차량 등록'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CarNewPage;
