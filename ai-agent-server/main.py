import logging
import os
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agent import ask_agent

load_dotenv()

logger = logging.getLogger("carmarket-agent")


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


def is_development() -> bool:
    return os.getenv("ENV") == "development" or os.getenv("NODE_ENV") == "development"


app = FastAPI(title="CarMarket AI Agent Server")

client_url = os.getenv("CLIENT_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[client_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "요청을 처리할 수 없습니다."
    return JSONResponse(status_code=exc.status_code, content={"success": False, "message": message})


@app.exception_handler(Exception)
async def unexpected_exception_handler(_request, exc: Exception):
    logger.exception("Unexpected agent server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "AI 상담 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."},
    )


@app.get("/")
async def root():
    return {"success": True, "message": "CarMarket AI Agent Server is running"}


@app.get("/health")
async def health():
    return {"success": True, "status": "ok"}


@app.post("/agent/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()

    if not message:
        raise HTTPException(status_code=400, detail="질문 내용을 확인해주세요.")

    session_id = request.session_id.strip() if request.session_id else str(uuid4())

    if not session_id:
        session_id = str(uuid4())

    result = ask_agent(message, session_id)
    cars = result.get("cars", [])

    if is_development():
        print(f"FastAPI response cars count: {len(cars)}")

    return {
        "success": True,
        "answer": result["answer"],
        "sessionId": session_id,
        "selected_car_ids": result.get("selected_car_ids", []),
        "cars": cars,
    }
