import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  COMPANY_OPTIONS,
  FUEL_OPTIONS,
  Field,
  INITIAL_CAR_FORM,
  LOCATION_OPTIONS,
  MAX_IMAGE_COUNT,
  TRANSMISSION_OPTIONS,
  TYPE_OPTIONS,
  getSelectClass,
  inputClass,
  selectPlaceholder,
  textareaClass,
} from './CarNewPage.jsx';

function toFormValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

function buildFormFromCar(car) {
  return {
    name: toFormValue(car.name),
    company: toFormValue(car.company),
    price: toFormValue(car.price),
    year: toFormValue(car.year),
    type: toFormValue(car.type),
    fuel: toFormValue(car.fuel),
    mileage: toFormValue(car.mileage),
    location: toFormValue(car.location),
    description: toFormValue(car.description),
    transmission: toFormValue(car.transmission),
  };
}

function SelectOptions({ options }) {
  return options.map((option) => {
    const item = typeof option === 'string' ? { label: option, value: option } : option;

    return (
      <option className="text-slate-900" key={item.value} value={item.value}>
        {item.label}
      </option>
    );
  });
}

function CarEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, profile, isAuthenticated, isAuthLoading } = useAuth();
  const [car, setCar] = useState(null);
  const [form, setForm] = useState(INITIAL_CAR_FORM);
  const [imageFiles, setImageFiles] = useState([]);
  const [replaceImages, setReplaceImages] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCar() {
      try {
        setIsLoading(true);
        setError('');

        const response = await api.get(`/api/cars/${id}`);
        const carData = response.data.data;

        setCar(carData);
        setForm(buildFormFromCar(carData));
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || '차량 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCar();
  }, [id]);

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

      formData.append('uid', currentUser.uid);
      formData.append('replaceImages', replaceImages ? 'true' : 'false');

      imageFiles.forEach((imageFile) => {
        formData.append('images', imageFile);
      });

      const response = await api.put(`/api/cars/${id}`, formData);
      const updatedCar = response.data.data;

      navigate(`/cars/${updatedCar?._id || id}`);
    } catch (updateError) {
      setError(updateError.response?.data?.message || '차량 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage title="차량 정보를 불러오는 중입니다" message="수정 권한과 차량 정보를 확인하고 있습니다." />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage title="로그인이 필요합니다" message="차량 수정은 등록한 딜러 계정으로 로그인한 뒤 이용할 수 있습니다." />
        </div>
      </main>
    );
  }

  if (error && !car) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage title="차량 정보를 찾을 수 없습니다" message={error} />
        </div>
      </main>
    );
  }

  if (profile?.role !== 'dealer' || car?.dealerId !== currentUser.uid) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <Header />
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <StatusMessage
            title="권한이 없습니다"
            message="본인이 등록한 차량만 수정할 수 있습니다."
            action={
              <Link to={`/cars/${id}`} className="inline-flex rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                상세 화면으로 돌아가기
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const currentImageCount = Array.isArray(car.imageUrls) ? car.imageUrls.length : car.imageUrl ? 1 : 0;

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header subtitle="딜러 차량 수정" />

      <section className="mx-auto max-w-[1200px] px-4 py-6 sm:px-5">
        <div className="mb-4">
          <p className="text-sm font-bold text-blue-600">딜러 전용</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">차량 수정</h2>
        </div>

        <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" onSubmit={handleSubmit}>
          <div className="grid gap-3.5 md:grid-cols-2">
            <Field label="차량명" required>
              <input className={inputClass} name="name" value={form.name} onChange={handleChange} required />
            </Field>

            <Field label="제조사" required>
              <select className={getSelectClass(form.company)} name="company" value={form.company} onChange={handleChange} required>
                {selectPlaceholder}
                <SelectOptions options={COMPANY_OPTIONS} />
              </select>
            </Field>

            <Field label="가격(만원)" required>
              <input className={inputClass} name="price" type="number" min="0" value={form.price} onChange={handleChange} required />
            </Field>

            <Field label="연식" required>
              <input className={inputClass} name="year" type="number" min="1900" value={form.year} onChange={handleChange} required />
            </Field>

            <Field label="차종">
              <select className={getSelectClass(form.type)} name="type" value={form.type} onChange={handleChange}>
                {selectPlaceholder}
                <SelectOptions options={TYPE_OPTIONS} />
              </select>
            </Field>

            <Field label="연료">
              <select className={getSelectClass(form.fuel)} name="fuel" value={form.fuel} onChange={handleChange}>
                {selectPlaceholder}
                <SelectOptions options={FUEL_OPTIONS} />
              </select>
            </Field>

            <Field label="주행거리(km)">
              <input className={inputClass} name="mileage" type="number" min="0" value={form.mileage} onChange={handleChange} />
            </Field>

            <Field label="지역">
              <select className={getSelectClass(form.location)} name="location" value={form.location} onChange={handleChange}>
                {selectPlaceholder}
                <SelectOptions options={LOCATION_OPTIONS} />
              </select>
            </Field>

            <Field label="변속기">
              <select className={getSelectClass(form.transmission)} name="transmission" value={form.transmission} onChange={handleChange}>
                {selectPlaceholder}
                <SelectOptions options={TRANSMISSION_OPTIONS} />
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="설명">
              <textarea className={textareaClass} name="description" value={form.description} onChange={handleChange} />
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
                현재 이미지 {currentImageCount}장. 새 이미지는 최대 {MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.
                {imageFiles.length > 0 ? ` 새 이미지 ${imageFiles.length}장 선택됨.` : ''}
              </span>
            </Field>
            <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={replaceImages}
                onChange={(event) => {
                  setReplaceImages(event.target.checked);
                }}
              />
              기존 이미지를 새 이미지로 교체
            </label>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p> : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link to={`/cars/${id}`} className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              취소
            </Link>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default CarEditPage;
