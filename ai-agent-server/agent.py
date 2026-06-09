import json
import os

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from tools import TOOLS

load_dotenv()

SYSTEM_PROMPT = """당신은 CarMarket의 한국어 AI 차량 상담사입니다.

핵심 규칙:
- 차량 정보, 가격, 재고, ID는 반드시 Tool 결과만 근거로 답변합니다.
- 검색 결과에 없는 차량, 가격, 연식, 주행거리, 옵션을 만들지 않습니다.
- 가격 단위는 만원입니다.
- 추천은 최대 3대까지만 제시합니다.
- 목록 API 데이터만으로 추천할 수 있으면 상세 API를 추가 호출하지 않습니다.
- 상세 조회는 사용자가 특정 차량의 상세 정보를 요청했을 때만 사용합니다.
- 검색 결과가 없으면 예산, 연식, 주행거리, 차종, 지역 조건 완화를 제안합니다.
- 차량 비교 요청은 가능하면 먼저 검색으로 실제 차량 ID를 확인한 뒤 compare_cars를 사용합니다.
- 사용자가 이름을 제공하지 않은 경우 딜러 메시지에 임의 이름을 만들지 않습니다.

추천 순서 규칙:
- 추천 답변은 search_cars Tool 결과 순서를 그대로 따릅니다.
- 1순위는 Tool 결과 첫 번째 차량입니다.
- 2순위는 Tool 결과 두 번째 차량입니다.
- 3순위는 Tool 결과 세 번째 차량입니다.
- 임의로 순서를 바꾸거나 Tool 결과에 없는 차량을 끼워 넣지 않습니다.

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

model = ChatOpenAI(model=MODEL_NAME, temperature=0).bind_tools(TOOLS)
tool_node = ToolNode(TOOLS)


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
        "fuel": car.get("fuel"),
        "imageUrl": image_url,
    }


def _normalize_many(candidates: list | tuple, limit: int = 3) -> list[dict]:
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


def _extract_cars(messages: list) -> list[dict]:
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

        if tool_name == "search_cars":
            data = payload.get("data")
            if isinstance(data, list):
                latest_search_cars = _normalize_many(data, limit=3)
            continue

        if tool_name == "get_car_detail":
            data = payload.get("data")
            if isinstance(data, dict):
                latest_detail_car = _normalize_many([data], limit=1)
            continue

        if tool_name == "compare_cars":
            compare_candidates = [payload.get("first"), payload.get("second")]
            latest_compare_cars = _normalize_many(compare_candidates, limit=2)

    if latest_compare_cars:
        return latest_compare_cars

    if latest_detail_car:
        return latest_detail_car

    if latest_search_cars:
        return latest_search_cars

    return []


def _strip_markdown_markers(answer: str) -> str:
    return (
        answer.replace("**", "")
        .replace("###", "")
        .replace("##", "")
        .replace("#", "")
        .strip()
    )


def ask_agent(message: str, session_id: str) -> dict:
    result = graph.invoke(
        {"messages": [HumanMessage(content=message)]},
        config={"configurable": {"thread_id": session_id}},
    )
    last_message = result["messages"][-1]
    content = getattr(last_message, "content", "")

    if isinstance(content, list):
        answer = "\n".join(str(item) for item in content)
    else:
        answer = str(content)

    cars = _extract_cars(result["messages"])

    if _is_development():
        print(f"agent cars count: {len(cars)}")

    return {
        "answer": _strip_markdown_markers(answer),
        "cars": cars,
    }
