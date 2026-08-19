import argparse
import csv
import json
import os
import random
import re
from collections import defaultdict
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
RESULT_NAME_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)-result$",
    re.IGNORECASE,
)
UUID_PREFIX_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$",
    re.IGNORECASE,
)

MANIFEST_FIELDS = [
    "sample_id",
    "source_name",
    "template_hint",
    "original_path",
    "result_path",
    "run_origin",
    "duplicate_run_count",
    "original_candidate_count",
    "result_generated",
    "reviewed",
    "condition",
    "processing_success",
    "visual_alignment",
    "sbd_expected",
    "sbd_predicted",
    "exam_code_expected",
    "exam_code_predicted",
    "mcq_correct",
    "mcq_total",
    "true_false_correct",
    "true_false_total",
    "short_answer_correct",
    "short_answer_total",
    "full_sheet_correct",
    "processing_time_ms",
    "reviewer_notes",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Tạo bộ ảnh đánh giá OMR không trùng và trang review dùng cho khóa luận."
        )
    )
    parser.add_argument("--sample-size", type=int, default=100)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=BACKEND_DIR / "results",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=BACKEND_DIR / "evaluation",
    )
    return parser.parse_args()


def source_name_from_result(path):
    match = RESULT_NAME_PATTERN.match(path.stem)
    if match:
        return match.group(1), "api"
    if path.stem.endswith("-result"):
        return path.stem[: -len("-result")], "direct"
    return None, None


def source_name_from_original(path):
    match = UUID_PREFIX_PATTERN.match(path.stem)
    return match.group(1) if match else path.stem


def project_relative(path):
    try:
        return path.resolve().relative_to(PROJECT_DIR).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def infer_template(path):
    if path is None:
        return "unknown"

    for part in path.parts:
        match = re.match(r"^data([1-4])(?:$|[ _-])", part, re.IGNORECASE)
        if match:
            return f"template-00{match.group(1)}"

    try:
        relative_path = path.resolve().relative_to((BACKEND_DIR / "data").resolve())
        if len(relative_path.parts) == 1:
            return "template-000"
        return "unknown"
    except ValueError:
        return "unknown"


def collect_results(results_dir):
    grouped = defaultdict(list)

    for path in results_dir.iterdir():
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            source_name, run_origin = source_name_from_result(path)
            if source_name is None:
                continue
            grouped[source_name.casefold()].append((source_name, path, run_origin))

    records = []
    for items in grouped.values():
        items.sort(key=lambda item: (item[2] == "api", item[1].stat().st_mtime))
        source_name, latest_path, run_origin = items[-1]
        records.append(
            {
                "source_name": source_name,
                "result_path": latest_path,
                "run_origin": run_origin,
                "duplicate_run_count": len(items),
            }
        )

    return records


def collect_originals():
    grouped = defaultdict(list)

    for root in (BACKEND_DIR / "data", BACKEND_DIR / "uploads"):
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                grouped[source_name_from_original(path).casefold()].append(path)

    return grouped


def choose_original(candidates):
    if not candidates:
        return None

    def priority(path):
        in_data = 0 if (BACKEND_DIR / "data") in path.parents else 1
        return in_data, len(path.parts), project_relative(path).casefold()

    return sorted(candidates, key=priority)[0]


def balanced_sample(records, sample_size, seed):
    groups = defaultdict(list)
    for record in records:
        groups[record["template_hint"]].append(record)

    randomizer = random.Random(seed)
    for values in groups.values():
        randomizer.shuffle(values)

    selected = []
    group_names = sorted(groups)
    while len(selected) < min(sample_size, len(records)):
        added = False
        for group_name in group_names:
            if groups[group_name] and len(selected) < sample_size:
                selected.append(groups[group_name].pop())
                added = True
        if not added:
            break

    return selected


def build_rows(results_dir, sample_size, seed):
    result_records = collect_results(results_dir)
    original_map = collect_originals()

    for record in result_records:
        candidates = original_map.get(record["source_name"].casefold(), [])
        original = choose_original(candidates)
        record["original_path"] = original
        record["original_candidate_count"] = len(candidates)
        record["template_hint"] = infer_template(original)

    eligible_records = [
        record for record in result_records if record["template_hint"] != "unknown"
    ]
    selected = balanced_sample(eligible_records, sample_size, seed)
    rows = []

    for index, record in enumerate(selected, start=1):
        row = {field: "" for field in MANIFEST_FIELDS}
        row.update(
            {
                "sample_id": f"OMR-{index:03d}",
                "source_name": record["source_name"],
                "template_hint": record["template_hint"],
                "original_path": (
                    project_relative(record["original_path"])
                    if record["original_path"]
                    else ""
                ),
                "result_path": project_relative(record["result_path"]),
                "run_origin": record["run_origin"],
                "duplicate_run_count": record["duplicate_run_count"],
                "original_candidate_count": record["original_candidate_count"],
                "result_generated": "1",
                "reviewed": "0",
            }
        )
        rows.append(row)

    return rows, len(result_records), len(eligible_records)


def write_manifest(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def browser_path(project_path, output_dir):
    if not project_path:
        return ""
    absolute_path = PROJECT_DIR / project_path
    return Path(os.path.relpath(absolute_path, output_dir)).as_posix()


def write_review_page(path, rows, output_dir):
    browser_rows = []
    for row in rows:
        browser_row = dict(row)
        browser_row["original_url"] = browser_path(row["original_path"], output_dir)
        browser_row["result_url"] = browser_path(row["result_path"], output_dir)
        browser_rows.append(browser_row)

    data_json = json.dumps(browser_rows, ensure_ascii=False).replace("</", "<\\/")
    fields_json = json.dumps(MANIFEST_FIELDS, ensure_ascii=False)

    html = f"""<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OMR Evaluation Review</title>
  <style>
    :root {{ font-family: Arial, sans-serif; color: #202124; background: #f5f6f8; }}
    body {{ margin: 0; }}
    header {{ position: sticky; top: 0; z-index: 2; padding: 12px 20px; background: #fff; border-bottom: 1px solid #ddd; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }}
    button {{ border: 0; border-radius: 6px; padding: 9px 14px; cursor: pointer; background: #2563eb; color: white; }}
    button.secondary {{ background: #64748b; }}
    main {{ padding: 16px; max-width: 1500px; margin: auto; }}
    .meta {{ margin-bottom: 12px; font-weight: 600; }}
    .images {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }}
    figure {{ margin: 0; background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }}
    figcaption {{ padding: 8px 10px; border-bottom: 1px solid #eee; }}
    img {{ width: 100%; max-height: 68vh; object-fit: contain; background: #222; display: block; }}
    .form {{ margin-top: 14px; display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 10px; padding: 14px; background: white; border: 1px solid #ddd; border-radius: 8px; }}
    label {{ display: flex; flex-direction: column; gap: 5px; font-size: 13px; }}
    input, select, textarea {{ border: 1px solid #bbb; border-radius: 5px; padding: 8px; font: inherit; }}
    textarea {{ min-height: 70px; }}
    .wide {{ grid-column: 1 / -1; }}
    .hint {{ color: #64748b; font-size: 13px; }}
    @media (max-width: 900px) {{ .images {{ grid-template-columns: 1fr; }} .form {{ grid-template-columns: repeat(2, 1fr); }} }}
  </style>
</head>
<body>
  <header>
    <button class="secondary" id="previous">Ảnh trước</button>
    <button class="secondary" id="next">Ảnh sau</button>
    <button id="markReviewed">Lưu và đánh dấu đã review</button>
    <button id="export">Xuất reviewed_manifest.csv</button>
    <strong id="progress"></strong>
  </header>
  <main>
    <div class="meta" id="meta"></div>
    <div class="images">
      <figure><figcaption>Ảnh gốc</figcaption><img id="originalImage" alt="Không tìm thấy ảnh gốc"></figure>
      <figure><figcaption>Ảnh kết quả</figcaption><img id="resultImage" alt="Ảnh kết quả"></figure>
    </div>
    <p class="hint">Nhập giá trị đọc thủ công vào cột expected và giá trị hệ thống nhận diện vào predicted. Không suy luận expected từ màu xanh/đỏ của hệ thống.</p>
    <section class="form">
      <label>Điều kiện ảnh
        <select data-field="condition"><option value=""></option><option>normal</option><option>tilted</option><option>dark</option><option>blurred</option><option>wrinkled</option><option>cropped</option><option>other</option></select>
      </label>
      <label>Xử lý thành công
        <select data-field="processing_success"><option value=""></option><option value="1">Có</option><option value="0">Không</option></select>
      </label>
      <label>Overlay bám đúng ô
        <select data-field="visual_alignment"><option value=""></option><option value="pass">Pass</option><option value="fail">Fail</option></select>
      </label>
      <label>Toàn phiếu chính xác
        <select data-field="full_sheet_correct"><option value=""></option><option value="1">Đúng</option><option value="0">Sai</option></select>
      </label>
      <label>SBD thực tế<input data-field="sbd_expected"></label>
      <label>SBD hệ thống<input data-field="sbd_predicted"></label>
      <label>Mã đề thực tế<input data-field="exam_code_expected"></label>
      <label>Mã đề hệ thống<input data-field="exam_code_predicted"></label>
      <label>MCQ đúng<input type="number" min="0" data-field="mcq_correct"></label>
      <label>Tổng MCQ<input type="number" min="0" data-field="mcq_total"></label>
      <label>Đúng/sai đúng<input type="number" min="0" data-field="true_false_correct"></label>
      <label>Tổng ý đúng/sai<input type="number" min="0" data-field="true_false_total"></label>
      <label>Trả lời ngắn đúng<input type="number" min="0" data-field="short_answer_correct"></label>
      <label>Tổng trả lời ngắn<input type="number" min="0" data-field="short_answer_total"></label>
      <label>Thời gian xử lý (ms)<input type="number" min="0" data-field="processing_time_ms"></label>
      <label class="wide">Ghi chú<textarea data-field="reviewer_notes"></textarea></label>
    </section>
  </main>
  <script>
    const rows = {data_json};
    const manifestFields = {fields_json};
    const storageKey = "omr-evaluation-review-v1";
    const storedRows = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(storedRows) && storedRows.length === rows.length) {{
      storedRows.forEach((stored, index) => Object.assign(rows[index], stored));
    }}

    let currentIndex = 0;
    const controls = [...document.querySelectorAll("[data-field]")];

    function persist() {{
      localStorage.setItem(storageKey, JSON.stringify(rows));
    }}

    function saveCurrent() {{
      const row = rows[currentIndex];
      controls.forEach(control => row[control.dataset.field] = control.value);
      persist();
    }}

    function render() {{
      const row = rows[currentIndex];
      document.getElementById("progress").textContent = `${{currentIndex + 1}}/${{rows.length}}`;
      document.getElementById("meta").textContent = `${{row.sample_id}} · ${{row.source_name}} · ${{row.template_hint}} · ${{row.run_origin}} · số lần chạy: ${{row.duplicate_run_count}}`;
      const originalImage = document.getElementById("originalImage");
      originalImage.src = row.original_url || "";
      originalImage.style.display = row.original_url ? "block" : "none";
      document.getElementById("resultImage").src = row.result_url;
      controls.forEach(control => control.value = row[control.dataset.field] || "");
    }}

    function move(offset) {{
      saveCurrent();
      currentIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + offset));
      render();
    }}

    function csvCell(value) {{
      const text = String(value ?? "");
      return `"${{text.replaceAll('"', '""')}}"`;
    }}

    function exportCsv() {{
      saveCurrent();
      const lines = [manifestFields.map(csvCell).join(",")];
      rows.forEach(row => lines.push(manifestFields.map(field => csvCell(row[field])).join(",")));
      const blob = new Blob(["\\ufeff" + lines.join("\\r\\n")], {{ type: "text/csv;charset=utf-8" }});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "reviewed_manifest.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    }}

    document.getElementById("previous").onclick = () => move(-1);
    document.getElementById("next").onclick = () => move(1);
    document.getElementById("markReviewed").onclick = () => {{
      rows[currentIndex].reviewed = "1";
      saveCurrent();
      if (currentIndex < rows.length - 1) currentIndex += 1;
      render();
    }};
    document.getElementById("export").onclick = exportCsv;
    render();
  </script>
</body>
</html>
"""

    path.write_text(html, encoding="utf-8")


def main():
    args = parse_args()
    results_dir = args.results_dir.resolve()
    output_dir = args.output_dir.resolve()

    if args.sample_size <= 0:
        raise SystemExit("--sample-size phải lớn hơn 0")
    if not results_dir.exists():
        raise SystemExit(f"Không tìm thấy thư mục kết quả: {results_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)
    rows, unique_result_count, eligible_result_count = build_rows(
        results_dir=results_dir,
        sample_size=args.sample_size,
        seed=args.seed,
    )

    manifest_path = output_dir / "manifest.csv"
    review_path = output_dir / "review.html"
    write_manifest(manifest_path, rows)
    write_review_page(review_path, rows, output_dir)

    template_counts = defaultdict(int)
    matched_originals = 0
    for row in rows:
        template_counts[row["template_hint"]] += 1
        matched_originals += bool(row["original_path"])

    print(f"Unique result images: {unique_result_count}")
    print(f"Eligible mapped images: {eligible_result_count}")
    print(f"Selected samples: {len(rows)}")
    print(f"Matched originals: {matched_originals}/{len(rows)}")
    for template_name in sorted(template_counts):
        print(f"  {template_name}: {template_counts[template_name]}")
    print(f"Manifest: {manifest_path}")
    print(f"Review page: {review_path}")


if __name__ == "__main__":
    main()
