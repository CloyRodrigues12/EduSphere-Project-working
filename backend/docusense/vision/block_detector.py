import cv2
import numpy as np

def detect_student_blocks(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    thresh = cv2.adaptiveThreshold(
        blur, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31, 15
    )

    # Extract horizontal lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (300, 1))
    horizontal_lines = cv2.morphologyEx(
        thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2
    )

    # Expand vertically to form blocks
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 120))
    merged = cv2.dilate(horizontal_lines, vertical_kernel, iterations=3)

    contours, _ = cv2.findContours(
        merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    h_img, w_img = gray.shape
    blocks = []

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)

        if (
            w > w_img * 0.5 and
            h > 100 and
            y > 50
        ):
            blocks.append((x, y, w, h))

    blocks = sorted(blocks, key=lambda b: b[1])
    return blocks
