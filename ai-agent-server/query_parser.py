import re
from typing import Any

from normalizers import contains_any, normalize_text
from tools import COMPANY_ALIASES, normalize_company_query, normalize_fuel_query, normalize_type_query

Filters = dict[str, Any]

AMBIGUOUS_ALL_PATTERNS = ("전체 다", "다 보여줘", "조건 없이", "아무거나", "전부", "전체 차량")
DETAIL_HINTS = ("상세", "비교", "문의", "메시지")
CONSTRAINT_HINTS = (
    "suv",
    "SUV",
    "만원",
    "이하",
    "이상",
    "년식",
    "이후",
    "이전",
    "경차",
    "세단",
    "디젤",
    "가솔린",
    "전기",
    "하이브리드",
)


def detect_company(message: str) -> str:
    normalized_message = normalize_text(message)

    for canonical, aliases in COMPANY_ALIASES.items():
        for candidate in [canonical, *aliases]:
            if normalize_text(candidate) and normalize_text(candidate) in normalized_message:
                return normalize_company_query(canonical) or canonical

    return ""


def detect_type_constraints(message: str) -> tuple[str, list[str]]:
    normalized_message = normalize_text(message)

    if "suv" in normalized_message:
        return "SUV", []

    exact_patterns = (
        ("준중형차", ("준중형차", "준중형세단", "준중형")),
        ("준대형차", ("준대형차", "준대형세단", "준대형")),
        ("대형차", ("대형차", "대형세단", "대형")),
        ("중형차", ("중형차", "중형세단", "중형")),
        ("소형차", ("소형차", "소형세단", "소형")),
        ("경차", ("경차",)),
        ("미니밴", ("미니밴", "minivan", "van")),
        ("화물차", ("화물차", "truck")),
    )

    for exact_type, patterns in exact_patterns:
        if any(normalize_text(pattern) in normalized_message for pattern in patterns):
            return exact_type, []

    if any(normalize_text(pattern) in normalized_message for pattern in ("세단", "승용세단", "sedan")):
        return "", ["준중형차", "중형차", "준대형차", "대형차"]

    return "", []


def detect_fuel(message: str) -> str:
    fuel_patterns = (
        ("electric", ("전기", "전기차", "electric", "ev")),
        ("hybrid", ("하이브리드", "hybrid")),
        ("gasoline", ("가솔린", "휘발유", "gasoline", "petrol")),
        ("diesel", ("디젤", "diesel")),
        ("LPG", ("lpg", "엘피지")),
    )

    for normalized_fuel, patterns in fuel_patterns:
        if contains_any(message, patterns):
            return normalize_fuel_query(normalized_fuel) or normalized_fuel

    return ""


def detect_max_price(message: str) -> int | None:
    patterns = (
        r"(\d{2,6})\s*만원\s*(?:이하|까지|미만|아래)",
        r"(\d{2,6})\s*만\s*원?\s*(?:이하|까지|미만|아래)",
    )

    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            return int(match.group(1))

    return None


def detect_min_year(message: str) -> int | None:
    patterns = (
        r"(\d{4})\s*년\s*(?:이후|부터|이상)",
        r"(\d{4})\s*(?:년식)?\s*(?:이후|부터|이상)",
    )

    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            return int(match.group(1))

    return None


def detect_sort(message: str) -> tuple[str, str]:
    sort_patterns = (
        ("price", "desc", ("비싼가격순", "비싼순", "가격높은순", "고가순", "가장비싼", "최고가")),
        ("price", "asc", ("저렴한순", "싼순", "가격낮은순", "최저가")),
        ("year", "desc", ("최신연식순", "최신연식", "신형순", "연식높은순", "연식높은", "최신년식")),
        ("year", "asc", ("오래된연식", "연식낮은순", "연식오름차순", "오래된")),
        ("mileage", "asc", ("주행거리짧은순", "적게탄순")),
        ("mileage", "desc", ("주행거리많은순", "많이탄순")),
    )

    normalized_message = normalize_text(message)

    for sort_by, sort_order, patterns in sort_patterns:
        if any(normalize_text(pattern) in normalized_message for pattern in patterns):
            return sort_by, sort_order

    if "최신순" in normalized_message:
        return "year", "desc"

    return "", ""


def detect_followup_recommendation(message: str) -> bool:
    compact_message = "".join(str(message).lower().split())
    patterns = (
        "다른차도알려줘",
        "다른차도알려주세요",
        "다른차량추천해줘",
        "다른차량추천해주세요",
        "다른기아차도알려줘",
        "다른기아차도알려주세요",
        "다음차량보여줘",
        "다음차량보여주세요",
        "더보여줘",
        "더보여주세요",
        "다른것도",
        "또추천해줘",
        "또추천해주세요",
        "또다른차",
    )
    if any(pattern in compact_message for pattern in patterns):
        return True

    return (
        "다른" in compact_message
        and any(token in compact_message for token in ("보여", "알려", "추천"))
    )


def detect_ordinal_indexes(message: str) -> list[int]:
    normalized_message = normalize_text(message)
    indexes = []
    patterns = (
        (0, ("첫번째", "첫번", "첫차", "첫차량", "1번째", "1번")),
        (1, ("두번째", "두번", "둘째", "2번째", "2번")),
        (2, ("세번째", "세번", "셋째", "3번째", "3번")),
    )

    for index, candidates in patterns:
        if any(normalize_text(candidate) in normalized_message for candidate in candidates):
            indexes.append(index)

    seen = set()
    return [index for index in indexes if not (index in seen or seen.add(index))]


def detect_action(message: str) -> str | None:
    normalized_message = normalize_text(message)

    if any(token in normalized_message for token in ("비교", "차이")):
        return "compare"

    if any(token in normalized_message for token in ("딜러", "문의", "메시지", "문자")):
        return "dealer_message"

    if any(token in normalized_message for token in ("상세", "자세", "정보", "알려")):
        return "detail"

    return None


def is_search_or_recommendation(message: str) -> bool:
    if contains_any(message, DETAIL_HINTS):
        return False

    return contains_any(message, ("추천", "검색", "찾아", "찾아줘", "보여", "보여줘", "있어", "알려줘"))


def is_ambiguous_all_request(message: str) -> bool:
    normalized_message = normalize_text(message)
    return any(normalize_text(pattern) in normalized_message for pattern in AMBIGUOUS_ALL_PATTERNS)


def is_simple_company_recommendation(message: str, company: str) -> bool:
    if not company:
        return False

    normalized_message = normalize_text(message)

    if any(normalize_text(hint) in normalized_message for hint in DETAIL_HINTS):
        return False

    if any(normalize_text(hint) in normalized_message for hint in CONSTRAINT_HINTS):
        return False

    return "추천" in message or "차" in message or "보여" in message


def parse_search_filters(message: str, preserved_company: str) -> Filters:
    exact_type, broad_types = detect_type_constraints(message)
    type_query = exact_type or ",".join(broad_types)
    sort_by, sort_order = detect_sort(message)

    return {
        "company": preserved_company,
        "type": type_query,
        "fuel": detect_fuel(message),
        "max_price": detect_max_price(message),
        "min_year": detect_min_year(message),
        "sort_by": sort_by,
        "sort_order": sort_order,
        "limit": 50 if sort_by else None,
        "_exact_type": exact_type,
        "_broad_types": broad_types,
        "_sort_by": sort_by,
        "_sort_order": sort_order,
    }


def public_filter_args(filters: Filters) -> Filters:
    return {
        key: value
        for key, value in filters.items()
        if not key.startswith("_") and key not in {"exclude_ids", "limit"} and value is not None and str(value).strip() != ""
    }


def build_query_signature(filters: Filters) -> str:
    public_filters = public_filter_args(filters)
    parts = [
        f"{key}={public_filters[key]}"
        for key in sorted(public_filters)
    ]
    return "&".join(parts)


def has_explicit_sort(filters: Filters) -> bool:
    return bool(filters.get("sort_by") or filters.get("_sort_by"))


def build_agent_message(message: str, previous_company: str = "") -> tuple[str, str]:
    current_company = detect_company(message)

    if is_ambiguous_all_request(message):
        if not current_company and not previous_company:
            return message, ""

        preserved_company = current_company or previous_company
        return (
            f"{message}\n\n"
            f"이 후속 질문은 이전 대화의 제조사 조건을 유지한다. 제조사 조건: {preserved_company}. "
            "가격, 연식, 차종 등 추가 조건은 제한하지 말고 해당 제조사의 전체 차량을 search_cars로 검색한다.",
            preserved_company,
        )

    if current_company:
        return (
            f"{message}\n\n"
            f"사용자가 명시한 제조사 조건: {current_company}. "
            "제조사 조건만 있어도 먼저 search_cars로 해당 제조사의 전체 차량을 검색한다.",
            current_company,
        )

    return message, ""
