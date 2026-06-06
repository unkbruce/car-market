import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { SAMPLE_CAR_IMAGES } from '../data/sampleCarImages.js';
import { COMPANY_OPTIONS, FUEL_OPTIONS, TRANSMISSION_OPTIONS, TYPE_OPTIONS } from '../utils/carOptions.js';

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
export const LOCATION_OPTIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타'];
export const MAX_IMAGE_COUNT = 8;
const IMAGE_INPUT_MODES = {
  sample: 'sample',
  upload: 'upload',
};

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
  const [imageInputMode, setImageInputMode] = useState(IMAGE_INPUT_MODES.sample);
  const [selectedSampleCarId, setSelectedSampleCarId] = useState('');
  const [selectedSampleImageUrls, setSelectedSampleImageUrls] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageInputRef = useRef(null);
  const selectedImagesRef = useRef([]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleImageInputModeChange(nextMode) {
    setImageInputMode(nextMode);
    setError('');

    if (nextMode === IMAGE_INPUT_MODES.sample) {
      selectedImages.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
      setSelectedImages([]);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    setSelectedSampleCarId('');
    setSelectedSampleImageUrls([]);
  }

  function handleSampleCarSelect(sampleCar) {
    const sampleImageUrls = Array.isArray(sampleCar.imageUrls) ? sampleCar.imageUrls.filter(Boolean) : [];

    setSelectedSampleCarId(sampleCar.id);
    setSelectedSampleImageUrls(sampleImageUrls.slice(0, MAX_IMAGE_COUNT));
    setError(sampleImageUrls.length > MAX_IMAGE_COUNT ? `이미지는 최대 ${MAX_IMAGE_COUNT}장까지만 등록됩니다.` : '');
  }

  function handleRemoveSampleImage(imageUrl) {
    setSelectedSampleImageUrls((currentUrls) => currentUrls.filter((url) => url !== imageUrl));
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const existingIds = new Set(selectedImages.map((image) => image.id));
    const nextImages = [];
    let hasDuplicate = false;

    for (const file of selectedFiles) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;

      if (existingIds.has(id) || nextImages.some((image) => image.id === id)) {
        hasDuplicate = true;
        continue;
      }

      nextImages.push({
        id,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (selectedImages.length + nextImages.length > MAX_IMAGE_COUNT) {
      nextImages.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
      setError(`이미지는 최대 ${MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.`);
      event.target.value = '';
      return;
    }

    setError(hasDuplicate ? '이미 선택한 파일은 제외했습니다.' : '');
    setSelectedImages((currentImages) => [...currentImages, ...nextImages]);
    event.target.value = '';
  }

  function handleRemoveImage(imageId) {
    setSelectedImages((currentImages) => {
      const removedImage = currentImages.find((image) => image.id === imageId);

      if (removedImage) {
        URL.revokeObjectURL(removedImage.previewUrl);
      }

      return currentImages.filter((image) => image.id !== imageId);
    });

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
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

      if (imageInputMode === IMAGE_INPUT_MODES.sample) {
        formData.append('sampleImageUrls', JSON.stringify(selectedSampleImageUrls));
      } else {
        selectedImages.forEach((image) => {
          formData.append('images', image.file);
        });
      }

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
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  className={`h-8 rounded-md px-3 text-xs font-bold transition ${
                    imageInputMode === IMAGE_INPUT_MODES.sample ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  onClick={() => handleImageInputModeChange(IMAGE_INPUT_MODES.sample)}
                >
                  샘플 이미지 선택
                </button>
                <button
                  type="button"
                  className={`h-8 rounded-md px-3 text-xs font-bold transition ${
                    imageInputMode === IMAGE_INPUT_MODES.upload ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  onClick={() => handleImageInputModeChange(IMAGE_INPUT_MODES.upload)}
                >
                  직접 업로드
                </button>
              </div>

              {imageInputMode === IMAGE_INPUT_MODES.sample ? (
                <div className="mt-3">
                  {SAMPLE_CAR_IMAGES.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {SAMPLE_CAR_IMAGES.map((sampleCar) => {
                        const sampleImageUrls = Array.isArray(sampleCar.imageUrls) ? sampleCar.imageUrls : [];
                        const previewImageUrl = sampleImageUrls[0] || '';
                        const isSelected = selectedSampleCarId === sampleCar.id;

                        return (
                          <button
                            type="button"
                            key={sampleCar.id}
                            className={`overflow-hidden rounded-lg border bg-white text-left transition ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-200'
                            }`}
                            onClick={() => handleSampleCarSelect(sampleCar)}
                          >
                            <div className="aspect-[4/3] bg-slate-50">
                              {previewImageUrl ? (
                                <img src={previewImageUrl} alt={sampleCar.label} className="h-full w-full object-contain object-center" />
                              ) : (
                                <div className="grid h-full place-items-center text-xs font-medium text-slate-400">이미지 없음</div>
                              )}
                            </div>
                            <div className="px-2.5 py-2">
                              <span className="block truncate text-xs font-bold text-slate-700">{sampleCar.label}</span>
                              <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{sampleImageUrls.length}장</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">등록된 샘플 이미지가 없습니다.</p>
                  )}
                  <span className="mt-2 block text-xs font-medium text-slate-500">
                    샘플 이미지는 최대 {MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.
                    {selectedSampleImageUrls.length > 0 ? ` 현재 ${selectedSampleImageUrls.length}장 선택됨.` : ''}
                  </span>
                </div>
              ) : (
                <>
                  <input
                    className="mt-3 block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:bg-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                    name="images"
                    type="file"
                    accept="image/*"
                    multiple
                    ref={imageInputRef}
                    onChange={handleImageChange}
                  />
                  <span className="text-xs font-medium text-slate-500">
                    JPG, PNG 등 이미지 파일을 최대 {MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.
                    {selectedImages.length > 0 ? ` 현재 ${selectedImages.length}장 선택됨.` : ''}
                  </span>
                </>
              )}
            </Field>

            {imageInputMode === IMAGE_INPUT_MODES.sample && selectedSampleImageUrls.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {selectedSampleImageUrls.map((imageUrl, index) => (
                  <div key={imageUrl} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="aspect-[4/3] bg-slate-50">
                      <img src={imageUrl} alt={`선택한 샘플 이미지 ${index + 1}`} className="h-full w-full object-contain object-center" />
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{imageUrl}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                        onClick={() => handleRemoveSampleImage(imageUrl)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {imageInputMode === IMAGE_INPUT_MODES.upload && selectedImages.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {selectedImages.map((image) => (
                  <div key={image.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="aspect-[4/3] bg-slate-50">
                      <img src={image.previewUrl} alt={image.file.name} className="h-full w-full object-contain object-center" />
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{image.file.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                        onClick={() => handleRemoveImage(image.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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
