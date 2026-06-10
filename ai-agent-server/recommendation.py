import hashlib
import re
from typing import Any

from normalizers import parse_numeric_value

Car = dict[str, Any]
Filters = dict[str, Any]


def _price_bucket(car: Car) -> str:
    price = parse_numeric_value(car.get("price"))

    if price is None:
        return "unknown"
    if price < 2000:
        return "low"
    if price < 5000:
        return "mid"

    return "high"


def _model_key(car: Car) -> str:
    name = str(car.get("name") or "").strip()
    tokens = [token for token in re.split(r"\s+", name) if token]

    if len(tokens) >= 3:
        return " ".join(tokens[:3])
    if len(tokens) >= 2:
        return " ".join(tokens[:2])

    return name or str(car.get("id") or "")


def _stable_shuffle(candidates: list[Car], session_id: str, query_signature: str, cycle: int) -> list[Car]:
    return sorted(
        candidates,
        key=lambda car: hashlib.sha256(
            f"{session_id}|{query_signature}|{cycle}|{car.get('id') or ''}".encode("utf-8")
        ).hexdigest(),
    )


def should_apply_diversity(filters: Filters, request_type: str = "new_search") -> bool:
    if request_type == "follow_up" or filters.get("sort_by") or filters.get("_sort_by"):
        return False

    strong_filter_keys = (
        "keyword",
        "location",
        "transmission",
        "min_price",
        "max_price",
        "min_year",
        "max_year",
        "min_mileage",
        "max_mileage",
    )
    if any(filters.get(key) not in (None, "") for key in strong_filter_keys):
        return False

    broad_filter_count = sum(
        1
        for key in ("company", "type", "fuel")
        if filters.get(key) not in (None, "")
    )
    return broad_filter_count <= 1


def _pick_diverse_from_ordered(candidates: list[Car], limit: int = 3, avoid_ids: set[str] | None = None) -> list[Car]:
    avoid_ids = avoid_ids or set()
    selected = []
    selected_ids = set()
    used_models = set()
    used_types = set()
    used_fuels = set()
    used_price_buckets = set()

    def add_car(car: Car, allow_avoided: bool = False) -> bool:
        car_id = car.get("id")
        if not car_id or car_id in selected_ids:
            return False
        if car_id in avoid_ids and not allow_avoided:
            return False

        selected.append(car)
        selected_ids.add(car_id)
        used_models.add(_model_key(car))
        used_types.add(str(car.get("type") or ""))
        used_fuels.add(str(car.get("fuel") or ""))
        used_price_buckets.add(_price_bucket(car))
        return len(selected) >= limit

    for car in candidates:
        model = _model_key(car)
        car_type = str(car.get("type") or "")
        fuel = str(car.get("fuel") or "")
        bucket = _price_bucket(car)

        if (
            model in used_models
            or car_type in used_types
            or fuel in used_fuels
            or bucket in used_price_buckets
        ):
            continue

        if add_car(car):
            return selected

    for car in candidates:
        if add_car(car):
            return selected

    for car in candidates:
        if add_car(car, allow_avoided=True):
            return selected

    return selected


def select_diverse_cars(
    candidates: list[Car],
    session_id: str,
    query_signature: str,
    shown_car_ids: list[str],
    limit: int = 3,
    cycle: int = 0,
    last_recommended_cars: list[Car] | None = None,
) -> tuple[list[Car], list[Car], int, bool]:
    shuffled = _stable_shuffle(candidates, session_id, query_signature, cycle)
    shown_ids = set(shown_car_ids)
    unshown = [car for car in shuffled if car.get("id") not in shown_ids]
    reset_shown = False

    if not unshown and candidates:
        cycle += 1
        reset_shown = True
        shuffled = _stable_shuffle(candidates, session_id, query_signature, cycle)
        unshown = shuffled

    last_ids = {
        str(car.get("id") or "")
        for car in (last_recommended_cars or [])
        if isinstance(car, dict)
    }
    selected = _pick_diverse_from_ordered(unshown, limit=limit, avoid_ids=last_ids)
    return selected, shuffled, cycle, reset_shown


def select_sorted_cars(candidates: list[Car], sort_by: str | None, sort_order: str | None, limit: int = 3) -> list[Car]:
    return candidates[:limit]
