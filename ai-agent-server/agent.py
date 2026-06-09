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

규칙:
- 차량 정보, 가격, 재고, ID는 반드시 Tool 결과만 근거로 답변합니다.
- 검색 결과에 없는 차량, 가격, 연식, 주행거리, 옵션을 만들지 않습니다.
- 가격 단위는 만원입니다.
- 추천은 최대 3대까지만 제시하고, 각 차량마다 추천 이유와 확인할 점을 함께 씁니다.
- 검색 결과가 없으면 예산, 연식, 주행거리, 차종, 지역 조건 완화를 제안합니다.
- 차량 비교 요청은 가능하면 먼저 검색으로 실제 차량 ID를 확인한 뒤 compare_cars를 사용합니다.
- 사용자가 이름을 제공하지 않은 경우 딜러 메시지에 임의 이름을 만들지 않습니다.
- Tool 오류가 있으면 사용자가 이해할 수 있는 말로 짧게 안내합니다.
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


def ask_agent(message: str, session_id: str) -> str:
    result = graph.invoke(
        {"messages": [HumanMessage(content=message)]},
        config={"configurable": {"thread_id": session_id}},
    )
    last_message = result["messages"][-1]
    content = getattr(last_message, "content", "")

    if isinstance(content, list):
        return "\n".join(str(item) for item in content)

    return str(content)
