# backend/docusense/local_vision.py
import fitz  # PyMuPDF
import easyocr
import pandas as pd
import re
import os
from django.conf import settings

# Initialize Reader (Global)
print("--- [Local Vision] Loading AI Models... ---")
# Using 'en' language. gpu=False is safer for dev environments.
reader = easyocr.Reader(['en'], gpu=True)

def extract_text_from_images(file_path):
    """
    Renders PDF pages to high-res images and runs OCR.
    """
    full_text = ""
    doc = fitz.open(file_path)
    total_pages = len(doc)
    
    print(f"--- [Local Vision] Scanning {total_pages} pages... ---")

    for i, page in enumerate(doc):
        # Zoom=2 provides better resolution for small text
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_bytes = pix.tobytes("png")
        
        # 'paragraph=False' gives us a list of strings line-by-line which is easier to parse
        result = reader.readtext(img_bytes, detail=0, paragraph=False)
        
        # Join with spaces to create a continuous stream
        page_text = " ".join(result)
        full_text += page_text + " \n "
        
        print(f"    -> Page {i+1} scanned ({len(page_text)} chars).")

    return full_text

def parse_ocr_text(raw_text):
    """
    Intelligent parsing of OCR stream to fix Name and Grade mapping errors.
    """
    print("--- [Local Vision] Parsing Data Stream... ---")
    
    # Clean up the stream
    text = raw_text.replace('\n', ' ')
    
    students = {}
    
    # 1. FIND STUDENTS
    # Regex Fix: Stop capturing Name when we hit 'Paper', 'PR', 'Entitlement', or 'Seat'
    # This fixes: "ADITI... Paper Paper" issue.
    student_regex = re.compile(r"Seat\s*(?:No|Nu|N0)[\s:.]*(\d+).*?Name[\s:.]*([A-Z\s.]+?)(?=\s+(?:Paper|PR|Entitlement|Seat))", re.IGNORECASE)
    
    # Find all student positions
    student_matches = []
    for match in student_regex.finditer(text):
        seat = match.group(1)
        name = match.group(2).strip()
        student_matches.append({"pos": match.start(), "seat": seat, "name": name})

    print(f"    -> Found {len(student_matches)} Students.")

    # 2. FIND SUBJECT ROWS
    # Pattern: Subject Code (e.g. ECS510) ... ... Grade (A+) Points (9)
    # We look for the Code, then scan the 'Context' following it.
    code_regex = re.compile(r'\b([A-Z]{2,5}\s?-?\d{3,4})\b')
    
    # Valid Grades
    valid_grades = ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F']

    for match in code_regex.finditer(text):
        code = match.group(1)
        start = match.end()
        
        # Identify Owner (Nearest previous header)
        owner = None
        for s in reversed(student_matches):
            if s['pos'] < match.start():
                owner = s
                break
        
        if not owner: continue
        
        # Extract Context (Next 200 chars) to find Name, Grade, Points
        context = text[start:start+250]
        tokens = context.split()
        
        # A. Get Subject Name (First 3-5 words usually)
        # Stop if we hit a number (Credits)
        sub_name_parts = []
        for t in tokens:
            if t.isdigit() and len(sub_name_parts) > 0: break
            if len(t) > 1: sub_name_parts.append(t)
            if len(sub_name_parts) >= 6: break # Safety cap
        
        sub_name = " ".join(sub_name_parts)

        # B. Find Grade & Points
        # Heuristic: Look for [Grade] followed immediately by [Digit]
        # Example: "A+ 9" or "B 6"
        # This avoids capturing "50 P" because "P" is followed by "13" (marks) usually, but we check specifically.
        
        found_grade = "N/A"
        found_points = "0"
        
        # Scan tokens from END to START of context (Grade is usually at end of row)
        # We look for the pattern: Grade -> Digit
        for i in range(len(tokens) - 2, -1, -1):
            curr = tokens[i].strip('.,')
            nxt = tokens[i+1].strip('.,')
            
            if curr in valid_grades and nxt.isdigit():
                # Found it! (e.g. "A+", "9")
                found_grade = curr
                found_points = nxt
                break
        
        # Fallback: If no Grade+Digit pattern, just look for last valid grade char
        if found_grade == "N/A":
             for t in reversed(tokens):
                 clean_t = t.strip('.,')
                 if clean_t in valid_grades:
                     found_grade = clean_t
                     break

        # Save Data
        if owner['seat'] not in students:
            students[owner['seat']] = {
                "Seat No": owner['seat'],
                "Student Name": owner['name'],
                "Results": []
            }
        
        students[owner['seat']]['Results'].append({
            "Subject Code": code,
            "Subject Name": sub_name,
            "Grade": found_grade,
            "Points": found_points
        })

    # Flatten for Excel
    final_rows = []
    for s in students.values():
        for r in s['Results']:
            final_rows.append({
                "Seat No": s['Seat No'],
                "Student Name": s['Student Name'],
                "Subject Code": r['Subject Code'],
                "Subject Name": r['Subject Name'],
                "Grade": r['Grade'],
                "Points": r['Points']
            })
            
    return pd.DataFrame(final_rows)

def save_local_excel(df, filename):
    if df.empty: return None
    safe_name = os.path.splitext(filename)[0]
    excel_name = f"{safe_name}_OCR_EXTRACTED.xlsx"
    path = os.path.join(settings.MEDIA_ROOT, 'docusense_reports', excel_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_excel(path, index=False)
    return os.path.join('docusense_reports', excel_name)