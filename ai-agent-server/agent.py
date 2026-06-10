import json
import hashlib
import os
import re
import time

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from tools import COMPANY_ALIASES, TOOLS, normalize_company_query, normalize_fuel_query, normalize_type_query

load_dotenv()

SYSTEM_PROMPT = """당신은 CarMarket의 한국어 AI 차량 상담사입니다.

핵심 규칙:
- 차량 정보, 가격, 재고, ID는 반드시 Tool 결과만 근거로 답변합니다.
- 검색 결과에 없는 차량, 가격, 연식, 주행거리, 옵션을 만들지 않습니다.
- 제조사만 있어도 먼저 search_cars Tool을 호출해 해당 제조사 전체 차량을 검색합니다.
- 조건이 부족하다는 이유만으로 검색하지 않고 결과가 없다고 말하지 않습니다.
- 가격 단위는 만원입니다.
- 추천은 최대 3대까지만 제시합니다.
- 목록 API 데이터만으로 추천할 수 있으면 상세 API를 추가 호출하지 않습니다.
- 상세 조회는 사용자가 특정 차량의 상세 정보를 요청했을 때만 사용합니다.
- 차량 비교 요청은 가능하면 먼저 검색으로 실제 차량 ID를 확인한 뒤 compare_cars를 사용합니다.
- 사용자가 이름을 제공하지 않은 경우 딜러 메시지에 임의 이름을 만들지 않습니다.

후속 질문 규칙:
- 사용자가 '전체 다', '다 보여줘', '조건 없이', '아무거나', '전부', '전체 차량'처럼 말하면 이전 대화의 명확한 제조사 조건을 유지합니다.
- 이전 제조사 조건이 없다면 전체 차량을 바로 검색하지 말고 다음 문장으로 확인합니다.
전체 제조사의 차량을 찾으시는 건가요, 아니면 이전에 말씀하신 제조사 전체 차량을 찾으시는 건가요?

추천 순서 규칙:
- 추천 답변은 search_cars Tool 결과 순서를 그대로 따릅니다.
- 1순위는 Tool 결과 첫 번째 차량입니다.
- 2순위는 Tool 결과 두 번째 차량입니다.
- 3순위는 Tool 결과 세 번째 차량입니다.
- 임의로 순서를 바꾸거나 Tool 결과에 없는 차량을 끼워 넣지 않습니다.
- 추천 차량명은 Tool 결과의 name 값을 그대로 씁니다.

출력 형식 규칙:
- 마크다운 문법을 절대 사용하지 않습니다.
- 별표, 샵, 표, 코드블록, 굵게 표시 문법을 쓰지 않습니다.
- 일반 텍스트와 줄바꿈만 사용합니다.
- 문장은 짧고 읽기 쉽게 씁니다.
- 차량별 구분이 명확해야 합니다.

추천 답변 형식:
1순위. 차량명

연식: 2026년
가격: 4,300만원
주행거리: 8,500km
연료: 가솔린
변속기: 자동
지역: 서울

추천 이유:
출퇴근용으로 승차감과 실내 공간이 좋습니다.

확인할 점:
사고 이력과 추가 비용을 확인해보세요.

2순위가 있으면 같은 형식으로 이어서 작성합니다.
"""

MODEL_NAME = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
AMBIGUOUS_ALL_PATTERNS = ("전체 다", "다 보여줘", "조건 없이", "아무거나", "전부", "전체 차량")
DETAIL_HINTS = ("상세", "비교", "문의", "메시지")
CONSTRAINT_HINTS = ("suv", "SUV", "만원", "이하", "이상", "년식", "이후", "이전", "경차", "세단", "디젤", "가솔린", "전기", "하이브리드")

model = ChatOpenAI(model=MODEL_NAME, temperature=0).bind_tools(TOOLS)
tool_node = ToolNode(TOOLS)
session_context: dict[str, dict] = {}
search_cars_tool = next(tool for tool in TOOLS if tool.name == "search_cars")
get_car_detail_tool = next(tool for tool in TOOLS if tool.name == "get_car_detail")
compare_cars_tool = next(tool for tool in TOOLS if tool.name == "compare_cars")
make_dealer_message_tool = next(tool for tool in TOOLS if tool.name == "make_dealer_message")


def call_model(state: MessagesState) -> dict:
    response = model.invoke([SystemMessage(content=SYSTEM_PROMPT), *state["messages"]])
    return {"messages": [response]}


def should_continue(state: MessagesState) -> str:
    last_message = state["messages"][-1]

    if getattr(last_message, "tool_calls", None):
        return "tools"

    return END


workflow = StateGraph(MessagesState)
workflow.add_node("model", call_model)
workflow.add_node("tools", tool_node)
workflow.add_edge(START, "model")
workflow.add_conditional_edges("model", should_continue, {"tools": "tools", END: END})
workflow.add_edge("tools", "model")

# 메모리 기반 checkpointer라 Python 서버 재시작 시 대화 문맥은 초기화됩니다.
checkpointer = InMemorySaver()
graph = workflow.compile(checkpointer=checkpointer)


def _is_development() -> bool:
    return os.getenv("ENV") == "development" or os.getenv("NODE_ENV") == "development"


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "").lower())


def _detect_company(message: str) -> str:
    normalized_message = _normalize_text(message)

    for canonical, aliases in COMPANY_ALIASES.items():
        for candidate in [canonical, *aliases]:
            if _normalize_text(candidate) and _normalize_text(candidate) in normalized_message:
                return normalize_company_query(canonical) or canonical

    return ""


def _contains_any(message: str, values: tuple[str, ...]) -> bool:
    normalized_message = _normalize_text(message)
    return any(_normalize_text(value) in normalized_message for value in values)


def _get_session_state(session_id: str) -> dict:
    state = session_context.setdefault(session_id, {})
    state.setdefault("shown_car_ids", [])
    return state


def _is_followup_recommendation(message: str) -> bool:
    compact_message = "".join(str(message).lower().split())
    patterns = (
        "\ub2e4\ub978\ucc28\ub3c4\uc54c\ub824\uc918",
        "\ub2e4\ub978\ucc28\ub3c4\uc54c\ub824\uc8fc\uc138\uc694",
        "\ub2e4\ub978\ucc28\ub7c9\ucd94\ucc9c\ud574\uc918",
        "\ub2e4\ub978\ucc28\ub7c9\ucd94\ucc9c\ud574\uc8fc\uc138\uc694",
        "\ub2e4\ub978\uae30\uc544\ucc28\ub3c4\uc54c\ub824\uc918",
        "\ub2e4\ub978\uae30\uc544\ucc28\ub3c4\uc54c\ub824\uc8fc\uc138\uc694",
        "\ub2e4\uc74c\ucc28\ub7c9\ubcf4\uc5ec\uc918",
        "\ub2e4\uc74c\ucc28\ub7c9\ubcf4\uc5ec\uc8fc\uc138\uc694",
        "\ub354\ubcf4\uc5ec\uc918",
        "\ub354\ubcf4\uc5ec\uc8fc\uc138\uc694",
        "\ub2e4\ub978\uac83\ub3c4",
        "\ub610\ucd94\ucc9c\ud574\uc918",
        "\ub610\ucd94\ucc9c\ud574\uc8fc\uc138\uc694",
        "\ub610\ub2e4\ub978\ucc28",
    )
    if _contains_any(compact_message, patterns):
        return True

    return (
        "\ub2e4\ub978" in compact_message
        and any(token in compact_message for token in ("\ubcf4\uc5ec", "\uc54c\ub824", "\ucd94\ucc9c"))
    )


def _public_filter_args(filters: dict) -> dict:
    return {
        key: value
        for key, value in filters.items()
        if not key.startswith("_") and key not in {"exclude_ids", "limit"} and value is not None and str(value).strip() != ""
    }


def _query_signature(filters: dict) -> str:
    public_filters = _public_filter_args(filters)
    parts = [
        f"{key}={public_filters[key]}"
        for key in sorted(public_filters)
    ]
    return "&".join(parts)


def _has_explicit_sort(filters: dict) -> bool:
    return bool(filters.get("sort_by") or filters.get("_sort_by"))


def _reset_recommendation_state(state: dict) -> None:
    state["shown_car_ids"] = []
    state["recommendation_offset"] = 0
    state["recommendation_cycle"] = 0
    state["recommendation_exhausted"] = False


def _shown_ids(state: dict) -> list[str]:
    return [
        str(car_id)
        for car_id in state.get("shown_car_ids", [])
        if str(car_id).strip()
    ]


def _remember_recommendation(session_id: str, filters: dict, cars: list[dict]) -> None:
    if not cars:
        return

    state = _get_session_state(session_id)
    public_filters = _public_filter_args(filters)
    shown_car_ids = state.setdefault("shown_car_ids", [])
    seen = set(shown_car_ids)
    added_count = 0

    if public_filters:
        state["last_filters"] = public_filters
        state["last_query_signature"] = _query_signature(filters)

    state["last_recommended_cars"] = [
        {
            "id": str(car.get("id") or car.get("_id") or ""),
            "name": car.get("name"),
        }
        for car in cars
        if str(car.get("id") or car.get("_id") or "").strip()
    ]

    for car in cars:
        car_id = str(car.get("id") or car.get("_id") or "").strip()
        if car_id not in seen:
            shown_car_ids.append(car_id)
            seen.add(car_id)
            added_count += 1

    state["recommendation_offset"] = int(state.get("recommendation_offset") or 0) + added_count
    state["recommendation_exhausted"] = False


def _detect_type(message: str) -> str:
    normalized_message = _normalize_text(message)

    if "suv" in normalized_message:
        return normalize_type_query("SUV") or "SUV"

    type_patterns = (
        ("세단", ("세단", "sedan")),
        ("경차", ("경차",)),
        ("미니밴", ("미니밴", "minivan", "van")),
        ("화물차", ("화물차", "truck")),
        ("준중형차", ("준중형차",)),
        ("중형차", ("중형차",)),
        ("준대형차", ("준대형차",)),
        ("대형차", ("대형차",)),
        ("소형차", ("소형차",)),
    )

    for normalized_type, patterns in type_patterns:
        if _contains_any(message, patterns):
            return normalize_type_query(normalized_type) or normalized_type

    return ""


def _detect_type_constraints(message: str) -> tuple[str, list[str]]:
    normalized_message = _normalize_text(message)

    if "suv" in normalized_message:
        return "SUV", []

    exact_patterns = (
        ("\uc900\uc911\ud615\ucc28", ("\uc900\uc911\ud615\ucc28", "\uc900\uc911\ud615\uc138\ub2e8", "\uc900\uc911\ud615")),
        ("\uc900\ub300\ud615\ucc28", ("\uc900\ub300\ud615\ucc28", "\uc900\ub300\ud615\uc138\ub2e8", "\uc900\ub300\ud615")),
        ("\ub300\ud615\ucc28", ("\ub300\ud615\ucc28", "\ub300\ud615\uc138\ub2e8", "\ub300\ud615")),
        ("\uc911\ud615\ucc28", ("\uc911\ud615\ucc28", "\uc911\ud615\uc138\ub2e8", "\uc911\ud615")),
        ("\uc18c\ud615\ucc28", ("\uc18c\ud615\ucc28", "\uc18c\ud615\uc138\ub2e8", "\uc18c\ud615")),
        ("\uacbd\ucc28", ("\uacbd\ucc28",)),
        ("\ubbf8\ub2c8\ubc34", ("\ubbf8\ub2c8\ubc34", "minivan", "van")),
        ("\ud654\ubb3c\ucc28", ("\ud654\ubb3c\ucc28", "truck")),
    )

    for exact_type, patterns in exact_patterns:
        if any(_normalize_text(pattern) in normalized_message for pattern in patterns):
            return exact_type, []

    if any(_normalize_text(pattern) in normalized_message for pattern in ("\uc138\ub2e8", "\uc2b9\uc6a9\uc138\ub2e8", "sedan")):
        return "", ["\uc900\uc911\ud615\ucc28", "\uc911\ud615\ucc28", "\uc900\ub300\ud615\ucc28", "\ub300\ud615\ucc28"]

    return "", []


def _matches_type_constraint(car: dict, exact_type: str, broad_types: list[str]) -> bool:
    car_type = str(car.get("type") or "").strip()

    if exact_type:
        return car_type == exact_type

    if broad_types:
        return car_type in broad_types

    return True


def _detect_fuel(message: str) -> str:
    fuel_patterns = (
        ("electric", ("전기", "전기차", "electric", "ev")),
        ("hybrid", ("하이브리드", "hybrid")),
        ("gasoline", ("가솔린", "휘발유", "gasoline", "petrol")),
        ("diesel", ("디젤", "diesel")),
        ("LPG", ("lpg", "엘피지")),
    )

    for normalized_fuel, patterns in fuel_patterns:
        if _contains_any(message, patterns):
            return normalize_fuel_query(normalized_fuel) or normalized_fuel

    return ""


def _detect_max_price(message: str) -> int | None:
    patterns = (
        r"(\d{2,6})\s*만원\s*(?:이하|까지|미만|아래)",
        r"(\d{2,6})\s*만\s*원\s*(?:이하|까지|미만|아래)",
    )

    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            return int(match.group(1))

    return None


def _detect_min_year(message: str) -> int | None:
    patterns = (
        r"(\d{4})\s*\ub144\s*(?:\uc774\ud6c4|\ubd80\ud130|\uc774\uc0c1)",
        r"(\d{4})\s*(?:\ub144\uc2dd)?\s*(?:\uc774\ud6c4|\ubd80\ud130|\uc774\uc0c1)",
    )

    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            return int(match.group(1))

    return None


def _detect_sort(message: str) -> tuple[str, str]:
    sort_patterns = (
        ("price", "desc", ("\ube44\uc2fc\uac00\uaca9\uc21c", "\ube44\uc2fc\uc21c", "\uac00\uaca9\ub192\uc740\uc21c", "\uace0\uac00\uc21c", "\uac00\uc7a5\ube44\uc2fc", "\ucd5c\uace0\uac00")),
        ("price", "asc", ("\uc800\ub834\ud55c\uc21c", "\uc2fc\uc21c", "\uac00\uaca9\ub0ae\uc740\uc21c", "\ucd5c\uc800\uac00")),
        ("year", "desc", ("\ucd5c\uc2e0\uc5f0\uc2dd\uc21c", "\ucd5c\uc2e0\uc5f0\uc2dd", "\uc2e0\ud615\uc21c", "\uc5f0\uc2dd\ub192\uc740\uc21c", "\uc5f0\uc2dd\ub192\uc740", "\ucd5c\uc2e0\ub144\uc2dd")),
        ("year", "asc", ("\uc624\ub798\ub41c\uc5f0\uc2dd", "\uc5f0\uc2dd\ub0ae\uc740\uc21c", "\uc5f0\uc2dd\uc624\ub984\ucc28\uc21c", "\uc624\ub798\ub41c")),
        ("mileage", "asc", ("\uc8fc\ud589\uac70\ub9ac\uc9e7\uc740\uc21c", "\uc801\uac8c\ud0c4\uc21c")),
        ("mileage", "desc", ("\uc8fc\ud589\uac70\ub9ac\ub9ce\uc740\uc21c", "\ub9ce\uc774\ud0c4\uc21c")),
    )

    normalized_message = _normalize_text(message)

    for sort_by, sort_order, patterns in sort_patterns:
        if any(_normalize_text(pattern) in normalized_message for pattern in patterns):
            return sort_by, sort_order

    if "\ucd5c\uc2e0\uc21c" in normalized_message:
        return "year", "desc"

    return "", ""


def _is_search_or_recommendation(message: str) -> bool:
    if _contains_any(message, DETAIL_HINTS):
        return False

    return _contains_any(message, ("추천", "검색", "찾아", "찾아줘", "보여", "보여줘", "있어", "알려줘"))


def _is_ambiguous_all_request(message: str) -> bool:
    normalized_message = _normalize_text(message)
    return any(_normalize_text(pattern) in normalized_message for pattern in AMBIGUOUS_ALL_PATTERNS)


def _is_simple_company_recommendation(message: str, company: str) -> bool:
    if not company:
        return False

    normalized_message = _normalize_text(message)

    if any(_normalize_text(hint) in normalized_message for hint in DETAIL_HINTS):
        return False

    if any(_normalize_text(hint) in normalized_message for hint in CONSTRAINT_HINTS):
        return False

    return "추천" in message or "찾" in message or "보여" in message


def _build_agent_message(message: str, session_id: str) -> tuple[str, str]:
    current_company = _detect_company(message)
    previous_company = session_context.get(session_id, {}).get("company", "")

    if _is_ambiguous_all_request(message):
        if not current_company and not previous_company:
            return message, ""

        preserved_company = current_company or previous_company
        return (
            f"{message}\n\n"
            f"이 후속 질문은 이전 제조사 조건을 유지한다. 제조사 조건: {preserved_company}. "
            "가격, 연식, 차종 등 추가 조건은 제한하지 말고 해당 제조사 전체 차량을 search_cars로 검색한다.",
            preserved_company,
        )

    if current_company:
        return (
            f"{message}\n\n"
            f"사용자가 명시한 제조사 조건: {current_company}. "
            "제조사 조건만 있어도 먼저 search_cars로 해당 제조사 전체 차량을 검색한다.",
            current_company,
        )

    return message, ""


def _normalize_car_for_response(car: dict) -> dict | None:
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
        "imageUrl": image_url,
    }


def _format_car_value(value, suffix: str = "", comma: bool = True) -> str:
    if value is None or value == "":
        return "미정"

    if isinstance(value, int):
        return f"{value:,}{suffix}" if comma else f"{value}{suffix}"

    return f"{value}{suffix}"


def _format_recommendation_answer(cars: list[dict], company: str) -> str:
    if not cars:
        return "검색 결과가 없습니다.\n예산, 연식, 주행거리, 차종, 지역 조건을 완화해보세요."

    blocks = []

    for index, car in enumerate(cars[:3], start=1):
        blocks.append(
            "\n".join([
                f"{index}순위. {car.get('name') or '이름 없는 차량'}",
                "",
                f"연식: {_format_car_value(car.get('year'), '년', comma=False)}",
                f"가격: {_format_car_value(car.get('price'), '만원')}",
                f"주행거리: {_format_car_value(car.get('mileage'), 'km')}",
                f"연료: {car.get('fuel') or '미정'}",
                f"변속기: {car.get('transmission') or '미정'}",
                f"지역: {car.get('location') or '미정'}",
                "",
                "추천 이유:",
                "검색 조건에 맞는 등록 차량입니다.",
                "",
                "확인할 점:",
                "사고 이력, 정비 이력, 추가 비용을 확인해보세요.",
            ])
        )

    blocks.append("")
    blocks.append("예산, 차종, 용도를 알려주시면 조건을 더 좁혀드릴게요.")
    return "\n\n".join(blocks)


def _get_last_recommended_cars(session_id: str) -> list[dict]:
    state = _get_session_state(session_id)
    cars = state.get("last_recommended_cars")

    if not isinstance(cars, list):
        return []

    return [
        car
        for car in cars
        if isinstance(car, dict) and str(car.get("id") or "").strip()
    ]


def _detect_requested_indexes(message: str) -> list[int]:
    normalized_message = _normalize_text(message)
    indexes = []
    patterns = (
        (0, ("첫번째", "첫번", "첫차", "첫차량", "1번째", "1번")),
        (1, ("두번째", "두번", "둘째", "2번째", "2번")),
        (2, ("세번째", "세번", "셋째", "3번째", "3번")),
    )

    for index, candidates in patterns:
        if any(_normalize_text(candidate) in normalized_message for candidate in candidates):
            indexes.append(index)

    seen = set()
    return [index for index in indexes if not (index in seen or seen.add(index))]


def _detect_referenced_action(message: str) -> str:
    normalized_message = _normalize_text(message)

    if any(token in normalized_message for token in ("비교", "차이")):
        return "compare"

    if any(token in normalized_message for token in ("딜러", "문의", "메시지", "문자")):
        return "dealer_message"

    if any(token in normalized_message for token in ("상세", "자세", "정보", "알려")):
        return "detail"

    return ""


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


def _to_int(value) -> int | None:
    if value is None or value == "":
        return None

    try:
        return int(str(value).replace(",", "").replace("만원", "").strip())
    except (TypeError, ValueError):
        return None


def _format_detail_answer(car: dict) -> str:
    return "\n".join([
        str(car.get("name") or "차량명 미정"),
        "",
        f"연식: {_format_car_value(car.get('year'), '년', comma=False)}",
        f"가격: {_format_car_value(car.get('price'), '만원')}",
        f"주행거리: {_format_car_value(car.get('mileage'), 'km')}",
        f"차종: {car.get('type') or '미정'}",
        f"연료: {car.get('fuel') or '미정'}",
        f"변속기: {car.get('transmission') or '미정'}",
        f"지역: {car.get('location') or '미정'}",
        f"색상: {car.get('color') or '미정'}",
        "",
        "확인할 점:",
        "사고 이력, 정비 이력, 추가 비용은 딜러에게 확인해보세요.",
    ])


def _format_compare_answer(first: dict, second: dict) -> str:
    first_price = _to_int(first.get("price"))
    second_price = _to_int(second.get("price"))
    first_year = _to_int(first.get("year"))
    second_year = _to_int(second.get("year"))
    first_mileage = _to_int(first.get("mileage"))
    second_mileage = _to_int(second.get("mileage"))
    summary = []

    if first_price is not None and second_price is not None:
        diff = abs(first_price - second_price)
        cheaper = first.get("name") if first_price <= second_price else second.get("name")
        summary.append(f"가격은 {cheaper} 차량이 {diff:,}만원 더 낮습니다.")

    if first_year is not None and second_year is not None:
        if first_year == second_year:
            summary.append("연식은 두 차량이 같습니다.")
        else:
            newer = first.get("name") if first_year > second_year else second.get("name")
            summary.append(f"연식은 {newer} 차량이 더 최신입니다.")

    if first_mileage is not None and second_mileage is not None:
        if first_mileage == second_mileage:
            summary.append("주행거리는 두 차량이 같습니다.")
        else:
            lower_mileage = first.get("name") if first_mileage < second_mileage else second.get("name")
            summary.append(f"주행거리는 {lower_mileage} 차량이 더 짧습니다.")

    if not summary:
        summary.append("조회된 실제 차량 정보를 기준으로 비교했습니다.")

    return "\n\n".join([
        "\n".join([
            f"1번 차량. {first.get('name') or '차량명 미정'}",
            f"가격: {_format_car_value(first.get('price'), '만원')}",
            f"연식: {_format_car_value(first.get('year'), '년', comma=False)}",
            f"주행거리: {_format_car_value(first.get('mileage'), 'km')}",
            f"차종: {first.get('type') or '미정'}",
            f"연료: {first.get('fuel') or '미정'}",
            f"변속기: {first.get('transmission') or '미정'}",
            f"지역: {first.get('location') or '미정'}",
        ]),
        "\n".join([
            f"2번 차량. {second.get('name') or '차량명 미정'}",
            f"가격: {_format_car_value(second.get('price'), '만원')}",
            f"연식: {_format_car_value(second.get('year'), '년', comma=False)}",
            f"주행거리: {_format_car_value(second.get('mileage'), 'km')}",
            f"차종: {second.get('type') or '미정'}",
            f"연료: {second.get('fuel') or '미정'}",
            f"변속기: {second.get('transmission') or '미정'}",
            f"지역: {second.get('location') or '미정'}",
        ]),
        "비교:\n" + "\n".join(summary),
        "정리:\n가격, 연식, 주행거리 중 어떤 기준을 우선할지 정하면 선택이 더 쉬워집니다.",
    ])


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


def _run_referenced_car_action(message: str, session_id: str) -> dict | None:
    action = _detect_referenced_action(message)
    indexes = _detect_requested_indexes(message)

    if not action or not indexes:
        return None

    last_cars = _get_last_recommended_cars(session_id)

    if _is_development():
        print(f"detected action: {action}")
        print(f"requested indexes: {','.join(str(index + 1) for index in indexes)}")
        print(f"last recommended car ids: {','.join(str(car.get('id')) for car in last_cars)}")

    if not last_cars:
        return _missing_recommendation_result(action)

    if any(index < 0 or index >= len(last_cars) for index in indexes):
        return _invalid_recommendation_index_result(indexes, len(last_cars))

    if action == "compare":
        compare_indexes = indexes[:2]
        if len(compare_indexes) < 2:
            compare_indexes = [0, 1]

        if any(index >= len(last_cars) for index in compare_indexes):
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

        cars = _normalize_many([payload.get("first"), payload.get("second")], limit=2)
        selected_ids = [car["id"] for car in cars]
        return {
            "answer": _format_compare_answer(cars[0], cars[1]) if len(cars) == 2 else "비교할 차량 정보가 부족합니다.",
            "selected_car_ids": selected_ids,
            "cars": cars,
        }

    selected_ref = last_cars[indexes[0]]

    if action == "dealer_message":
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

    payload = _invoke_json_tool(get_car_detail_tool, {"car_id": selected_ref["id"]})

    if payload.get("success") is not True or not isinstance(payload.get("data"), dict):
        return {
            "answer": "차량 상세 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해주세요.",
            "selected_car_ids": [],
            "cars": [],
        }

    cars = _normalize_many([payload.get("data")], limit=1)
    selected_ids = [car["id"] for car in cars]
    return {
        "answer": _format_detail_answer(cars[0]) if cars else "차량 상세 정보가 없습니다.",
        "selected_car_ids": selected_ids,
        "cars": cars,
    }


def _price_bucket(car: dict) -> str:
    price = _to_int(car.get("price"))

    if price is None:
        return "unknown"
    if price < 2000:
        return "low"
    if price < 5000:
        return "mid"

    return "high"


def _model_key(car: dict) -> str:
    name = str(car.get("name") or "").strip()
    tokens = [token for token in re.split(r"\s+", name) if token]

    if len(tokens) >= 3:
        return " ".join(tokens[:3])
    if len(tokens) >= 2:
        return " ".join(tokens[:2])

    return name or str(car.get("id") or "")


def _stable_shuffle(candidates: list[dict], session_id: str, query_signature: str, cycle: int) -> list[dict]:
    return sorted(
        candidates,
        key=lambda car: hashlib.sha256(
            f"{session_id}|{query_signature}|{cycle}|{car.get('id') or ''}".encode("utf-8")
        ).hexdigest(),
    )


def _diversity_enabled(filters: dict, request_type: str) -> bool:
    if request_type == "follow_up" or _has_explicit_sort(filters):
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


def _pick_diverse_from_ordered(candidates: list[dict], limit: int = 3, avoid_ids: set[str] | None = None) -> list[dict]:
    avoid_ids = avoid_ids or set()
    selected = []
    selected_ids = set()
    used_models = set()
    used_types = set()
    used_fuels = set()
    used_price_buckets = set()

    def add_car(car: dict, allow_avoided: bool = False) -> bool:
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


def _select_diverse_cars(
    candidates: list[dict],
    session_id: str,
    query_signature: str,
    state: dict,
    limit: int = 3,
) -> tuple[list[dict], list[dict]]:
    cycle = int(state.get("recommendation_cycle") or 0)
    shuffled = _stable_shuffle(candidates, session_id, query_signature, cycle)
    shown_ids = set(_shown_ids(state))
    unshown = [car for car in shuffled if car.get("id") not in shown_ids]

    if not unshown and candidates:
        cycle += 1
        state["recommendation_cycle"] = cycle
        state["shown_car_ids"] = []
        state["recommendation_offset"] = 0
        shown_ids = set()
        shuffled = _stable_shuffle(candidates, session_id, query_signature, cycle)
        unshown = shuffled

    last_ids = {
        str(car.get("id") or "")
        for car in state.get("last_recommended_cars", [])
        if isinstance(car, dict)
    }
    selected = _pick_diverse_from_ordered(unshown, limit=limit, avoid_ids=last_ids)
    return selected, shuffled


def _prepare_search_filters(filters: dict, session_id: str, request_type: str) -> tuple[dict, str, str, int]:
    state = _get_session_state(session_id)
    prepared_filters = {**filters}
    query_signature = _query_signature(prepared_filters)
    explicit_sort = _has_explicit_sort(prepared_filters)
    previous_signature = str(state.get("last_query_signature") or "")
    shown_before = _shown_ids(state)

    if request_type == "follow_up":
        prepared_filters["exclude_ids"] = ",".join(shown_before)
        prepared_filters["limit"] = 50
        return prepared_filters, query_signature, "follow-up", len(shown_before)

    diversity_enabled = _diversity_enabled(prepared_filters, request_type)

    if query_signature != previous_signature or explicit_sort or state.get("recommendation_exhausted"):
        _reset_recommendation_state(state)
        return prepared_filters, query_signature, "new search", 0

    if shown_before and diversity_enabled:
        prepared_filters["limit"] = 50
        return prepared_filters, query_signature, "repeated recommendation", len(shown_before)

    return prepared_filters, query_signature, "new search", len(shown_before)


def _run_direct_search(filters: dict, session_id: str, request_type: str = "new_search") -> dict:
    state = _get_session_state(session_id)
    prepared_filters, query_signature, resolved_request_type, shown_before_count = _prepare_search_filters(
        filters,
        session_id,
        request_type,
    )
    tool_args = {
        key: value
        for key, value in prepared_filters.items()
        if not key.startswith("_") and value is not None and str(value).strip() != ""
    }
    tool_result = search_cars_tool.invoke(tool_args)

    try:
        payload = json.loads(tool_result)
    except (TypeError, json.JSONDecodeError):
        payload = {}

    raw_cars = payload.get("data") if isinstance(payload, dict) else []
    normalized_cars = _normalize_many(raw_cars if isinstance(raw_cars, list) else [], limit=20)
    exact_type = str(prepared_filters.get("_exact_type") or "")
    broad_types = prepared_filters.get("_broad_types") if isinstance(prepared_filters.get("_broad_types"), list) else []
    sort_by = str(prepared_filters.get("_sort_by") or "")
    sort_order = str(prepared_filters.get("_sort_order") or "")
    candidates = [
        car
        for car in normalized_cars
        if _matches_type_constraint(car, exact_type, broad_types)
    ]
    diversity_enabled = _diversity_enabled(prepared_filters, request_type)
    shuffled_candidates = candidates
    if diversity_enabled:
        cars, shuffled_candidates = _select_diverse_cars(
            candidates,
            session_id,
            query_signature,
            state,
            limit=3,
        )
    else:
        cars = candidates[:3]
    selected_car_ids = [car["id"] for car in cars]

    company = str(prepared_filters.get("company") or "")
    if company:
        _get_session_state(session_id)["company"] = company

    if cars:
        _remember_recommendation(session_id, prepared_filters, cars)
    elif request_type == "follow_up" or resolved_request_type == "repeated recommendation":
        state["recommendation_exhausted"] = True

    if _is_development():
        print(f"diversity enabled: {str(diversity_enabled).lower()}")
        print(f"request type: {resolved_request_type}")
        print(f"query signature: {query_signature}")
        print(f"candidate ids: {','.join(str(car.get('id') or '') for car in candidates)}")
        print(f"shuffled ids: {','.join(str(car.get('id') or '') for car in shuffled_candidates)}")
        print(f"shown_car_ids before: {shown_before_count}")
        print(f"shown_car_ids after: {len(_shown_ids(state))}")
        print(f"recommendation offset: {state.get('recommendation_offset', 0)}")
        print(f"cycle: {state.get('recommendation_cycle', 0)}")
        print(f"candidate count: {len(candidates)}")
        print("current turn tool names: search_cars")
        print("search_cars call count: 1")
        print(f"excluded car ids count: {len(str(prepared_filters.get('exclude_ids') or '').split(',')) if prepared_filters.get('exclude_ids') else 0}")
        print(f"detected exact type: {exact_type}")
        print(f"detected broad types: {','.join(broad_types)}")
        print(f"detected sort_by: {sort_by}")
        print(f"detected sort_order: {sort_order}")
        print(f"selected car ids: {','.join(selected_car_ids)}")
        print(f"returned car ids: {','.join(selected_car_ids)}")
        print(f"response cars count: {len(cars)}")

    return {
        "answer": _format_recommendation_answer(cars, company),
        "selected_car_ids": selected_car_ids,
        "cars": cars,
    }


def _build_direct_filter(message: str, preserved_company: str) -> dict:
    exact_type, broad_types = _detect_type_constraints(message)
    type_query = exact_type or ",".join(broad_types)
    sort_by, sort_order = _detect_sort(message)

    return {
        "company": preserved_company,
        "type": type_query,
        "fuel": _detect_fuel(message),
        "max_price": _detect_max_price(message),
        "min_year": _detect_min_year(message),
        "sort_by": sort_by,
        "sort_order": sort_order,
        "limit": 50 if sort_by else None,
        "_exact_type": exact_type,
        "_broad_types": broad_types,
        "_sort_by": sort_by,
        "_sort_order": sort_order,
    }


def _run_followup_search(message: str, session_id: str) -> dict:
    state = _get_session_state(session_id)
    last_filters = state.get("last_filters")

    if not isinstance(last_filters, dict) or not last_filters:
        return {
            "answer": "어떤 제조사나 차종의 다른 차량을 찾으시는지 알려주세요.",
            "selected_car_ids": [],
            "cars": [],
        }

    shown_car_ids = [
        str(car_id)
        for car_id in state.get("shown_car_ids", [])
        if str(car_id).strip()
    ]
    filters = {
        **last_filters,
        "exclude_ids": ",".join(shown_car_ids),
        "limit": 50,
    }

    if _is_development():
        print("detected follow-up recommendation: true")
        print(f"reused filters: {json.dumps(last_filters, ensure_ascii=False)}")
        print(f"excluded car ids count: {len(shown_car_ids)}")

    result = _run_direct_search(filters, session_id, request_type="follow_up")

    if not result["cars"]:
        result["answer"] = "현재 조건에서 추가로 추천할 등록 차량이 없습니다.\n예산, 차종, 연식 조건을 바꾸면 다시 찾아드릴게요."

    return result


def _run_direct_company_search(company: str, session_id: str) -> dict:
    return _run_direct_search({"company": company}, session_id)


def _normalize_many(candidates: list | tuple, limit: int = 8) -> list[dict]:
    cars = []
    seen_ids = set()

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue

        car = _normalize_car_for_response(candidate)

        if not car or car["id"] in seen_ids:
            continue

        seen_ids.add(car["id"])
        cars.append(car)

        if len(cars) >= limit:
            break

    return cars


def _parse_tool_payload(message, tool_call_names: dict[str, str]) -> tuple[str, dict | None]:
    tool_call_id = getattr(message, "tool_call_id", "") or ""
    tool_name = getattr(message, "name", "") or tool_call_names.get(tool_call_id, "")

    try:
        payload = json.loads(message.content)
    except (TypeError, json.JSONDecodeError):
        return tool_name, None

    if not isinstance(payload, dict) or payload.get("success") is not True:
        return tool_name, None

    return tool_name, payload


def _remember_tool_calls(message, tool_call_names: dict[str, str]) -> None:
    for tool_call in getattr(message, "tool_calls", None) or []:
        tool_call_id = tool_call.get("id")
        tool_name = tool_call.get("name")

        if tool_call_id and tool_name:
            tool_call_names[tool_call_id] = tool_name


def _infer_tool_name(tool_name: str, payload: dict) -> str:
    if tool_name:
        return tool_name

    if isinstance(payload.get("data"), list):
        return "search_cars"

    if isinstance(payload.get("data"), dict):
        return "get_car_detail"

    if isinstance(payload.get("first"), dict) or isinstance(payload.get("second"), dict):
        return "compare_cars"

    return ""


def _current_turn_tool_data(messages: list) -> tuple[list[str], list[dict], list[dict], list[dict]]:
    tool_names = []
    latest_search_cars = []
    latest_detail_car = []
    latest_compare_cars = []
    last_human_index = -1
    tool_call_names = {}

    for index, message in enumerate(messages):
        if message.__class__.__name__ == "HumanMessage":
            last_human_index = index

    for message in messages[last_human_index + 1:]:
        _remember_tool_calls(message, tool_call_names)

        if message.__class__.__name__ != "ToolMessage":
            continue

        tool_name, payload = _parse_tool_payload(message, tool_call_names)

        if not payload:
            continue

        tool_name = _infer_tool_name(tool_name, payload)
        if tool_name:
            tool_names.append(tool_name)

        if tool_name == "search_cars":
            data = payload.get("data")
            if isinstance(data, list):
                latest_search_cars = _normalize_many(data, limit=8)
            continue

        if tool_name == "get_car_detail":
            data = payload.get("data")
            if isinstance(data, dict):
                latest_detail_car = _normalize_many([data], limit=1)
            continue

        if tool_name == "compare_cars":
            compare_candidates = [payload.get("first"), payload.get("second")]
            latest_compare_cars = _normalize_many(compare_candidates, limit=2)

    return tool_names, latest_search_cars, latest_detail_car, latest_compare_cars


def _answer_position(answer: str, car: dict) -> int:
    name = str(car.get("name") or "")

    if not name:
        return -1

    index = answer.find(name)
    if index >= 0:
        return index

    compact_answer = _normalize_text(answer)
    compact_name = _normalize_text(name)
    if compact_name and compact_name in compact_answer:
        return compact_answer.find(compact_name)

    name_tokens = [token for token in re.split(r"\s+", name) if token]
    if len(name_tokens) >= 2:
        short_name = _normalize_text(" ".join(name_tokens[:2]))
        if short_name and short_name in compact_answer:
            return compact_answer.find(short_name)

    return -1


def _select_answer_cars(answer: str, candidates: list[dict], limit: int = 3) -> list[dict]:
    matched = []

    for car in candidates:
        position = _answer_position(answer, car)
        if position >= 0:
            matched.append((position, car))

    matched.sort(key=lambda item: item[0])
    return [car for _, car in matched[:limit]]


def _extract_cars_and_ids(answer: str, messages: list) -> tuple[list[dict], list[str]]:
    tool_names, search_cars, detail_cars, compare_cars = _current_turn_tool_data(messages)

    if _is_development():
        print(f"current turn tool names: {','.join(tool_names)}")

    if compare_cars:
        selected = _select_answer_cars(answer, compare_cars, limit=2)
    elif detail_cars:
        selected = _select_answer_cars(answer, detail_cars, limit=1)
    elif search_cars:
        selected = search_cars[:3]
    else:
        selected = []

    selected_ids = [car["id"] for car in selected]
    return selected, selected_ids


def _strip_markdown_markers(answer: str) -> str:
    return (
        answer.replace("**", "")
        .replace("###", "")
        .replace("##", "")
        .replace("#", "")
        .strip()
    )


def _finish_agent_result(result: dict, started_at: float) -> dict:
    if _is_development():
        print(f"total agent duration: {time.perf_counter() - started_at:.3f}s")

    return result


def ask_agent(message: str, session_id: str) -> dict:
    started_at = time.perf_counter()
    agent_message, preserved_company = _build_agent_message(message, session_id)
    referenced_action_result = _run_referenced_car_action(message, session_id)

    if referenced_action_result is not None:
        if _is_development():
            print(f"selected ids: {','.join(referenced_action_result.get('selected_car_ids', []))}")
            print("Tool call count: 0 or bounded direct tool call")
        return _finish_agent_result(referenced_action_result, started_at)

    if _is_followup_recommendation(message):
        return _finish_agent_result(_run_followup_search(message, session_id), started_at)

    if _is_ambiguous_all_request(message) and not preserved_company:
        return _finish_agent_result({
            "answer": "전체 제조사의 차량을 찾으시는 건가요, 아니면 이전에 말씀하신 제조사 전체 차량을 찾으시는 건가요?",
            "selected_car_ids": [],
            "cars": [],
        }, started_at)

    if _is_ambiguous_all_request(message) and preserved_company:
        return _finish_agent_result(_run_direct_company_search(preserved_company, session_id), started_at)

    direct_filter = _build_direct_filter(message, preserved_company)
    has_direct_constraints = any(
        direct_filter.get(key)
        for key in ("type", "fuel", "max_price", "min_year", "sort_by")
    )
    if has_direct_constraints and _is_search_or_recommendation(message):
        return _finish_agent_result(_run_direct_search(direct_filter, session_id), started_at)

    if _is_simple_company_recommendation(message, preserved_company):
        return _finish_agent_result(_run_direct_company_search(preserved_company, session_id), started_at)

    result = graph.invoke(
        {"messages": [HumanMessage(content=agent_message)]},
        config={"configurable": {"thread_id": session_id}},
    )
    last_message = result["messages"][-1]
    content = getattr(last_message, "content", "")

    if isinstance(content, list):
        answer = "\n".join(str(item) for item in content)
    else:
        answer = str(content)

    answer = _strip_markdown_markers(answer)
    cars, selected_car_ids = _extract_cars_and_ids(answer, result["messages"])

    if preserved_company:
        session_context.setdefault(session_id, {})["company"] = preserved_company

    if _is_development():
        print(f"selected car ids: {','.join(selected_car_ids)}")
        print(f"response cars count: {len(cars)}")

    return _finish_agent_result({
        "answer": answer,
        "selected_car_ids": selected_car_ids,
        "cars": cars,
    }, started_at)
