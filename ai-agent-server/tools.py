import json
import os
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from langchain.tools import tool
from pydantic import BaseModel, Field

load_dotenv()

API_TIMEOUT_SECONDS = 8.0
CAR_FIELDS = [
    "id",
    "_id",
    "name",
    "company",
    "price",
    "year",
    "mileage",
    "type",
    "fuel",
    "location",
    "transmission",
    "color",
    "description",
    "imageUrl",
    "imageUrls",
]


def _is_development() -> bool:
    return os.getenv("ENV") == "development" or os.getenv("NODE_ENV") == "development"


def _api_base() -> str:
    return os.getenv("CARMARKET_API_BASE", "http://localhost:3000/api").rstrip("/")


def _json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)


def _compact_car(car: dict[str, Any]) -> dict[str, Any]:
    compact = {field: car.get(field) for field in CAR_FIELDS if field in car}
    car_id = car.get("id") or car.get("_id")

    if car_id is not None:
        compact["id"] = str(car_id)
        compact["_id"] = str(car_id)

    return compact


def _read_success_data(response: httpx.Response) -> Any:
    payload = response.json()

    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise ValueError("CarMarket API returned an unexpected response.")

    return payload.get("data")


def _get_car_detail(car_id: str) -> dict[str, Any]:
    if not car_id or not car_id.strip():
        return {
            "success": False,
            "errorType": "invalid_id",
            "message": "차량 ID가 비어 있습니다.",
        }

    try:
        response = httpx.get(f"{_api_base()}/cars/{car_id.strip()}", timeout=API_TIMEOUT_SECONDS)
    except httpx.RequestError:
        return {
            "success": False,
            "errorType": "network_error",
            "message": "차량 상세 API에 연결할 수 없습니다.",
        }

    if response.status_code == 400:
        return {
            "success": False,
            "errorType": "invalid_id",
            "message": "잘못된 차량 ID입니다.",
        }

    if response.status_code == 404:
        return {
            "success": False,
            "errorType": "not_found",
            "message": "차량을 찾을 수 없습니다.",
        }

    if response.is_error:
        return {
            "success": False,
            "errorType": "api_error",
            "message": "차량 상세 정보를 불러오지 못했습니다.",
        }

    try:
        data = _read_success_data(response)
    except (json.JSONDecodeError, ValueError):
        return {
            "success": False,
            "errorType": "invalid_response",
            "message": "차량 상세 API 응답 형식이 올바르지 않습니다.",
        }

    if not isinstance(data, dict):
        return {
            "success": False,
            "errorType": "invalid_response",
            "message": "차량 상세 데이터 형식이 올바르지 않습니다.",
        }

    return {
        "success": True,
        "data": _compact_car(data),
    }


class SearchCarsInput(BaseModel):
    company: Optional[str] = Field(default=None, description="제조사")
    keyword: Optional[str] = Field(default=None, description="차량명 키워드")
    type: Optional[str] = Field(default=None, description="차종")
    fuel: Optional[str] = Field(default=None, description="연료")
    location: Optional[str] = Field(default=None, description="지역")
    transmission: Optional[str] = Field(default=None, description="변속기")
    min_price: Optional[int] = Field(default=None, description="최소 가격, 단위는 만원")
    max_price: Optional[int] = Field(default=None, description="최대 가격, 단위는 만원")
    min_year: Optional[int] = Field(default=None, description="최소 연식")
    max_year: Optional[int] = Field(default=None, description="최대 연식")
    min_mileage: Optional[int] = Field(default=None, description="최소 주행거리 km")
    max_mileage: Optional[int] = Field(default=None, description="최대 주행거리 km")


class CarDetailInput(BaseModel):
    car_id: str = Field(description="차량 _id")


class CompareCarsInput(BaseModel):
    first_car_id: str = Field(description="첫 번째 차량 _id")
    second_car_id: str = Field(description="두 번째 차량 _id")


class DealerMessageInput(BaseModel):
    car_name: str = Field(description="문의할 차량명")
    user_name: Optional[str] = Field(default=None, description="사용자 이름. 없으면 비워 둠")
    question: str = Field(description="딜러에게 물어볼 내용")


@tool(args_schema=SearchCarsInput)
def search_cars(
    company: Optional[str] = None,
    keyword: Optional[str] = None,
    type: Optional[str] = None,
    fuel: Optional[str] = None,
    location: Optional[str] = None,
    transmission: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    min_mileage: Optional[int] = None,
    max_mileage: Optional[int] = None,
) -> str:
    """CarMarket 차량 검색 API에서 실제 등록 차량을 검색한다."""

    raw_params = {
        "company": company,
        "keyword": keyword,
        "type": type,
        "fuel": fuel,
        "location": location,
        "transmission": transmission,
        "minPrice": min_price,
        "maxPrice": max_price,
        "minYear": min_year,
        "maxYear": max_year,
        "minMileage": min_mileage,
        "maxMileage": max_mileage,
    }
    params = {
        key: value
        for key, value in raw_params.items()
        if value is not None and str(value).strip() != ""
    }

    try:
        response = httpx.get(f"{_api_base()}/cars/search", params=params, timeout=API_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = _read_success_data(response)
    except httpx.RequestError:
        return _json({
            "success": False,
            "errorType": "network_error",
            "message": "차량 검색 API에 연결할 수 없습니다.",
        })
    except httpx.HTTPStatusError:
        return _json({
            "success": False,
            "errorType": "api_error",
            "message": "차량 검색 요청이 실패했습니다.",
        })
    except (json.JSONDecodeError, ValueError):
        return _json({
            "success": False,
            "errorType": "invalid_response",
            "message": "차량 검색 API 응답 형식이 올바르지 않습니다.",
        })

    if not isinstance(data, list):
        return _json({
            "success": False,
            "errorType": "invalid_response",
            "message": "차량 검색 결과 형식이 올바르지 않습니다.",
        })

    if _is_development():
        print(f"search_cars result count: {len(data)}")

    return _json({
        "success": True,
        "count": len(data),
        "returnedCount": min(len(data), 5),
        "data": [_compact_car(car) for car in data[:5] if isinstance(car, dict)],
    })


@tool(args_schema=CarDetailInput)
def get_car_detail(car_id: str) -> str:
    """차량 ID로 CarMarket 차량 상세 정보를 조회한다."""

    return _json(_get_car_detail(car_id))


@tool(args_schema=CompareCarsInput)
def compare_cars(first_car_id: str, second_car_id: str) -> str:
    """두 차량 ID의 상세 정보를 조회해 실제 데이터만 구조화해서 비교한다."""

    first = _get_car_detail(first_car_id)
    second = _get_car_detail(second_car_id)

    if not first.get("success") or not second.get("success"):
        return _json({
            "success": False,
            "first": first,
            "second": second,
            "message": "비교할 차량 중 일부 상세 정보를 불러오지 못했습니다.",
        })

    fields = [
        "id",
        "_id",
        "name",
        "company",
        "price",
        "year",
        "mileage",
        "type",
        "fuel",
        "transmission",
        "location",
        "imageUrl",
        "imageUrls",
    ]

    def pick(car: dict[str, Any]) -> dict[str, Any]:
        data = car["data"]
        return {field: data.get(field) for field in fields if field in data}

    return _json({
        "success": True,
        "first": pick(first),
        "second": pick(second),
    })


@tool(args_schema=DealerMessageInput)
def make_dealer_message(car_name: str, question: str, user_name: Optional[str] = None) -> str:
    """딜러에게 보낼 정중한 한국어 문의 메시지 초안을 작성한다. 실제 전송은 하지 않는다."""

    name_line = f"안녕하세요, {user_name.strip()}입니다." if user_name and user_name.strip() else "안녕하세요."
    message = (
        f"{name_line}\n"
        f"{car_name.strip()} 차량에 관심이 있어 문의드립니다.\n"
        f"{question.strip()}\n"
        "확인 가능하실 때 답변 부탁드립니다. 감사합니다."
    )

    return _json({
        "success": True,
        "message": message,
        "sent": False,
    })


TOOLS = [search_cars, get_car_detail, compare_cars, make_dealer_message]
