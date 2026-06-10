import re
from typing import Any, Optional

from tools import normalize_company_query, normalize_fuel_query, normalize_type_query

Car = dict[str, Any]


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
