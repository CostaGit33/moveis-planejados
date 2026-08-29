from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image, ImageOps
import cv2
import numpy as np
import pytesseract
import io
import re
from typing import Any

app = FastAPI(
    title="Moveis Planejados Vision OCR",
    version="2.1.0",
    description="OCR técnico e análise de evidências para rascunhos de móveis planejados."
)

MAX_IMAGE_BYTES = 15 * 1024 * 1024
MIN_DIMENSION = 20
MAX_DIMENSION = 10000


def normalize_number(raw: str) -> float | None:
    value = re.sub(r"[^0-9,.]", "", raw)
    if not value:
        return None
    if re.fullmatch(r"\d{1,2}[.,]\d{3}", value):
        value = value.replace(".", "").replace(",", "")
    else:
        value = value.replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def resize_for_ocr(gray: np.ndarray) -> tuple[np.ndarray, float]:
    h, w = gray.shape[:2]
    scale = 2.0
    if max(h, w) > 3500:
        scale = 1.5
    elif max(h, w) < 900:
        scale = 3.0
    resized = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return resized, scale


def preprocess_variants(image: Image.Image) -> tuple[list[tuple[str, np.ndarray]], float]:
    rgb = np.array(ImageOps.exif_transpose(image).convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray, scale = resize_for_ocr(gray)

    denoised = cv2.fastNlMeansDenoising(gray, None, 7, 7, 21)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(denoised)
    otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    adaptive = cv2.adaptiveThreshold(
        clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 11
    )
    return [
        ("gray", clahe),
        ("otsu", otsu),
        ("adaptive", adaptive),
    ], scale


def clean_ocr_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def extract_number_candidates(
    data: dict[str, list[Any]],
    processed_width: int,
    processed_height: int,
    original_width: int,
    original_height: int,
    scale: float,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    total = len(data.get("text", []))

    for i in range(total):
        raw = str(data["text"][i] or "").strip()
        conf_raw = data.get("conf", ["-1"] * total)[i]
        try:
            confidence = float(conf_raw)
        except (TypeError, ValueError):
            confidence = -1

        if confidence < 25 or not raw:
            continue

        match = re.search(
            r"(?<!\d)(\d{2,5}(?:[.,]\d{1,3})?)(?:\s*(mm|cm|m))?\b",
            raw,
            re.I,
        )
        if not match:
            match = re.search(r"(\d{2,5})", raw)
        if not match:
            continue

        number = normalize_number(match.group(1))
        if number is None or number < MIN_DIMENSION or number > 10000:
            continue

        px = int(data.get("left", [0] * total)[i])
        py = int(data.get("top", [0] * total)[i])
        pw = int(data.get("width", [0] * total)[i])
        ph = int(data.get("height", [0] * total)[i])

        # Tesseract runs on an upscaled image. Convert the bounding box back
        # to ORIGINAL image coordinates so downstream vision/human review can
        # draw the evidence on the actual uploaded image.
        x = max(0, round(px / scale))
        y = max(0, round(py / scale))
        w = max(1, round(pw / scale))
        h = max(1, round(ph / scale))
        x = min(x, max(0, original_width - 1))
        y = min(y, max(0, original_height - 1))
        w = min(w, max(1, original_width - x))
        h = min(h, max(1, original_height - y))

        unit = match.group(2).lower() if match.lastindex and match.lastindex >= 2 and match.group(2) else None
        ocr_confidence = round(min(confidence / 100.0, 1.0), 3)

        candidates.append({
            "value": int(number) if number.is_integer() else number,
            "raw": raw,
            "confidence": ocr_confidence,
            "unit": unit,
            "bbox": {"x": x, "y": y, "width": w, "height": h},
            "normalized_position": {
                "x": round((x + w / 2) / max(original_width, 1), 4),
                "y": round((y + h / 2) / max(original_height, 1), 4),
            },
            "source_image": "original",
            "ocr_scale": scale,
            "processed_bbox": {"x": px, "y": py, "width": pw, "height": ph},
        })
    return candidates


def classify_dimension_candidate(candidate: dict[str, Any], image_width: int, image_height: int) -> tuple[str, float]:
    value = float(candidate["value"])
    x = candidate["normalized_position"]["x"]
    y = candidate["normalized_position"]["y"]
    confidence = float(candidate["confidence"])
    unit = candidate.get("unit")
    bbox_h = float(candidate["bbox"]["height"])

    # Heuristics only: OCR candidates are evidence, never confirmed measures.
    if 1000 <= value <= 3500:
        base = 0.55
    elif 300 <= value <= 1000:
        base = 0.45
    elif 20 <= value < 300:
        base = 0.30
    else:
        base = 0.20

    if unit:
        base += 0.20
    if bbox_h >= 8:
        base += 0.04
    elif bbox_h <= 3:
        base -= 0.05

    if y < 0.18 or y > 0.82:
        base += 0.05
    if x < 0.18 or x > 0.82:
        base += 0.03

    return "dimension_candidate", round(min(0.95, max(0.05, base * 0.7 + confidence * 0.3)), 3)


def merge_candidates(candidate_sets: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    merged: dict[tuple[int, int, int], dict[str, Any]] = {}
    for candidates in candidate_sets:
        for item in candidates:
            b = item["bbox"]
            key = (
                int(item["value"]),
                round(b["x"] / 10),
                round(b["y"] / 10),
            )
            previous = merged.get(key)
            if previous is None or item["confidence"] > previous["confidence"]:
                merged[key] = item
    return sorted(merged.values(), key=lambda x: (-x["confidence"], x["value"]))[:50]


def run_ocr(image: Image.Image) -> tuple[str, list[dict[str, Any]], dict[str, str], float]:
    variants, scale = preprocess_variants(image)
    texts: list[str] = []
    candidate_sets: list[list[dict[str, Any]]] = []
    methods: dict[str, str] = {}

    for name, processed in variants:
        config = "--oem 3 --psm 11"
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
            data,
            processed.shape[1],
            processed.shape[0],
            image.width,
            image.height,
            scale,
        )
        candidate_sets.append(candidates)
        methods[name] = f"psm11 candidates={len(candidates)} scale={scale:g}x"

    merged = merge_candidates(candidate_sets)
    best_text = max(texts, key=len) if texts else ""
    return best_text, merged, methods, scale


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "moveis-vision",
        "version": "2.1.0",
        "docs": "/docs",
        "health": "/health",
        "process_image": "/process-image",
    }


@app.get("/health")
def health():
    tess_version = str(pytesseract.get_tesseract_version())
    langs = pytesseract.get_languages(config="")
    return {
        "status": "ok",
        "service": "moveis-vision",
        "version": "2.1.0",
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
        raise HTTPException(status_code=413, detail="Imagem maior que 15 MB.")

    try:
        original = Image.open(io.BytesIO(data))
        original = ImageOps.exif_transpose(original)
        if original.width > MAX_DIMENSION or original.height > MAX_DIMENSION:
            raise HTTPException(status_code=413, detail="Dimensões da imagem excedem o limite permitido.")

        text, candidates, methods, scale = run_ocr(original)
        evidence = []
        for candidate in candidates:
            evidence_type, evidence_confidence = classify_dimension_candidate(
                candidate, original.width, original.height
            )
            evidence.append({
                "type": evidence_type,
                "value": candidate["value"],
                "raw": candidate["raw"],
                "unit": candidate["unit"],
                "confidence": evidence_confidence,
                "ocr_confidence": candidate["confidence"],
                "bbox": candidate["bbox"],
                "normalized_position": candidate["normalized_position"],
                "source": "tesseract",
                "requires_confirmation": True,
            })

        return {
            "filename": image.filename,
            "content_type": image.content_type,
            "image": {"width": original.width, "height": original.height},
            "ocr": {
                "text": text,
                "language": "por+eng",
                "engine": "tesseract",
                "scale": scale,
                "methods": methods,
            },
            "detections": {
                "numbers": candidates,
                "dimensions": [e for e in evidence if e["type"] == "dimension_candidate"],
            },
            "evidence": evidence,
            "validation": {
                "requires_manual_confirmation": True,
                "critical_dimensions_confirmed": False,
                "automatic_dimension_confirmation": False,
            },
            "next_step": {
                "recommended": "send_evidence_to_vision_model_and_human_review",
                "note": "OCR candidates are evidence only and must not be treated as confirmed measurements."
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Falha ao processar imagem: {exc}")
