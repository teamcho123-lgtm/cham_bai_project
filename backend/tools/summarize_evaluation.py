import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Tổng hợp kết quả review OMR thành Markdown và JSON."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=BACKEND_DIR / "evaluation" / "reviewed_manifest.csv",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=BACKEND_DIR / "evaluation",
    )
    return parser.parse_args()


def parse_number(value):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_flag(value):
    value = (value or "").strip().casefold()
    if value in {"1", "true", "yes", "pass", "có", "co"}:
        return True
    if value in {"0", "false", "no", "fail", "không", "khong"}:
        return False
    return None


def exact_match(row, expected_field, predicted_field):
    expected = (row.get(expected_field) or "").strip()
    predicted = (row.get(predicted_field) or "").strip()
    if not expected or not predicted:
        return None
    return expected == predicted


def percentage(correct, total):
    if not total:
        return None
    return correct / total * 100


def format_percentage(value):
    return "Chưa có dữ liệu" if value is None else f"{value:.2f}%"


def percentile(values, ratio):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil(len(ordered) * ratio) - 1)
    return ordered[index]


def summarize(rows):
    reviewed = [row for row in rows if parse_flag(row.get("reviewed")) is True]

    counters = {
        "visual": [0, 0],
        "processing": [0, 0],
        "sbd": [0, 0],
        "exam_code": [0, 0],
        "mcq": [0, 0],
        "true_false": [0, 0],
        "short_answer": [0, 0],
        "full_sheet": [0, 0],
    }
    timings = []
    by_template = defaultdict(lambda: [0, 0])
    by_condition = defaultdict(lambda: [0, 0])

    for row in reviewed:
        for key, field in (
            ("visual", "visual_alignment"),
            ("processing", "processing_success"),
            ("full_sheet", "full_sheet_correct"),
        ):
            value = parse_flag(row.get(field))
            if value is not None:
                counters[key][0] += int(value)
                counters[key][1] += 1

        for key, expected, predicted in (
            ("sbd", "sbd_expected", "sbd_predicted"),
            ("exam_code", "exam_code_expected", "exam_code_predicted"),
        ):
            value = exact_match(row, expected, predicted)
            if value is not None:
                counters[key][0] += int(value)
                counters[key][1] += 1

        for key, correct_field, total_field in (
            ("mcq", "mcq_correct", "mcq_total"),
            ("true_false", "true_false_correct", "true_false_total"),
            ("short_answer", "short_answer_correct", "short_answer_total"),
        ):
            correct = parse_number(row.get(correct_field))
            total = parse_number(row.get(total_field))
            if correct is not None and total is not None and total >= 0:
                counters[key][0] += correct
                counters[key][1] += total

        timing = parse_number(row.get("processing_time_ms"))
        if timing is not None and timing >= 0:
            timings.append(timing)

        full_sheet = parse_flag(row.get("full_sheet_correct"))
        if full_sheet is not None:
            template = (row.get("template_hint") or "unknown").strip() or "unknown"
            condition = (row.get("condition") or "unknown").strip() or "unknown"
            by_template[template][0] += int(full_sheet)
            by_template[template][1] += 1
            by_condition[condition][0] += int(full_sheet)
            by_condition[condition][1] += 1

    metrics = {
        key: {
            "correct": value[0],
            "total": value[1],
            "accuracy_percent": percentage(value[0], value[1]),
        }
        for key, value in counters.items()
    }

    return {
        "selected_samples": len(rows),
        "reviewed_samples": len(reviewed),
        "metrics": metrics,
        "timing_ms": {
            "count": len(timings),
            "mean": statistics.fmean(timings) if timings else None,
            "median": statistics.median(timings) if timings else None,
            "p95": percentile(timings, 0.95),
        },
        "full_sheet_by_template": {
            key: {
                "correct": value[0],
                "total": value[1],
                "accuracy_percent": percentage(value[0], value[1]),
            }
            for key, value in sorted(by_template.items())
        },
        "full_sheet_by_condition": {
            key: {
                "correct": value[0],
                "total": value[1],
                "accuracy_percent": percentage(value[0], value[1]),
            }
            for key, value in sorted(by_condition.items())
        },
    }


def markdown_table(title, data):
    lines = [f"## {title}", "", "| Nhóm | Đúng | Tổng | Chính xác |", "|---|---:|---:|---:|"]
    if not data:
        lines.append("| Chưa có dữ liệu | 0 | 0 | - |")
    else:
        for key, value in data.items():
            lines.append(
                f"| {key} | {value['correct']:g} | {value['total']:g} | "
                f"{format_percentage(value['accuracy_percent'])} |"
            )
    return lines


def build_markdown(summary):
    labels = {
        "processing": "Xử lý thành công",
        "visual": "Overlay bám đúng ô",
        "sbd": "SBD chính xác",
        "exam_code": "Mã đề chính xác",
        "mcq": "Trắc nghiệm chính xác",
        "true_false": "Đúng/sai chính xác",
        "short_answer": "Trả lời ngắn chính xác",
        "full_sheet": "Toàn phiếu chính xác",
    }

    lines = [
        "# Kết quả đánh giá OMR",
        "",
        f"- Số ảnh được chọn: {summary['selected_samples']}",
        f"- Số ảnh đã review: {summary['reviewed_samples']}",
        "",
        "## Chỉ số tổng hợp",
        "",
        "| Chỉ số | Đúng | Tổng | Chính xác |",
        "|---|---:|---:|---:|",
    ]

    for key, label in labels.items():
        metric = summary["metrics"][key]
        lines.append(
            f"| {label} | {metric['correct']:g} | {metric['total']:g} | "
            f"{format_percentage(metric['accuracy_percent'])} |"
        )

    timing = summary["timing_ms"]
    lines.extend(["", "## Hiệu năng", ""])
    if timing["count"]:
        lines.extend(
            [
                f"- Số lần đo: {timing['count']}",
                f"- Trung bình: {timing['mean']:.2f} ms",
                f"- Trung vị: {timing['median']:.2f} ms",
                f"- P95: {timing['p95']:.2f} ms",
            ]
        )
    else:
        lines.append("Chưa có dữ liệu thời gian xử lý.")

    lines.extend([""] + markdown_table("Độ chính xác toàn phiếu theo template", summary["full_sheet_by_template"]))
    lines.extend([""] + markdown_table("Độ chính xác toàn phiếu theo điều kiện ảnh", summary["full_sheet_by_condition"]))
    lines.extend(
        [
            "",
            "> Lưu ý: bộ ảnh này được tạo từ thư mục `results`, nên chỉ đại diện cho các lần đã sinh được ảnh kết quả. Không dùng nó để tuyên bố tỷ lệ thành công trên toàn bộ ảnh upload nếu chưa lưu cả các ca thất bại.",
            "",
        ]
    )
    return "\n".join(lines)


def main():
    args = parse_args()
    input_path = args.input.resolve()
    output_dir = args.output_dir.resolve()

    if not input_path.exists():
        raise SystemExit(
            f"Không tìm thấy file review: {input_path}\n"
            "Hãy mở review.html, review ảnh và xuất reviewed_manifest.csv trước."
        )

    with input_path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    output_dir.mkdir(parents=True, exist_ok=True)
    summary = summarize(rows)
    markdown_path = output_dir / "summary.md"
    json_path = output_dir / "summary.json"

    markdown_path.write_text(build_markdown(summary), encoding="utf-8")
    json_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Reviewed samples: {summary['reviewed_samples']}/{summary['selected_samples']}")
    print(f"Markdown report: {markdown_path}")
    print(f"JSON report: {json_path}")


if __name__ == "__main__":
    main()
