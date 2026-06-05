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

