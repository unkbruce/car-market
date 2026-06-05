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

  const fuelLabels = {
    gasoline: '가솔린',
    diesel: '디젤',
    hybrid: '하이브리드',
    electric: '전기',
    lpg: 'LPG',
  };

  const normalizedFuel = String(fuel).trim().toLowerCase();

  return fuelLabels[normalizedFuel] || fuel;
}
