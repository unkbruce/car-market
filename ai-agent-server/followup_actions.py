import json
import re
from typing import Any, Callable

from normalizers import normalize_many
from query_parser import detect_action, detect_ordinal_indexes
from response_formatter import format_compare_response, format_detail_response
from session_store import get_last_recommended_cars, get_session, get_shown_car_ids

Car = dict[str, Any]


def _missing_recommendation_result(action: str) -> dict:
    if action == "compare":
        answer = "비교할 추천 차량이 없습니다.\n먼저 차량을 검색하거나 추천받아주세요."
    elif action == "dealer_message":
        answer = "문의할 차량을 먼저 선택해주세요.\n먼저 차량을 검색하거나 추천받아주세요."
    else:
        answer = "먼저 차량을 검색하거나 추천받아주세요.\n추천 결과가 나오면 첫 번째, 두 번째처럼 차량을 선택할 수 있습니다."

    return {
        "answer": answer,
        "selected_car_ids": [],
        "cars": [],
    }


def _invalid_recommendation_index_result(indexes: list[int], available_count: int) -> dict:
    requested = ", ".join(f"{index + 1}번" for index in indexes) or "요청한 순번"
    available = "추천 차량이 없습니다" if available_count == 0 else f"현재 추천 목록에는 {available_count}대만 있습니다"

    return {
        "answer": f"{available}.\n{requested} 차량을 선택할 수 없습니다.",
        "selected_car_ids": [],
        "cars": [],
    }


def _extract_question_for_dealer(message: str, car_name: str) -> str:
    question = str(message or "").strip()
    for token in (
        "첫 번째 차량",
        "첫번째 차량",
        "첫 번째",
        "첫번째",
        "1번 차량",
        "1번",
        "두 번째 차량",
        "두번째 차량",
        "두 번째",
        "두번째",
        "2번 차량",
        "2번",
        "세 번째 차량",
        "세번째 차량",
        "세 번째",
        "세번째",
        "3번 차량",
        "3번",
        "딜러에게",
        "문의 메시지",
        "메시지",
        "작성해줘",
        "작성",
        car_name,
    ):
        question = question.replace(token, " ")

    question = re.sub(r"\s+", " ", question).strip()
    return question or "사고 이력, 정비 이력, 추가 비용이 있는지 확인하고 싶습니다."


def _invoke_json_tool(tool, args: dict) -> dict:
    try:
        result = tool.invoke(args)
        payload = json.loads(result)
    except Exception:
        return {"success": False}

    return payload if isinstance(payload, dict) else {"success": False}


def handle_detail_request(message: str, session_id: str, get_car_detail_tool) -> dict | None:
    indexes = detect_ordinal_indexes(message)
    if not indexes:
        return None

    last_cars = get_last_recommended_cars(session_id)
    if not last_cars:
        return _missing_recommendation_result("detail")

    if any(index < 0 or index >= len(last_cars) for index in indexes):
        return _invalid_recommendation_index_result(indexes, len(last_cars))

    selected_ref = last_cars[indexes[0]]
    payload = _invoke_json_tool(get_car_detail_tool, {"car_id": selected_ref["id"]})

    if payload.get("success") is not True or not isinstance(payload.get("data"), dict):
        return {
            "answer": "차량 상세 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해주세요.",
            "selected_car_ids": [],
            "cars": [],
        }

    cars = normalize_many([payload.get("data")], limit=1)
    selected_ids = [car["id"] for car in cars]
    return {
        "answer": format_detail_response(cars[0]) if cars else "차량 상세 정보가 없습니다.",
        "selected_car_ids": selected_ids,
        "cars": cars,
    }


def handle_compare_request(message: str, session_id: str, compare_cars_tool) -> dict | None:
    indexes = detect_ordinal_indexes(message)
    if not indexes:
        return None

    last_cars = get_last_recommended_cars(session_id)
    if not last_cars:
        return _missing_recommendation_result("compare")

    compare_indexes = indexes[:2]
    if len(compare_indexes) < 2:
        compare_indexes = [0, 1]

    if any(index < 0 or index >= len(last_cars) for index in compare_indexes):
        return _invalid_recommendation_index_result(compare_indexes, len(last_cars))

    first_ref = last_cars[compare_indexes[0]]
    second_ref = last_cars[compare_indexes[1]]
    payload = _invoke_json_tool(compare_cars_tool, {
        "first_car_id": first_ref["id"],
        "second_car_id": second_ref["id"],
    })

    if payload.get("success") is not True:
        return {
            "answer": "비교할 차량 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해주세요.",
            "selected_car_ids": [],
            "cars": [],
        }

    cars = normalize_many([payload.get("first"), payload.get("second")], limit=2)
    selected_ids = [car["id"] for car in cars]
    return {
        "answer": format_compare_response(cars[0], cars[1]) if len(cars) == 2 else "비교할 차량 정보가 부족합니다.",
        "selected_car_ids": selected_ids,
        "cars": cars,
    }


def handle_dealer_message_request(message: str, session_id: str, make_dealer_message_tool) -> dict | None:
    indexes = detect_ordinal_indexes(message)
    if not indexes:
        return None

    last_cars = get_last_recommended_cars(session_id)
    if not last_cars:
        return _missing_recommendation_result("dealer_message")

    if any(index < 0 or index >= len(last_cars) for index in indexes):
        return _invalid_recommendation_index_result(indexes, len(last_cars))

    selected_ref = last_cars[indexes[0]]
    question = _extract_question_for_dealer(message, str(selected_ref.get("name") or ""))
    payload = _invoke_json_tool(make_dealer_message_tool, {
        "car_name": selected_ref.get("name") or "선택한 차량",
        "question": question,
    })
    answer = payload.get("message") if payload.get("success") is True else ""
    return {
        "answer": answer or "문의 메시지 초안을 작성하지 못했습니다.\n잠시 후 다시 시도해주세요.",
        "selected_car_ids": [],
        "cars": [],
    }


def handle_referenced_action(
    message: str,
    session_id: str,
    get_car_detail_tool,
    compare_cars_tool,
    make_dealer_message_tool,
    is_development: Callable[[], bool],
) -> dict | None:
    action = detect_action(message)
    indexes = detect_ordinal_indexes(message)

    if not action or not indexes:
        return None

    last_cars = get_last_recommended_cars(session_id)

    if is_development():
        print(f"detected action: {action}")
        print(f"requested indexes: {','.join(str(index + 1) for index in indexes)}")
        print(f"last recommended car ids: {','.join(str(car.get('id')) for car in last_cars)}")

    if action == "compare":
        return handle_compare_request(message, session_id, compare_cars_tool)
    if action == "dealer_message":
        return handle_dealer_message_request(message, session_id, make_dealer_message_tool)

    return handle_detail_request(message, session_id, get_car_detail_tool)


def handle_followup_recommendation(
    session_id: str,
    run_search: Callable[[dict, str, str], dict],
) -> dict:
    state = get_session(session_id)
    last_filters = state.get("last_filters")

    if not isinstance(last_filters, dict) or not last_filters:
        return {
            "answer": "어떤 제조사나 차종의 다른 차량을 찾으시는지 알려주세요.",
            "selected_car_ids": [],
            "cars": [],
        }

    shown_car_ids = get_shown_car_ids(session_id)
    filters = {
        **last_filters,
        "exclude_ids": ",".join(shown_car_ids),
        "limit": 50,
    }

    result = run_search(filters, session_id, "follow_up")

    if not result["cars"]:
        result["answer"] = "현재 조건에서 추가로 추천할 등록 차량이 없습니다.\n예산, 차종, 연식 조건을 바꾸면 다시 찾아드릴게요."

    return result
