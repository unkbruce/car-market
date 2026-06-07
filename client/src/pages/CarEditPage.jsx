import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/api.js';
import Header from '../components/Header.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Field,
  IMAGE_INPUT_MODES,
  INITIAL_CAR_FORM,
  ImageInputTabs,
  MAX_IMAGE_COUNT,
  MIN_IMAGE_ERROR_MESSAGE,
  SampleImageSelector,
  getSelectClass,
  inputClass,
  selectPlaceholder,
  textareaClass,
} from './CarNewPage.jsx';
import { COMPANY_OPTIONS, FUEL_OPTIONS, LOCATION_OPTIONS, TRANSMISSION_OPTIONS, TYPE_OPTIONS, getCanonicalOptionValue } from '../utils/carOptions.js';

function toFormValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

function buildFormFromCar(car) {
  return {
    name: toFormValue(car.name),
    company: getCanonicalOptionValue(COMPANY_OPTIONS, toFormValue(car.company)),
    price: toFormValue(car.price),
    year: toFormValue(car.year),
    type: toFormValue(car.type),
    fuel: getCanonicalOptionValue(FUEL_OPTIONS, toFormValue(car.fuel)),
    mileage: toFormValue(car.mileage),
    location: toFormValue(car.location),
    color: toFormValue(car.color),
    description: toFormValue(car.description),
    transmission: getCanonicalOptionValue(TRANSMISSION_OPTIONS, toFormValue(car.transmission)),
  };
}

function getCarImageUrls(car) {
  if (Array.isArray(car.imageUrls) && car.imageUrls.length > 0) {
    return car.imageUrls.slice(0, MAX_IMAGE_COUNT);
  }

  if (car.imageUrl) {
    return [car.imageUrl];
  }

  return [];
}

function getCarImageName(car, index) {
  if (Array.isArray(car.imageNames) && car.imageNames[index]) {
    return car.imageNames[index];
  }

  return `기존 이미지 ${index + 1}`;
}

function SelectOptions({ options, currentValue = '' }) {
  const normalizedOptions = options.map((option) => (typeof option === 'string' ? { label: option, value: option } : option));
  const hasCurrentValue = currentValue && !normalizedOptions.some((option) => option.value === currentValue);

  return (
    <>
      {hasCurrentValue ? (
        <option className="text-slate-900" value={currentValue}>
          {currentValue}
        </option>
      ) : null}
      {normalizedOptions.map((option) => (
        <option className="text-slate-900" key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );
}

function CarEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, profile, isAuthenticated, isAuthLoading } = useAuth();
  const [car, setCar] = useState(null);
  const [form, setForm] = useState(INITIAL_CAR_FORM);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [imageInputMode, setImageInputMode] = useState(IMAGE_INPUT_MODES.upload);
  const [selectedSampleCarId, setSelectedSampleCarId] = useState('');
  const [selectedSampleImageUrls, setSelectedSampleImageUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const imageInputRef = useRef(null);
  const newImagesRef = useRef([]);

  useEffect(() => {
    newImagesRef.current = newImages;
  }, [newImages]);

  useEffect(() => {
    return () => {
      newImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    async function fetchCar() {
      try {
        setIsLoading(true);
        setError('');

        const response = await api.get(`/api/cars/${id}`);
        const carData = response.data.data;

        setCar(carData);
        setForm(buildFormFromCar(carData));
        setExistingImages(getCarImageUrls(carData).map((imageUrl, index) => ({
          id: `${imageUrl}-${index}`,
          imageUrl,
          imageName: getCarImageName(carData, index),
        })));
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

  function handleImageInputModeChange(nextMode) {
    setImageInputMode(nextMode);
    setError('');
  }

  function handleSampleCarSelect(sampleCar) {
    setSelectedSampleCarId((currentSampleCarId) => {
      if (currentSampleCarId !== sampleCar.id) {
        setSelectedSampleImageUrls([]);
        setError('');
      }

      return sampleCar.id;
    });
  }

  function handleSampleImageToggle(imageUrl) {
    setSelectedSampleImageUrls((currentUrls) => {
      if (currentUrls.includes(imageUrl)) {
        setError('');
        return currentUrls.filter((url) => url !== imageUrl);
      }

      if (existingImages.length + newImages.length + currentUrls.length >= MAX_IMAGE_COUNT) {
        setError(`기존 이미지와 새 이미지를 합쳐 최대 ${MAX_IMAGE_COUNT}장까지 관리할 수 있습니다.`);
        return currentUrls;
      }

      setError('');
      return [...currentUrls, imageUrl];
    });
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    const remainingSlots = MAX_IMAGE_COUNT - existingImages.length - newImages.length - selectedSampleImageUrls.length;
    const existingNewImageIds = new Set(newImages.map((image) => image.id));
    const nextImages = [];
    let hasDuplicate = false;

    for (const file of selectedFiles) {
      const imageId = `${file.name}-${file.size}-${file.lastModified}`;

      if (existingNewImageIds.has(imageId) || nextImages.some((image) => image.id === imageId)) {
        hasDuplicate = true;
        continue;
      }

      nextImages.push({
        id: imageId,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (nextImages.length > remainingSlots) {
      nextImages.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
      setError(`이미지는 최대 ${MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.`);
      event.target.value = '';
      return;
    }

    setError(hasDuplicate ? '이미 선택한 파일은 제외했습니다.' : '');
    setNewImages((currentImages) => [...currentImages, ...nextImages]);
    event.target.value = '';
  }

  function handleRemoveExistingImage(imageId) {
    setExistingImages((currentImages) => currentImages.filter((image) => image.id !== imageId));
  }

  function handleRemoveNewImage(imageId) {
    setNewImages((currentImages) => {
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

  function getSampleImageName(imageUrl) {
    return imageUrl.split('/').pop() || '샘플 이미지';
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (existingImages.length + newImages.length + selectedSampleImageUrls.length === 0) {
      setError(MIN_IMAGE_ERROR_MESSAGE);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      formData.append('uid', currentUser.uid);
      formData.append('keepImageUrls', JSON.stringify(existingImages.map((image) => image.imageUrl)));
      formData.append('keepImageNames', JSON.stringify(existingImages.map((image) => image.imageName)));
      formData.append('sampleImageUrls', JSON.stringify(selectedSampleImageUrls));
      formData.append('sampleImageNames', JSON.stringify(selectedSampleImageUrls.map(getSampleImageName)));

      newImages.forEach((image) => {
        formData.append('images', image.file);
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

  const selectedImageCount = existingImages.length + newImages.length + selectedSampleImageUrls.length;

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
                <SelectOptions options={LOCATION_OPTIONS} currentValue={form.location} />
              </select>
            </Field>

            <Field label="변속기">
              <select className={getSelectClass(form.transmission)} name="transmission" value={form.transmission} onChange={handleChange}>
                {selectPlaceholder}
                <SelectOptions options={TRANSMISSION_OPTIONS} />
              </select>
            </Field>

            <Field label="외장 색상">
              <input className={inputClass} name="color" value={form.color} onChange={handleChange} placeholder="예: 스노우 화이트 펄" />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="설명">
              <textarea className={textareaClass} name="description" value={form.description} onChange={handleChange} />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="차량 사진">
              <ImageInputTabs imageInputMode={imageInputMode} onImageInputModeChange={handleImageInputModeChange} />

              {imageInputMode === IMAGE_INPUT_MODES.sample ? (
                <div className="mt-3">
                  <SampleImageSelector
                    selectedSampleCarId={selectedSampleCarId}
                    selectedImageUrls={selectedSampleImageUrls}
                    onSampleCarSelect={handleSampleCarSelect}
                    onImageToggle={handleSampleImageToggle}
                    helperText={`기존 이미지와 새 이미지를 합쳐 최대 ${MAX_IMAGE_COUNT}장까지 관리할 수 있습니다. 현재 ${selectedImageCount}장 선택됨.`}
                  />
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
                    기존 이미지와 새 이미지를 합쳐 최대 {MAX_IMAGE_COUNT}장까지 관리할 수 있습니다. 현재 {selectedImageCount}장 선택됨.
                  </span>
                </>
              )}
            </Field>
            {selectedImageCount > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {existingImages.map((image, index) => (
                  <div key={image.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="aspect-[4/3] bg-slate-50">
                      <img src={image.imageUrl} alt={`기존 이미지 ${index + 1}`} className="h-full w-full object-contain object-center" />
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{image.imageName || `기존 이미지 ${index + 1}`}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                        onClick={() => handleRemoveExistingImage(image.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {newImages.map((image) => (
                  <div key={image.id} className="overflow-hidden rounded-lg border border-blue-100 bg-white">
                    <div className="aspect-[4/3] bg-slate-50">
                      <img src={image.previewUrl} alt={image.file.name} className="h-full w-full object-contain object-center" />
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{image.file.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                        onClick={() => handleRemoveNewImage(image.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {selectedSampleImageUrls.map((imageUrl, index) => (
                  <div key={imageUrl} className="overflow-hidden rounded-lg border border-blue-100 bg-white">
                    <div className="relative aspect-[4/3] bg-slate-50">
                      <img src={imageUrl} alt={`샘플 이미지 ${index + 1}`} className="h-full w-full object-contain object-center" />
                      <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-[11px] font-black text-white shadow-sm">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{getSampleImageName(imageUrl)}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                        onClick={() => handleSampleImageToggle(imageUrl)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">남은 이미지가 없으면 목록과 상세 화면에서 기본 placeholder가 표시됩니다.</p>
            )}
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
