import { COMPANY_OPTIONS, FUEL_OPTIONS, getOptionLabel } from './carOptions.js';

export function formatPrice(price) {
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice)) {
    return '가격 문의';
  }

  return `${numericPrice.toLocaleString('ko-KR')}만원`;
}

export function formatDistance(mileage) {
  const numericMileage = Number(mileage);

  if (!Number.isFinite(numericMileage)) {
    return '주행거리 미정';
  }

  return `${numericMileage.toLocaleString('ko-KR')}km`;
}

export function formatFuel(fuel) {
  if (!fuel) {
    return '연료 미정';
  }

  return getOptionLabel(FUEL_OPTIONS, fuel);
}

export function formatCompany(company) {
  if (!company) {
    return '제조사';
  }

  return getOptionLabel(COMPANY_OPTIONS, company);
}
