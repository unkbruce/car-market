import { Link } from 'react-router-dom';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { PLACEHOLDER_IMAGE } from './CarImagePlaceholder.jsx';
import { formatDistance, formatFuel, formatPrice } from '../utils/formatters.js';

function getCarImage(car) {
  if (Array.isArray(car.imageUrls) && car.imageUrls.length > 0) {
    return car.imageUrls[0];
  }

  if (Array.isArray(car.images) && car.images.length > 0) {
    return car.images[0];
  }

  return car.imageUrl || car.image || car.thumbnailUrl || '';
}

function CarCardImage({ imageUrl, name }) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageClass = 'h-full w-full object-contain object-center transition duration-300 group-hover:scale-[1.02]';
  const shouldShowPlaceholder = !imageUrl || hasImageError;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-slate-50">
      {shouldShowPlaceholder ? (
        <img src={PLACEHOLDER_IMAGE} alt="차량 placeholder" className="mx-auto h-full w-[90%] object-contain object-center transition duration-300 group-hover:scale-[1.02]" />
      ) : (
        <img
          src={imageUrl}
          alt={name || '차량 이미지'}
          className={imageClass}
          onError={() => {
            setHasImageError(true);
          }}
        />
      )}
    </div>
  );
}

function CarCard({ car }) {
  const imageUrl = getCarImage(car);

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(15,23,42,0.11)]">
      <CarCardImage imageUrl={imageUrl} name={car.name} />

      <div className="flex flex-1 flex-col p-2.5">
        <div>
          <h3 className="line-clamp-2 min-h-[2.1rem] text-[14px] font-bold leading-snug tracking-tight text-slate-950">
            {car.name || '이름 없는 차량'}
          </h3>
          <p className="mt-1 text-[12px] leading-tight text-slate-500">
            {car.year ? `${car.year}년식` : '연식 미정'} · {formatDistance(car.mileage)}
          </p>
          <p className="mt-0.5 text-[12px] leading-tight text-slate-500">
            {formatFuel(car.fuel)} · {car.location || '지역 미정'}
          </p>
          <p className="mt-1.5 text-[18px] font-extrabold leading-none tracking-tight text-slate-950">
            {formatPrice(car.price)}
          </p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
          <Link
            to={`/cars/${car._id}`}
            className="inline-flex h-[30px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
          >
            상세 보기
          </Link>
          <button
            type="button"
            className="inline-flex h-[30px] items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 text-[11px] font-semibold text-white shadow-[0_4px_10px_rgba(37,99,235,0.18)] transition hover:bg-blue-700"
          >
            <MessageCircle size={12} />
            상담하기
          </button>
        </div>
      </div>
    </article>
  );
}

export default CarCard;
