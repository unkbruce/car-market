import json
import os
import re

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from tools import COMPANY_ALIASES, TOOLS, normalize_company_query

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
session_context: dict[str, dict[str, str]] = {}
search_cars_tool = next(tool for tool in TOOLS if tool.name == "search_cars")


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


def _run_direct_company_search(company: str, session_id: str) -> dict:
    tool_result = search_cars_tool.invoke({"company": company})

    try:
        payload = json.loads(tool_result)
    except (TypeError, json.JSONDecodeError):
        payload = {}

    raw_cars = payload.get("data") if isinstance(payload, dict) else []
    cars = _normalize_many(raw_cars if isinstance(raw_cars, list) else [], limit=3)
    selected_car_ids = [car["id"] for car in cars]

    session_context.setdefault(session_id, {})["company"] = company

    if _is_development():
        print("current turn tool names: search_cars")
        print(f"selected car ids: {','.join(selected_car_ids)}")
        print(f"response cars count: {len(cars)}")

    return {
        "answer": _format_recommendation_answer(cars, company),
        "selected_car_ids": selected_car_ids,
        "cars": cars,
    }


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
        selected = _select_answer_cars(answer, search_cars, limit=3)
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


def ask_agent(message: str, session_id: str) -> dict:
    agent_message, preserved_company = _build_agent_message(message, session_id)

    if _is_ambiguous_all_request(message) and not preserved_company:
        return {
            "answer": "전체 제조사의 차량을 찾으시는 건가요, 아니면 이전에 말씀하신 제조사 전체 차량을 찾으시는 건가요?",
            "selected_car_ids": [],
            "cars": [],
        }

    if _is_ambiguous_all_request(message) and preserved_company:
        return _run_direct_company_search(preserved_company, session_id)

    if _is_simple_company_recommendation(message, preserved_company):
        return _run_direct_company_search(preserved_company, session_id)

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

    return {
        "answer": answer,
        "selected_car_ids": selected_car_ids,
        "cars": cars,
    }
