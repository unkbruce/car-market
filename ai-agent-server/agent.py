import json
import os
import re
import time

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from followup_actions import handle_followup_recommendation, handle_referenced_action
from normalizers import companies_for_origin, matches_origin_constraint, matches_type_constraint, normalize_many, normalize_text
from query_parser import (
    build_agent_message,
    build_query_signature,
    detect_followup_recommendation,
    has_explicit_sort,
    is_ambiguous_all_request,
    is_search_or_recommendation,
    is_simple_company_recommendation,
    parse_search_filters,
)
from recommendation import select_diverse_cars, select_sorted_cars, should_apply_diversity
from response_formatter import format_recommendation_response, strip_markdown_markers
from session_store import (
    get_session,
    get_shown_car_ids,
    remember_recommendation,
    reset_recommendation_state,
)
from tools import TOOLS

load_dotenv()

SYSTEM_PROMPT = """당신은 CarMarket의 한국어 AI 차량 상담사입니다.

핵심 규칙:
- 차량 정보, 가격, 연식, 주행거리, ID는 반드시 Tool 결과만 근거로 답합니다.
- 검색 결과에 없는 차량이나 가격을 만들지 않습니다.
- 가격 단위는 만원입니다.
- 추천은 최대 3대까지만 제시합니다.
- 추천 순서는 search_cars Tool 결과 순서를 따릅니다.
- 마크다운 문법을 쓰지 않고 일반 텍스트와 줄바꿈만 사용합니다.
- 사용자가 이름을 제공하지 않으면 딜러 메시지에 임의 이름을 만들지 않습니다.
"""

MODEL_NAME = os.getenv("OPENAI_MODEL") or "gpt-4o-mini"

model = ChatOpenAI(model=MODEL_NAME, temperature=0).bind_tools(TOOLS)
tool_node = ToolNode(TOOLS)
search_cars_tool = next(tool for tool in TOOLS if tool.name == "search_cars")
get_car_detail_tool = next(tool for tool in TOOLS if tool.name == "get_car_detail")
compare_cars_tool = next(tool for tool in TOOLS if tool.name == "compare_cars")
make_dealer_message_tool = next(tool for tool in TOOLS if tool.name == "make_dealer_message")


def _is_development() -> bool:
    return os.getenv("ENV") == "development" or os.getenv("NODE_ENV") == "development"


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


def _prepare_search_filters(filters: dict, session_id: str, request_type: str) -> tuple[dict, str, str, int]:
    state = get_session(session_id)
    prepared_filters = {**filters}
    query_signature = build_query_signature(prepared_filters)
    explicit_sort = has_explicit_sort(prepared_filters)
    previous_signature = str(state.get("last_query_signature") or "")
    shown_before = get_shown_car_ids(session_id)

    if request_type == "follow_up":
        prepared_filters["exclude_ids"] = ",".join(shown_before)
        prepared_filters["limit"] = 50
        return prepared_filters, query_signature, "follow-up", len(shown_before)

    diversity_enabled = should_apply_diversity(prepared_filters, request_type)

    if query_signature != previous_signature or explicit_sort or state.get("recommendation_exhausted"):
        reset_recommendation_state(session_id)
        return prepared_filters, query_signature, "new search", 0

    if shown_before and diversity_enabled:
        prepared_filters["limit"] = 50
        return prepared_filters, query_signature, "repeated recommendation", len(shown_before)

    return prepared_filters, query_signature, "new search", len(shown_before)


def _run_direct_search(filters: dict, session_id: str, request_type: str = "new_search") -> dict:
    state = get_session(session_id)
    prepared_filters, query_signature, resolved_request_type, shown_before_count = _prepare_search_filters(
        filters,
        session_id,
        request_type,
    )
    origin = str(prepared_filters.get("origin") or "")
    if origin and not prepared_filters.get("company"):
        prepared_filters["companies"] = ",".join(companies_for_origin(origin))

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
    normalized_cars = normalize_many(raw_cars if isinstance(raw_cars, list) else [], limit=20)
    exact_type = str(prepared_filters.get("_exact_type") or "")
    broad_types = prepared_filters.get("_broad_types") if isinstance(prepared_filters.get("_broad_types"), list) else []
    sort_by = str(prepared_filters.get("_sort_by") or "")
    sort_order = str(prepared_filters.get("_sort_order") or "")
    candidates = [
        car
        for car in normalized_cars
        if matches_type_constraint(car, exact_type, broad_types)
        and matches_origin_constraint(car, origin)
    ]
    diversity_enabled = should_apply_diversity(prepared_filters, request_type)
    shuffled_candidates = candidates

    if diversity_enabled:
        selected, shuffled_candidates, cycle, reset_shown = select_diverse_cars(
            candidates,
            session_id,
            query_signature,
            get_shown_car_ids(session_id),
            limit=3,
            cycle=int(state.get("recommendation_cycle") or 0),
            last_recommended_cars=state.get("last_recommended_cars", []),
        )
        state["recommendation_cycle"] = cycle
        if reset_shown:
            state["shown_car_ids"] = []
            state["recommendation_offset"] = 0
        cars = selected
    else:
        cars = select_sorted_cars(candidates, sort_by, sort_order, limit=3)

    selected_car_ids = [car["id"] for car in cars]
    company = str(prepared_filters.get("company") or "")

    if company:
        get_session(session_id)["company"] = company

    if cars:
        remember_recommendation(session_id, prepared_filters, cars)
    elif request_type == "follow_up" or resolved_request_type == "repeated recommendation":
        state["recommendation_exhausted"] = True

    if _is_development():
        print(f"diversity enabled: {str(diversity_enabled).lower()}")
        print(f"request type: {resolved_request_type}")
        print(f"query signature: {query_signature}")
        print(f"candidate ids: {','.join(str(car.get('id') or '') for car in candidates)}")
        print(f"shuffled ids: {','.join(str(car.get('id') or '') for car in shuffled_candidates)}")
        print(f"shown_car_ids before: {shown_before_count}")
        print(f"shown_car_ids after: {len(get_shown_car_ids(session_id))}")
        print(f"recommendation offset: {state.get('recommendation_offset', 0)}")
        print(f"cycle: {state.get('recommendation_cycle', 0)}")
        print(f"candidate count: {len(candidates)}")
        print("current turn tool names: search_cars")
        print("search_cars call count: 1")
        print(f"excluded car ids count: {len(str(prepared_filters.get('exclude_ids') or '').split(',')) if prepared_filters.get('exclude_ids') else 0}")
        print(f"detected exact type: {exact_type}")
        print(f"detected broad types: {','.join(broad_types)}")
        print(f"detected origin: {origin}")
        print(f"normalized companies: {prepared_filters.get('companies', '')}")
        print(f"detected sort_by: {sort_by}")
        print(f"detected sort_order: {sort_order}")
        print(f"selected company values: {','.join(str(car.get('company') or '') for car in cars)}")
        print(f"selected car ids: {','.join(selected_car_ids)}")
        print(f"returned car ids: {','.join(selected_car_ids)}")
        print(f"response cars count: {len(cars)}")

    return {
        "answer": format_recommendation_response(cars, company),
        "selected_car_ids": selected_car_ids,
        "cars": cars,
    }


def _run_direct_company_search(company: str, session_id: str) -> dict:
    return _run_direct_search({"company": company}, session_id)


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
                latest_search_cars = normalize_many(data, limit=8)
            continue

        if tool_name == "get_car_detail":
            data = payload.get("data")
            if isinstance(data, dict):
                latest_detail_car = normalize_many([data], limit=1)
            continue

        if tool_name == "compare_cars":
            compare_candidates = [payload.get("first"), payload.get("second")]
            latest_compare_cars = normalize_many(compare_candidates, limit=2)

    return tool_names, latest_search_cars, latest_detail_car, latest_compare_cars


def _answer_position(answer: str, car: dict) -> int:
    name = str(car.get("name") or "")

    if not name:
        return -1

    index = answer.find(name)
    if index >= 0:
        return index

    compact_answer = normalize_text(answer)
    compact_name = normalize_text(name)
    if compact_name and compact_name in compact_answer:
        return compact_answer.find(compact_name)

    name_tokens = [token for token in re.split(r"\s+", name) if token]
    if len(name_tokens) >= 2:
        short_name = normalize_text(" ".join(name_tokens[:2]))
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


def _finish_agent_result(result: dict, started_at: float) -> dict:
    if _is_development():
        print(f"total agent duration: {time.perf_counter() - started_at:.3f}s")

    return result


def ask_agent(message: str, session_id: str) -> dict:
    started_at = time.perf_counter()
    previous_company = get_session(session_id).get("company", "")
    agent_message, preserved_company = build_agent_message(message, previous_company)
    referenced_action_result = handle_referenced_action(
        message,
        session_id,
        get_car_detail_tool,
        compare_cars_tool,
        make_dealer_message_tool,
        _is_development,
    )

    if referenced_action_result is not None:
        if _is_development():
            print(f"selected ids: {','.join(referenced_action_result.get('selected_car_ids', []))}")
            print("Tool call count: 0 or bounded direct tool call")
        return _finish_agent_result(referenced_action_result, started_at)

    if detect_followup_recommendation(message):
        return _finish_agent_result(
            handle_followup_recommendation(session_id, _run_direct_search),
            started_at,
        )

    if is_ambiguous_all_request(message) and not preserved_company:
        return _finish_agent_result({
            "answer": "전체 제조사의 차량을 찾으시는 건가요, 아니면 이전에 말씀하신 제조사 전체 차량을 찾으시는 건가요?",
            "selected_car_ids": [],
            "cars": [],
        }, started_at)

    if is_ambiguous_all_request(message) and preserved_company:
        return _finish_agent_result(_run_direct_company_search(preserved_company, session_id), started_at)

    direct_filter = parse_search_filters(message, preserved_company)
    has_direct_constraints = any(
        direct_filter.get(key)
        for key in ("type", "fuel", "origin", "max_price", "min_year", "sort_by")
    )
    if has_direct_constraints and is_search_or_recommendation(message):
        return _finish_agent_result(_run_direct_search(direct_filter, session_id), started_at)

    if is_simple_company_recommendation(message, preserved_company):
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

    answer = strip_markdown_markers(answer)
    cars, selected_car_ids = _extract_cars_and_ids(answer, result["messages"])

    if preserved_company:
        get_session(session_id)["company"] = preserved_company

    if _is_development():
        print(f"selected car ids: {','.join(selected_car_ids)}")
        print(f"response cars count: {len(cars)}")

    return _finish_agent_result({
        "answer": answer,
        "selected_car_ids": selected_car_ids,
        "cars": cars,
    }, started_at)
