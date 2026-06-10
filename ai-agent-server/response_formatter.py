from typing import Any

from normalizers import parse_numeric_value

Car = dict[str, Any]


def format_car_value(value, suffix: str = "", comma: bool = True) -> str:
    if value is None or value == "":
        return "미정"

    if isinstance(value, int):
        return f"{value:,}{suffix}" if comma else f"{value}{suffix}"

    return f"{value}{suffix}"


def format_recommendation_response(cars: list[Car], company: str = "") -> str:
    if not cars:
        return "검색 결과가 없습니다.\n예산, 연식, 주행거리, 차종, 지역 조건을 완화해보세요."

    blocks = []

    for index, car in enumerate(cars[:3], start=1):
        blocks.append(
            "\n".join([
                f"{index}순위. {car.get('name') or '이름 없는 차량'}",
                "",
                f"연식: {format_car_value(car.get('year'), '년', comma=False)}",
                f"가격: {format_car_value(car.get('price'), '만원')}",
                f"주행거리: {format_car_value(car.get('mileage'), 'km')}",
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


def format_detail_response(car: Car) -> str:
    return "\n".join([
        str(car.get("name") or "차량명 미정"),
        "",
        f"연식: {format_car_value(car.get('year'), '년', comma=False)}",
        f"가격: {format_car_value(car.get('price'), '만원')}",
        f"주행거리: {format_car_value(car.get('mileage'), 'km')}",
        f"차종: {car.get('type') or '미정'}",
        f"연료: {car.get('fuel') or '미정'}",
        f"변속기: {car.get('transmission') or '미정'}",
        f"지역: {car.get('location') or '미정'}",
        f"색상: {car.get('color') or '미정'}",
        "",
        "확인할 점:",
        "사고 이력, 정비 이력, 추가 비용은 딜러에게 확인해보세요.",
    ])


def format_compare_response(first: Car, second: Car) -> str:
    first_price = parse_numeric_value(first.get("price"))
    second_price = parse_numeric_value(second.get("price"))
    first_year = parse_numeric_value(first.get("year"))
    second_year = parse_numeric_value(second.get("year"))
    first_mileage = parse_numeric_value(first.get("mileage"))
    second_mileage = parse_numeric_value(second.get("mileage"))
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
            f"가격: {format_car_value(first.get('price'), '만원')}",
            f"연식: {format_car_value(first.get('year'), '년', comma=False)}",
            f"주행거리: {format_car_value(first.get('mileage'), 'km')}",
            f"차종: {first.get('type') or '미정'}",
            f"연료: {first.get('fuel') or '미정'}",
            f"변속기: {first.get('transmission') or '미정'}",
            f"지역: {first.get('location') or '미정'}",
        ]),
        "\n".join([
            f"2번 차량. {second.get('name') or '차량명 미정'}",
            f"가격: {format_car_value(second.get('price'), '만원')}",
            f"연식: {format_car_value(second.get('year'), '년', comma=False)}",
            f"주행거리: {format_car_value(second.get('mileage'), 'km')}",
            f"차종: {second.get('type') or '미정'}",
            f"연료: {second.get('fuel') or '미정'}",
            f"변속기: {second.get('transmission') or '미정'}",
            f"지역: {second.get('location') or '미정'}",
        ]),
        "비교:\n" + "\n".join(summary),
        "정리:\n가격, 연식, 주행거리 중 어떤 기준을 우선할지 정하면 선택이 더 쉬워집니다.",
    ])


def format_no_results_response() -> str:
    return "검색 결과가 없습니다.\n예산, 연식, 주행거리, 차종, 지역 조건을 완화해보세요."


def strip_markdown_markers(answer: str) -> str:
    return (
        answer.replace("**", "")
        .replace("###", "")
        .replace("##", "")
        .replace("#", "")
        .strip()
    )
