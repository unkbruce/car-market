export const DOMESTIC_COMPANY_OPTIONS = [
  { label: '현대', value: 'HYUNDAI', aliases: ['현대'] },
  { label: '기아', value: 'KIA', aliases: ['기아'] },
  { label: '제네시스', value: 'GENESIS', aliases: ['제네시스'] },
  { label: 'KG모빌리티', value: 'KG MOBILITY', aliases: ['KG', 'KG모빌리티'] },
  { label: '르노코리아', value: 'RENAULT', aliases: ['르노', '르노코리아'] },
  { label: '쉐보레', value: 'CHEVROLET', aliases: ['쉐보레'] },
];

export const IMPORTED_COMPANY_OPTIONS = [
  { label: 'BMW', value: 'BMW' },
  { label: '벤츠', value: 'BENZ', aliases: ['벤츠'] },
  { label: '아우디', value: 'AUDI', aliases: ['아우디'] },
  { label: '볼보', value: 'VOLVO', aliases: ['볼보'] },
  { label: '렉서스', value: 'LEXUS', aliases: ['렉서스'] },
  { label: '테슬라', value: 'TESLA', aliases: ['테슬라'] },
  { label: '포르쉐', value: 'PORSCHE', aliases: ['포르쉐'] },
  { label: '람보르기니', value: 'LAMBORGHINI', aliases: ['람보르기니'] },
  { label: '롤스로이스', value: 'ROLLS_ROYCE', aliases: ['롤스로이스'] },
  { label: '기타 수입차', value: '기타', aliases: ['기타 제조사', '기타 수입차'] },
];

export const COMPANY_GROUPS = [
  { key: 'domestic', label: '국산차', options: DOMESTIC_COMPANY_OPTIONS },
  { key: 'imported', label: '수입차', options: IMPORTED_COMPANY_OPTIONS },
];

export const COMPANY_OPTIONS = COMPANY_GROUPS.flatMap((group) => group.options);

export const TYPE_OPTIONS = [
  '경차',
  '소형차',
  '준중형차',
  '중형차',
  '준대형차',
  '대형차',
  '스포츠카',
  '쿠페',
  '컨버터블',
  '해치백',
  '왜건',
  'SUV',
  'RV',
  '미니밴',
  '승합차',
  '화물차',
  '픽업트럭',
  '기타',
];

export const LOCATION_OPTIONS = [
  '서울',
  '경기',
  '인천',
  '부산',
  '대구',
  '대전',
  '광주',
  '울산',
  '세종',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

export const FUEL_OPTIONS = [
  { label: '가솔린', value: 'gasoline', aliases: ['Gasoline'] },
  { label: '디젤', value: 'diesel', aliases: ['Diesel'] },
  { label: 'LPG', value: 'LPG', aliases: ['lpg'] },
  { label: '하이브리드', value: 'hybrid', aliases: ['Hybrid'] },
  { label: '전기', value: 'electric', aliases: ['Electric'] },
  { label: '기타', value: '기타' },
];

export const TRANSMISSION_OPTIONS = [
  { label: '오토', value: 'auto', aliases: ['Auto'] },
  { label: '수동', value: 'manual', aliases: ['Manual'] },
  { label: 'CVT', value: 'CVT', aliases: ['cvt'] },
  { label: '기타', value: '기타' },
];

function normalizeComparableValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function findOptionByValueOrAlias(options, value) {
  const normalizedValue = normalizeComparableValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return options.find((option) => {
    const candidates = [option.value, option.label, ...(option.aliases || [])];

    return candidates.some((candidate) => normalizeComparableValue(candidate) === normalizedValue);
  });
}

export function getOptionLabel(options, value) {
  return findOptionByValueOrAlias(options, value)?.label || value;
}

export function getCanonicalOptionValue(options, value) {
  return findOptionByValueOrAlias(options, value)?.value || value;
}

export function getQueryValues(options, value) {
  const option = findOptionByValueOrAlias(options, value);

  if (!option) {
    return [value];
  }

  return [option.value, ...(option.aliases || [])];
}
