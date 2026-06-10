import re
from typing import Any, Optional

from tools import normalize_company_query, normalize_fuel_query, normalize_type_query

Car = dict[str, Any]

DOMESTIC_COMPANIES = {
    "HYUNDAI",
    "KIA",
    "GENESIS",
    "KG MOBILITY",
    "CHEVROLET",
    "RENAULT",
    "RENAULT KOREA",
}

IMPORTED_COMPANIES = {
    "BMW",
    "BENZ",
    "MERCEDES-BENZ",
    "AUDI",
    "VOLVO",
    "TESLA",
    "PORSCHE",
    "LAMBORGHINI",
    "ROLLS_ROYCE",
    "ROLLS-ROYCE",
    "TOYOTA",
    "LEXUS",
    "HONDA",
    "MINI",
    "LAND ROVER",
    "JEEP",
    "FORD",
    "VOLKSWAGEN",
}


def _company_key(company: Optional[str]) -> str:
    return str(company or "").strip().upper().replace("-", "_")


def _normalized_company_keys(company: Optional[str]) -> set[str]:
    raw_key = _company_key(company)
    normalized = normalize_company_query(company) or company or ""
    keys = {
        _company_key(value)
        for value in str(normalized).split(",")
        if str(value).strip()
    }
    if raw_key:
        keys.add(raw_key)
    return keys


def is_domestic_company(company: Optional[str]) -> bool:
    domestic_keys = {_company_key(value) for value in DOMESTIC_COMPANIES}
    return bool(_normalized_company_keys(company) & domestic_keys)


def is_imported_company(company: Optional[str]) -> bool:
    imported_keys = {_company_key(value) for value in IMPORTED_COMPANIES}
    return bool(_normalized_company_keys(company) & imported_keys)


def companies_for_origin(origin: Optional[str]) -> list[str]:
    if origin == "domestic":
        return sorted(DOMESTIC_COMPANIES)
    if origin == "imported":
        return sorted(IMPORTED_COMPANIES)
    return []


def matches_origin_constraint(car: Car, origin: str) -> bool:
    if origin == "domestic":
        return is_domestic_company(car.get("company"))
    if origin == "imported":
        return is_imported_company(car.get("company"))
    return True


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "").lower())


def contains_any(message: str, values: tuple[str, ...]) -> bool:
    normalized_message = normalize_text(message)
    return any(normalize_text(value) in normalized_message for value in values)


def normalize_company(company: Optional[str]) -> Optional[str]:
    return normalize_company_query(company)


def normalize_car_type(car_type: Optional[str]) -> Optional[str]:
    return normalize_type_query(car_type)


def normalize_fuel(fuel: Optional[str]) -> Optional[str]:
    return normalize_fuel_query(fuel)


def normalize_transmission(transmission: Optional[str]) -> Optional[str]:
    if not transmission or not str(transmission).strip():
        return None

    value = str(transmission).strip().lower()
    if value in {"auto", "automatic", "자동"}:
        return "auto"
    if value in {"manual", "수동"}:
        return "manual"

    return str(transmission).strip()


def parse_numeric_value(value: Any) -> int | None:
    if value is None or value == "":
        return None

    try:
        return int(str(value).replace(",", "").replace("만원", "").strip())
    except (TypeError, ValueError):
        return None


def parse_korean_price_to_manwon(text: str) -> int | None:
    value = str(text or "").strip()
    if not value:
        return None

    compact = re.sub(r"\s+", "", value.replace(",", ""))
    compact = compact.replace("원", "")
    total = 0

    eok_match = re.search(r"(\d+(?:\.\d+)?)억", compact)
    if eok_match:
        total += int(float(eok_match.group(1)) * 10000)
        rest = compact[eok_match.end():]

        cheon_match = re.search(r"(\d+)천", rest)
        if cheon_match:
            total += int(cheon_match.group(1)) * 1000
            rest = rest[cheon_match.end():]

        baek_match = re.search(r"(\d+)백", rest)
        if baek_match:
            total += int(baek_match.group(1)) * 100
            rest = rest[baek_match.end():]

        man_match = re.search(r"(\d+)만?", rest)
        if man_match:
            total += int(man_match.group(1))
            return total

        trailing_number = re.match(r"(\d+)", rest)
        if trailing_number:
            total += int(trailing_number.group(1))

        return total if total > 0 else None

    cheon_match = re.search(r"(\d+)천(?:만)?", compact)
    if cheon_match:
        total += int(cheon_match.group(1)) * 1000
        rest = compact[cheon_match.end():]
        trailing_number = re.match(r"(\d+)", rest)
        if trailing_number:
            total += int(trailing_number.group(1))
        return total

    manwon_match = re.search(r"(\d+)만", compact)
    if manwon_match:
        return int(manwon_match.group(1))

    if re.fullmatch(r"\d+", compact):
        return int(compact)

    return None


def normalize_car(car: Car) -> Car | None:
    car_id = car.get("id") or car.get("_id")

    if not car_id:
        return None

    image_url = car.get("imageUrl")

    if not image_url and isinstance(car.get("imageUrls"), list) and car["imageUrls"]:
        image_url = car["imageUrls"][0]

    return {
        "id": str(car_id),
        "_id": str(car_id),
        "name": car.get("name"),
        "company": car.get("company"),
        "year": car.get("year"),
        "price": car.get("price"),
        "mileage": car.get("mileage"),
        "type": car.get("type"),
        "fuel": car.get("fuel"),
        "transmission": car.get("transmission"),
        "location": car.get("location"),
        "color": car.get("color"),
        "imageUrl": image_url,
    }


def normalize_many(candidates: list | tuple, limit: int = 8) -> list[Car]:
    cars = []
    seen_ids = set()

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue

        car = normalize_car(candidate)

        if not car or car["id"] in seen_ids:
            continue

        seen_ids.add(car["id"])
        cars.append(car)

        if len(cars) >= limit:
            break

    return cars


def matches_type_constraint(car: Car, exact_type: str, broad_types: list[str]) -> bool:
    car_type = str(car.get("type") or "").strip()

    if exact_type:
        return car_type == exact_type

    if broad_types:
        return car_type in broad_types

    return True
