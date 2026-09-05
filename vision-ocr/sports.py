from __future__ import annotations

import re
import unicodedata
from typing import Any

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageOps


STAT_ALIASES: dict[str, tuple[str, ...]] = {
    "attacks": ("ataques", "attacks"),
    "dangerous_attacks": ("ataques perigosos", "dangerous attacks", "ataques peligroso", "ataques peligrosos"),
    "possession": ("% de posse", "posse", "possession", "posesion", "posesión"),
    "shots": ("finalizações", "finalizacoes", "finalizações / chutes ao gol", "shots", "tiros"),
    "shots_on_target": ("chutes ao gol", "shots on target", "on target"),
    "corners": ("escanteios", "corners", "corner"),
    "yellow_cards": ("cartões amarelos", "cartoes amarelos", "yellow cards", "yellow card"),
    "red_cards": ("cartões vermelhos", "cartoes vermelhos", "red cards", "red card"),
}

NUMBER_RE = re.compile(r"(?<![A-Za-z0-9])\d{1,4}(?:[.,]\d{1,2})?(?![A-Za-z0-9])")
SCORE_RE = re.compile(r"(?<!\d)(\d{1,2})\s*[-:]\s*(\d{1,2})(?!\d)")


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch)).lower()


def _number(value: str) -> int | float:
    value = value.replace(",", ".")
    number = float(value)
    return int(number) if number.is_integer() else number


def _numbers(text: str) -> list[int | float]:
    return [_number(x) for x in NUMBER_RE.findall(text)]


def _preprocess(image: Image.Image) -> list[tuple[str, np.ndarray, float]]:
    rgb = np.array(ImageOps.exif_transpose(image).convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape[:2]
    scale = 2.0 if max(h, w) < 3500 else 1.25
    enlarged = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    denoised = cv2.fastNlMeansDenoising(enlarged, None, 5, 5, 15)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(denoised)
    otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    adaptive = cv2.adaptiveThreshold(clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 9)
    return [("gray", clahe, scale), ("otsu", otsu, scale), ("adaptive", adaptive, scale)]


def _ocr_lines(image: Image.Image) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    all_lines: list[dict[str, Any]] = []
    all_text: list[str] = []
    methods: list[str] = []
    for method, processed, scale in _preprocess(image):
        for psm in (11, 6):
            data = pytesseract.image_to_data(
                processed,
                lang="por+eng",
                config=f"--oem 3 --psm {psm}",
                output_type=pytesseract.Output.DICT,
            )
            groups: dict[tuple[int, int], list[dict[str, Any]]] = {}
            for i, raw in enumerate(data.get("text", [])):
                text = str(raw or "").strip()
                try:
                    conf = float(data.get("conf", ["-1"])[i])
                except (ValueError, IndexError):
                    conf = -1
                if not text or conf < 10:
                    continue
                key = (int(data.get("block_num", [0])[i]), int(data.get("par_num", [0])[i]))
                token = {
                    "text": text,
                    "conf": max(0.0, min(1.0, conf / 100.0)),
                    "x": int(float(data.get("left", [0])[i]) / scale),
                    "y": int(float(data.get("top", [0])[i]) / scale),
                    "w": max(1, int(float(data.get("width", [1])[i]) / scale)),
                    "h": max(1, int(float(data.get("height", [1])[i]) / scale)),
                }
                groups.setdefault(key, []).append(token)
            for tokens in groups.values():
                tokens.sort(key=lambda t: t["x"])
                text = " ".join(t["text"] for t in tokens)
                all_lines.append({"text": text, "tokens": tokens, "confidence": round(sum(t["conf"] for t in tokens) / len(tokens), 3)})
                all_text.append(text)
            methods.append(f"{method}-psm{psm}")
    # Prefer the clearest/longest unique OCR lines while retaining all evidence.
    unique: dict[str, dict[str, Any]] = {}
    for line in all_lines:
        key = _fold(line["text"])
        if key and (key not in unique or line["confidence"] > unique[key]["confidence"]):
            unique[key] = line
    return list(unique.values()), all_text, methods


def _find_stat(line: str) -> str | None:
    folded = _fold(line)
    if "finaliz" in folded and "chutes" in folded and "gol" in folded:
        return "shots_combined"
    # Long labels first prevents "posse" matching inside another label.
    aliases = sorted(((alias, key) for key, values in STAT_ALIASES.items() for alias in values), key=lambda x: len(x[0]), reverse=True)
    for alias, key in aliases:
        if _fold(alias) in folded:
            return key
    return None


def _pair_from_line(line: dict[str, Any]) -> tuple[list[int | float], float] | None:
    values = _numbers(line["text"])
    # A full-page PSM result can place many unrelated labels in one OCR line.
    # Only trust compact lines as direct label/value evidence.
    xs = [token["x"] for token in line["tokens"]]
    compact = not xs or max(xs) - min(xs) <= 280
    if len(values) >= 2 and compact and len(values) <= 4:
        return values[-2:], line["confidence"]
    return None


def _extract_stats(lines: list[dict[str, Any]]) -> tuple[dict[str, list[int | float]], dict[str, Any]]:
    stats: dict[str, list[int | float]] = {}
    evidence: dict[str, Any] = {}
    for line in lines:
        stat = _find_stat(line["text"])
        if not stat:
            continue
        pair = _pair_from_line(line)
        if pair:
            values, confidence = pair
            if stat not in stats or confidence > evidence[stat]["confidence"]:
                stats[stat] = values
                evidence[stat] = {"raw": line["text"], "confidence": confidence, "source": "same_ocr_line"}
            continue
        # Some layouts put the label above the two values. Use nearby tokens/lines.
        cy = sum(t["y"] + t["h"] / 2 for t in line["tokens"]) / max(1, len(line["tokens"]))
        cx = sum(t["x"] + t["w"] / 2 for t in line["tokens"]) / max(1, len(line["tokens"]))
        nearby: list[tuple[float, list[int | float], float, str]] = []
        for candidate in lines:
            if candidate is line:
                continue
            values = _numbers(candidate["text"])
            if len(values) < 2:
                continue
            yy = sum(t["y"] + t["h"] / 2 for t in candidate["tokens"]) / max(1, len(candidate["tokens"]))
            candidate_cx = sum(t["x"] + t["w"] / 2 for t in candidate["tokens"]) / max(1, len(candidate["tokens"]))
            # The value row is below the label and belongs to the same visual
            # column. This prevents a later unrelated pair from being chosen.
            if 0 <= yy - cy <= 180 and abs(candidate_cx - cx) <= 190:
                nearby.append((abs(yy - cy) + abs(candidate_cx - cx) * 0.15, values[-2:], candidate["confidence"], candidate["text"]))
        if nearby:
            _, values, confidence, raw = min(nearby, key=lambda x: (x[0], -x[2]))
            stats.setdefault(stat, values)
            evidence.setdefault(stat, {"raw": f"{line['text']} | {raw}", "confidence": round(confidence * 0.85, 3), "source": "nearby_ocr_line"})
    return stats, evidence


def _extract_combined_shots(lines: list[dict[str, Any]]) -> tuple[list[int | float] | None, list[int | float] | None, dict[str, Any]]:
    """Read layouts such as `4/0` on the left and `8/4` on the right."""
    label = next(
        (
            line for line in lines
            if _find_stat(line["text"]) == "shots_combined"
            and 600 <= min((token["y"] for token in line["tokens"]), default=0) <= 1100
        ),
        None,
    )
    if not label:
        return None, None, {}
    label_y = min((token["y"] for token in label["tokens"]), default=0)
    label_x = sum(token["x"] + token["w"] / 2 for token in label["tokens"]) / max(1, len(label["tokens"]))
    candidates: list[tuple[float, list[int | float], str]] = []
    for line in lines:
        for token in line["tokens"]:
            if not label_y < token["y"] <= label_y + 180:
                continue
            raw = token["text"].replace(" ", "")
            match = re.fullmatch(r"(\d{1,2})[/|](\d{1,2})", raw)
            if match:
                pair = [_number(match.group(1)), _number(match.group(2))]
            elif token["x"] < label_x - 100 and re.fullmatch(r"\d{2}", raw):
                pair = [_number(raw[0]), _number(raw[1])]
            else:
                continue
            candidates.append((token["x"], pair, token["text"]))
    if len(candidates) < 2:
        return None, None, {}
    candidates.sort(key=lambda item: item[0])
    left = candidates[0][1]
    right = candidates[-1][1]
    return [left[0], right[0]], [left[1], right[1]], {
        "raw": f"{candidates[0][2]} | {candidates[-1][2]}",
        "confidence": 0.7,
        "source": "split_pair_layout",
    }


def _extract_score(lines: list[dict[str, Any]]) -> tuple[list[int] | None, str | None]:
    for line in lines:
        y = min((token["y"] for token in line["tokens"]), default=0)
        if not 350 <= y <= 650:
            continue
        values = _numbers(line["text"])
        if len(values) == 2 and all(float(value).is_integer() and 0 <= value <= 20 for value in values):
            return [int(values[0]), int(values[1])], line["text"]
        match = SCORE_RE.search(line["text"])
        if match:
            return [int(match.group(1)), int(match.group(2))], line["text"]
    return None, None


def _extract_teams(lines: list[dict[str, Any]], score_line: str | None) -> dict[str, str | None]:
    if not score_line:
        return {"home": None, "away": None}
    index = next((i for i, line in enumerate(lines) if line["text"] == score_line), None)
    if index is None:
        return {"home": None, "away": None}
    before = [l["text"] for l in lines[max(0, index - 4):index] if not _find_stat(l["text"])]
    after = [l["text"] for l in lines[index + 1:index + 5] if not _find_stat(l["text"])]
    return {"home": before[-1] if before else None, "away": after[0] if after else None}


def _validate(stats: dict[str, list[int | float]], score: list[int] | None) -> dict[str, Any]:
    issues: list[str] = []
    possession = stats.get("possession")
    possession_sum = None
    if possession and len(possession) == 2:
        possession_sum = possession[0] + possession[1]
        if possession_sum != 100:
            issues.append("possession_not_100")
    for key, values in stats.items():
        if len(values) != 2:
            issues.append(f"invalid_pair:{key}")
        if any(float(value) < 0 for value in values):
            issues.append(f"negative_value:{key}")
    return {
        "possession_sum": possession_sum,
        "issues": issues,
        "requires_manual_review": bool(issues or not stats),
        "score_detected": score is not None,
    }


def process_sports_image(image: Image.Image) -> dict[str, Any]:
    image = ImageOps.exif_transpose(image).convert("RGB")
    lines, raw_text, methods = _ocr_lines(image)
    lines.sort(key=lambda line: min((token["y"] for token in line["tokens"]), default=0))
    stats, evidence = _extract_stats(lines)
    stats.pop("shots_combined", None)
    evidence.pop("shots_combined", None)
    shots, shots_on_target, shots_evidence = _extract_combined_shots(lines)
    if shots is not None and shots_on_target is not None:
        stats["shots"] = shots
        stats["shots_on_target"] = shots_on_target
        evidence["shots"] = shots_evidence
        evidence["shots_on_target"] = shots_evidence
    score, score_line = _extract_score(lines)
    teams = _extract_teams(lines, score_line)
    validation = _validate(stats, score)
    confidences = [float(item["confidence"]) for item in evidence.values()]
    return {
        "mode": "sports_statistics",
        "image": {"width": image.width, "height": image.height},
        "teams": teams,
        "score": {"home": score[0], "away": score[1]} if score else None,
        "statistics": stats,
        "evidence": evidence,
        "ocr": {"engine": "tesseract", "language": "por+eng", "methods": methods, "text": "\n".join(raw_text)},
        "validation": validation,
        "confidence": round(sum(confidences) / len(confidences), 3) if confidences else 0.0,
    }
