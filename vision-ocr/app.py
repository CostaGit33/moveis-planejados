from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image, ImageOps
import cv2
import numpy as np
import pytesseract
import io
import re
import os
import math
from typing import Any

APP_VERSION = "3.0.0"
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_MB", "20")) * 1024 * 1024
MAX_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "12000"))
MIN_DIMENSION = 10
MAX_MEASUREMENT_MM = 10000

app = FastAPI(
    title="Moveis Planejados Vision OCR",
    version=APP_VERSION,
    description=(
        "Pipeline de visão computacional para desenhos e rascunhos de móveis planejados. "
        "Combina pré-processamento, OCR, detecção geométrica e pontuação de evidências."
    ),
)

NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9])([0-9]{1,5}(?:[.,][0-9]{1,3})?)(?:\s*(mm|cm|m))?(?![A-Za-z0-9])",
    re.I,
)


def normalize_number(raw: str) -> float | None:
    value = re.sub(r"[^0-9,.]", "", str(raw))
    if not value:
        return None
    if "," in value and "." in value:
        if value.rfind(",") > value.rfind("."):
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
    elif re.fullmatch(r"\d{1,2}[.,]\d{3}", value):
        value = value.replace(".", "").replace(",", "")
    else:
        value = value.replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def convert_to_mm(value: float, unit: str | None) -> float:
    if not unit:
        return value
    unit = unit.lower()
    if unit == "m":
        return value * 1000
    if unit == "cm":
        return value * 10
    return value


def resize_for_ocr(gray: np.ndarray) -> tuple[np.ndarray, float]:
    h, w = gray.shape[:2]
    longest = max(h, w)
    if longest > 5000:
        scale = 1.25
    elif longest > 3000:
        scale = 1.5
    elif longest < 900:
        scale = 3.0
    else:
        scale = 2.0
    resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return resized, scale


def preprocess_variants(image: Image.Image) -> tuple[list[tuple[str, np.ndarray]], float, np.ndarray]:
    rgb = np.array(ImageOps.exif_transpose(image).convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray_original = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray, scale = resize_for_ocr(gray_original)

    denoised = cv2.fastNlMeansDenoising(gray, None, 7, 7, 21)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(denoised)
    otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    adaptive = cv2.adaptiveThreshold(
        clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 11
    )
    # A morphology variant helps recover thin dimension text and broken strokes.
    kernel = np.ones((2, 2), np.uint8)
    morph = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel, iterations=1)

    return [
        ("gray", clahe),
        ("otsu", otsu),
        ("adaptive", adaptive),
        ("morph", morph),
    ], scale, gray_original


def clean_ocr_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def _safe_int(values: list[Any], index: int, default: int = 0) -> int:
    try:
        return int(float(values[index]))
    except (IndexError, TypeError, ValueError):
        return default


def extract_number_candidates(
    data: dict[str, list[Any]],
    original_width: int,
    original_height: int,
    scale: float,
    method: str,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    total = len(data.get("text", []))

    for i in range(total):
        raw = str(data["text"][i] or "").strip()
        if not raw:
            continue
        try:
            confidence = float(data.get("conf", ["-1"] * total)[i])
        except (TypeError, ValueError, IndexError):
            confidence = -1
        if confidence < 15:
            continue

        match = NUMBER_RE.search(raw)
        if not match:
            # OCR frequently confuses letters adjacent to a measurement.
            loose = re.search(r"(?<!\d)(\d{2,5})(?!\d)", raw)
            if not loose:
                continue
            number = normalize_number(loose.group(1))
            unit = None
        else:
            number = normalize_number(match.group(1))
            unit = match.group(2).lower() if match.group(2) else None

        if number is None:
            continue
        mm = convert_to_mm(number, unit)
        if mm < MIN_DIMENSION or mm > MAX_MEASUREMENT_MM:
            continue

        px = _safe_int(data.get("left", []), i)
        py = _safe_int(data.get("top", []), i)
        pw = max(1, _safe_int(data.get("width", []), i, 1))
        ph = max(1, _safe_int(data.get("height", []), i, 1))

        x = max(0, round(px / scale))
        y = max(0, round(py / scale))
        w = max(1, round(pw / scale))
        h = max(1, round(ph / scale))
        x = min(x, max(0, original_width - 1))
        y = min(y, max(0, original_height - 1))
        w = min(w, max(1, original_width - x))
        h = min(h, max(1, original_height - y))

        candidates.append({
            "value": int(number) if number.is_integer() else number,
            "value_mm": int(mm) if float(mm).is_integer() else round(mm, 3),
            "raw": raw,
            "confidence": round(min(confidence / 100.0, 1.0), 3),
            "unit": unit,
            "bbox": {"x": x, "y": y, "width": w, "height": h},
            "normalized_position": {
                "x": round((x + w / 2) / max(original_width, 1), 4),
                "y": round((y + h / 2) / max(original_height, 1), 4),
            },
            "source_image": "original",
            "ocr_scale": scale,
            "ocr_method": method,
            "processed_bbox": {"x": px, "y": py, "width": pw, "height": ph},
        })
    return candidates


def bbox_distance(a: dict[str, Any], b: dict[str, Any]) -> float:
    ax = a["bbox"]["x"] + a["bbox"]["width"] / 2
    ay = a["bbox"]["y"] + a["bbox"]["height"] / 2
    bx = b["bbox"]["x"] + b["bbox"]["width"] / 2
    by = b["bbox"]["y"] + b["bbox"]["height"] / 2
    return math.hypot(ax - bx, ay - by)


def merge_candidates(candidate_sets: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for candidates in candidate_sets:
        for item in candidates:
            duplicate = None
            for existing in merged:
                if existing["value_mm"] != item["value_mm"]:
                    continue
                max_dim = max(
                    existing["bbox"]["width"], existing["bbox"]["height"],
                    item["bbox"]["width"], item["bbox"]["height"], 1
                )
                if bbox_distance(existing, item) <= max(14, max_dim * 1.8):
                    duplicate = existing
                    break
            if duplicate is None:
                merged.append(item)
            elif item["confidence"] > duplicate["confidence"]:
                duplicate.update(item)

    for item in merged:
        item["evidence_hits"] = sum(
            1 for candidates in candidate_sets
            if any(
                c["value_mm"] == item["value_mm"] and bbox_distance(c, item) <= 25
                for c in candidates
            )
        )
    return sorted(merged, key=lambda x: (-x["evidence_hits"], -x["confidence"], x["value_mm"]))[:100]


def detect_geometry(gray: np.ndarray) -> dict[str, Any]:
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=max(30, min(gray.shape) // 12),
        minLineLength=max(20, min(gray.shape) // 20), maxLineGap=12
    )
    horizontal = 0
    vertical = 0
    diagonal = 0
    line_samples = []
    if lines is not None:
        for line in lines[:500]:
            x1, y1, x2, y2 = [int(v) for v in line[0]]
            angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
            if angle < 10 or angle > 170:
                horizontal += 1
            elif 80 < angle < 100:
                vertical += 1
            else:
                diagonal += 1
            if len(line_samples) < 40:
                line_samples.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "angle": round(angle, 2)})

    return {
        "edge_pixels": int(np.count_nonzero(edges)),
        "line_count": int(0 if lines is None else len(lines)),
        "horizontal_lines": horizontal,
        "vertical_lines": vertical,
        "diagonal_lines": diagonal,
        "samples": line_samples,
    }


def classify_candidate(candidate: dict[str, Any], geometry: dict[str, Any]) -> tuple[str, float, list[str]]:
    value_mm = float(candidate["value_mm"])
    ocr = float(candidate["confidence"])
    hits = int(candidate.get("evidence_hits", 1))
    x = candidate["normalized_position"]["x"]
    y = candidate["normalized_position"]["y"]
    bbox_h = float(candidate["bbox"]["height"])
    reasons: list[str] = []

    score = 0.15 + ocr * 0.40
    if hits >= 3:
        score += 0.22
        reasons.append("confirmado por múltiplas variantes OCR")
    elif hits == 2:
        score += 0.12
        reasons.append("repetido em variantes OCR")
    if candidate.get("unit"):
        score += 0.15
        reasons.append("unidade explícita")
    if 250 <= value_mm <= 3500:
        score += 0.08
        reasons.append("faixa compatível com medida de mobiliário")
    elif 20 <= value_mm < 250:
        score += 0.01
    if bbox_h <= 3:
        score -= 0.06
        reasons.append("texto muito pequeno")
    if y < 0.20 or y > 0.80 or x < 0.20 or x > 0.80:
        score += 0.03
        reasons.append("posição periférica compatível com cota")
    if geometry["line_count"] >= 10:
        score += 0.04
        reasons.append("desenho contém estrutura linear")

    score = round(max(0.05, min(0.98, score)), 3)
    if score >= 0.82:
        status = "high_confidence_candidate"
    elif score >= 0.60:
        status = "probable_dimension"
    elif score >= 0.40:
        status = "weak_dimension_candidate"
    else:
        status = "low_confidence_noise"
    return status, score, reasons


def run_ocr(image: Image.Image) -> tuple[str, list[dict[str, Any]], dict[str, str], float, dict[str, Any]]:
    variants, scale, gray_original = preprocess_variants(image)
    texts: list[str] = []
    candidate_sets: list[list[dict[str, Any]]] = []
    methods: dict[str, str] = {}

    configs = [
        ("psm11", "--oem 3 --psm 11"),
        ("psm6", "--oem 3 --psm 6"),
    ]
    for name, processed in variants:
        for config_name, config in configs:
            data = pytesseract.image_to_data(
                processed,
                lang="por+eng",
                config=config,
                output_type=pytesseract.Output.DICT,
            )
            text = clean_ocr_text(
                "\n".join(str(x) for x in data.get("text", []) if str(x).strip())
            )
            if text:
                texts.append(text)
            candidates = extract_number_candidates(
                data, image.width, image.height, scale, f"{name}-{config_name}"
            )
            candidate_sets.append(candidates)
            methods[f"{name}-{config_name}"] = f"{config_name} candidates={len(candidates)} scale={scale:g}x"

    merged = merge_candidates(candidate_sets)
    geometry = detect_geometry(gray_original)
    for candidate in merged:
        status, score, reasons = classify_candidate(candidate, geometry)
        candidate["status"] = status
        candidate["dimension_confidence"] = score
        candidate["confidence_reasons"] = reasons
        candidate["requires_confirmation"] = score < 0.90

    best_text = max(texts, key=len) if texts else ""
    return best_text, merged, methods, scale, geometry


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "moveis-vision",
        "version": APP_VERSION,
        "capabilities": [
            "ocr_multivariant",
            "dimension_candidate_scoring",
            "geometry_detection",
            "evidence_deduplication",
            "original_image_coordinates",
            "manual_review_gate",
        ],
        "docs": "/docs",
        "health": "/health",
        "process_image": "/process-image",
    }


@app.get("/health")
def health():
    tess_version = str(pytesseract.get_tesseract_version()).strip()
    langs = pytesseract.get_languages(config="")
    return {
        "status": "ok",
        "service": "moveis-vision",
        "version": APP_VERSION,
        "opencv": cv2.__version__,
        "tesseract": tess_version,
        "ocr_languages": [lang for lang in ("por", "eng") if lang in langs],
    }


@app.post("/process-image")
async def process_image(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Envie um arquivo de imagem.")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Imagem maior que {MAX_IMAGE_BYTES // 1024 // 1024} MB.")

    try:
        original = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        if original.width > MAX_DIMENSION or original.height > MAX_DIMENSION:
            raise HTTPException(status_code=413, detail="Dimensões da imagem excedem o limite permitido.")

        text, candidates, methods, scale, geometry = run_ocr(original)
        dimensions = []
        for candidate in candidates:
            dimensions.append({
                "type": "dimension_candidate",
                "value": candidate["value"],
                "value_mm": candidate["value_mm"],
                "raw": candidate["raw"],
                "unit": candidate["unit"] or "unknown",
                "confidence": candidate["dimension_confidence"],
                "ocr_confidence": candidate["confidence"],
                "status": candidate["status"],
                "bbox": candidate["bbox"],
                "normalized_position": candidate["normalized_position"],
                "source": "tesseract+geometry",
                "evidence_hits": candidate["evidence_hits"],
                "confidence_reasons": candidate["confidence_reasons"],
                "requires_confirmation": candidate["requires_confirmation"],
            })

        high = [d for d in dimensions if d["status"] == "high_confidence_candidate"]
        probable = [d for d in dimensions if d["status"] == "probable_dimension"]
        confirmed = len(high) >= 3 and all(d["confidence"] >= 0.90 for d in high)

        return {
            "filename": image.filename,
            "content_type": image.content_type,
            "image": {"width": original.width, "height": original.height},
            "pipeline": {
                "version": APP_VERSION,
                "ocr_scale": scale,
                "variants": len(methods),
                "vision_model_required": True,
            },
            "ocr": {
                "text": text,
                "language": "por+eng",
                "engine": "tesseract",
                "scale": scale,
                "methods": methods,
            },
            "geometry": geometry,
            "detections": {
                "numbers": candidates,
                "dimensions": dimensions,
            },
            "evidence": dimensions,
            "validation": {
                "requires_manual_confirmation": not confirmed,
                "critical_dimensions_confirmed": confirmed,
                "automatic_dimension_confirmation": False,
                "high_confidence_candidates": len(high),
                "probable_candidates": len(probable),
                "review_policy": "OCR and geometry are evidence; final dimensions require visual/model or human validation.",
            },
            "next_step": {
                "recommended": "send_image_and_evidence_to_vision_model",
                "note": "Candidates are not fabrication-ready measurements until validated against the drawing/image.",
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Falha ao processar imagem: {exc}")
