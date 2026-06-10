from typing import Any

from query_parser import build_query_signature, public_filter_args

Car = dict[str, Any]
Filters = dict[str, Any]

session_context: dict[str, dict] = {}


def get_session(session_id: str) -> dict:
    state = session_context.setdefault(session_id, {})
    state.setdefault("shown_car_ids", [])
    state.setdefault("last_recommended_cars", [])
    state.setdefault("recommendation_offset", 0)
    state.setdefault("recommendation_cycle", 0)
    state.setdefault("last_query_signature", "")
    state.setdefault("recommendation_exhausted", False)
    return state


def get_shown_car_ids(session_id: str) -> list[str]:
    state = get_session(session_id)
    return [
        str(car_id)
        for car_id in state.get("shown_car_ids", [])
        if str(car_id).strip()
    ]


def update_last_filters(session_id: str, filters: Filters) -> None:
    state = get_session(session_id)
    public_filters = public_filter_args(filters)

    if public_filters:
        state["last_filters"] = public_filters
        state["last_query_signature"] = build_query_signature(filters)


def update_last_recommended_cars(session_id: str, cars: list[Car]) -> None:
    if not cars:
        return

    state = get_session(session_id)
    state["last_recommended_cars"] = [
        {
            "id": str(car.get("id") or car.get("_id") or ""),
            "name": car.get("name"),
        }
        for car in cars
        if str(car.get("id") or car.get("_id") or "").strip()
    ]


def add_shown_car_ids(session_id: str, car_ids: list[str]) -> None:
    if not car_ids:
        return

    state = get_session(session_id)
    shown_car_ids = state.setdefault("shown_car_ids", [])
    seen = set(shown_car_ids)
    added_count = 0

    for car_id in car_ids:
        if car_id and car_id not in seen:
            shown_car_ids.append(car_id)
            seen.add(car_id)
            added_count += 1

    state["recommendation_offset"] = int(state.get("recommendation_offset") or 0) + added_count
    state["recommendation_exhausted"] = False


def remember_recommendation(session_id: str, filters: Filters, cars: list[Car]) -> None:
    if not cars:
        return

    update_last_filters(session_id, filters)
    update_last_recommended_cars(session_id, cars)
    add_shown_car_ids(session_id, [str(car.get("id") or "") for car in cars])


def reset_recommendation_state(session_id: str) -> None:
    state = get_session(session_id)
    state["shown_car_ids"] = []
    state["recommendation_offset"] = 0
    state["recommendation_cycle"] = 0
    state["recommendation_exhausted"] = False


def get_last_recommended_cars(session_id: str) -> list[Car]:
    state = get_session(session_id)
    cars = state.get("last_recommended_cars")

    if not isinstance(cars, list):
        return []

    return [
        car
        for car in cars
        if isinstance(car, dict) and str(car.get("id") or "").strip()
    ]
