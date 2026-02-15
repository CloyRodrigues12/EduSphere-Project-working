from paddleocr import PaddleOCR
import numpy as np

ocr = PaddleOCR(use_angle_cls=True, lang='en')

def segment_students(image):
    """
    Returns list of (y_start, y_end) for each student block
    """
    result = ocr.ocr(image, cls=True)

    seat_lines = []
    sgpa_lines = []

    for line in result[0]:
        box, (text, conf) = line
        text_lower = text.lower()

        y_coords = [p[1] for p in box]
        y_mid = int(sum(y_coords) / 4)

        if "seat no" in text_lower:
            seat_lines.append(y_mid)

        if "sgpa" in text_lower:
            sgpa_lines.append(y_mid)

    seat_lines.sort()
    sgpa_lines.sort()

    # Pair seat → sgpa
    blocks = []
    for s in seat_lines:
        candidates = [g for g in sgpa_lines if g > s]
        if candidates:
            blocks.append((s, candidates[0]))

    return blocks
