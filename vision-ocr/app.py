from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image
import cv2
import numpy as np
import pytesseract
import io
import re

app = FastAPI(title="Moveis Planejados Vision OCR", version="1.0.0")


def preprocess(image: Image.Image) -> np.ndarray:
    rgb = np.array(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 11
    )


def extract_dimensions(text: str):
    values = []
    for match in re.finditer(r"(?<!\d)(\d{2,5})(?:[,.](\d{1,2}))?\s*(?:mm|cm|m)?\b", text, re.I):
        whole, decimal = match.groups()
        value = float(f"{whole}.{decimal}") if decimal else int(whole)
        values.append(value)
    return values[:30]


@app.get("/health")
def health():
    return {"status": "ok", "service": "moveis-vision", "opencv": cv2.__version__, "tesseract": str(pytesseract.get_tesseract_version())}


@app.post("/process-image")
async def process_image(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Envie um arquivo de imagem.")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem maior que 15 MB.")

    try:
        original = Image.open(io.BytesIO(data))
        processed = preprocess(original)
        text = pytesseract.image_to_string(processed, lang="por+eng", config="--psm 6")
        dimensions = extract_dimensions(text)

        return {
            "filename": image.filename,
            "content_type": image.content_type,
            "image": {"width": original.width, "height": original.height},
            "ocr": {"text": text.strip(), "language": "por+eng"},
            "dimensions_detected": dimensions,
            "evidence": [],
            "validation": {
                "requires_manual_confirmation": True,
                "critical_dimensions_confirmed": False
            }
        }
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Falha ao processar imagem: {exc}")
