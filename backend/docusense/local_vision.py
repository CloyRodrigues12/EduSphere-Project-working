import fitz  # PyMuPDF
import pandas as pd
import numpy as np
import os
import re
import json
import easyocr
import cv2
from collections import Counter
from django.conf import settings

# Try importing pdfplumber, handle error if missing
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False
    print("--- [Warning] pdfplumber not installed. Horizontal parsing will be limited. ---")

# --- INITIALIZATION ---
print("--- [System] Initializing V12 Fail-Safe Engine... ---")
ocr_reader = easyocr.Reader(['en'], gpu=True)

def extract_data_smart_parser(file_path):
    """
    V12 Fail-Safe Parser:
    1. Detects Layout (Horizontal vs Vertical).
    2. Tries specialized parsers (Table vs Grid).
    3. FAIL-SAFE: If specialized parser returns empty, FORCES Visual Grid.
    """
    filename = os.path.basename(file_path)
    print(f"--- [V12 Parser] Processing: {filename} ---")
    
    # 1. Detect Layout Strategy
    layout_mode = detect_layout_strategy(file_path)
    print(f"--- [V12 Parser] Detected Strategy: {layout_mode} ---")
    
    df = pd.DataFrame()
    
    # 2. Attempt Parsing based on Layout
    if layout_mode == "HORIZONTAL_TABLE" and PDFPLUMBER_AVAILABLE:
        print("--- [V12] Attempting Horizontal Table Extraction... ---")
        df = parse_horizontal_ledger(file_path)
    
    # 3. Fallback Logic (If Horizontal failed or it's Vertical)
    if df.empty:
        if layout_mode == "HORIZONTAL_TABLE":
            print("--- [V12] Horizontal extraction empty. Switching to VISUAL GRID Fallback. ---")
        else:
            print("--- [V12] Running Vertical Visual Grid... ---")
            
        df = parse_vertical_visual_grid(file_path)

    # 4. Final Safety Check
    if df.empty:
        print("--- [V12] Error: Extraction yielded zero rows. ---")
        return pd.DataFrame() # Returns empty, triggers FAILED in service

    # 5. Save & Return
    save_formatted_excel(df, file_path)
    return df

# ==========================================
# STRATEGY 1: HORIZONTAL (Table Extraction)
# ==========================================

def parse_horizontal_ledger(file_path):
    """
    Tries multiple strategies to extract the Ledger table.
    """
    all_rows = []
    
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                # Strategy A: Text-based (Gap detection)
                # Good for files where columns are separated by whitespace
                tables = page.extract_tables(table_settings={
                    "vertical_strategy": "text", 
                    "horizontal_strategy": "text",
                    "intersection_x_tolerance": 5
                })
                
                # If Strategy A fails, try Strategy B (Lines)
                if not tables:
                     tables = page.extract_tables(table_settings={
                        "vertical_strategy": "lines", 
                        "horizontal_strategy": "lines"
                    })
                
                for table in tables:
                    for row in table:
                        # Clean cells
                        clean_row = [str(cell).replace('\n', ' ').strip() if cell else "" for cell in row]
                        # Filter empty rows (must have at least 2 chars of data)
                        if len("".join(clean_row)) > 5:
                            all_rows.append(clean_row)
                            
    except Exception as e:
        print(f"--- [Error] Horizontal Parsing Exception: {e} ---")
        return pd.DataFrame()

    if not all_rows: return pd.DataFrame()
    
    # Normalize Row Lengths
    max_cols = max(len(r) for r in all_rows)
    header = [f"Col_{i}" for i in range(max_cols)]
    
    # Pad rows to max length
    normalized_rows = []
    for r in all_rows:
        pad_len = max_cols - len(r)
        normalized_rows.append(r + [""] * pad_len)
    
    return pd.DataFrame(normalized_rows, columns=header)

# ==========================================
# STRATEGY 2: VERTICAL / UNIVERSAL (Visual Grid)
# ==========================================

def parse_vertical_visual_grid(file_path):
    """
    Uses Global Column Alignment (V10 logic).
    Robust fallback for ANY file type.
    """
    doc = fitz.open(file_path)
    
    # Source Check
    page1_text = doc[0].get_text()
    source_type = "DIGITAL" if len(page1_text.strip()) > 50 else "OCR"
    
    all_pages_words = []
    for page in doc:
        p_words = get_words_v10(page, source_type)
        clean_words = remove_ghost_text(p_words)
        all_pages_words.append(clean_words)

    # Master Grid Discovery
    flat_words = [w for p in all_pages_words for w in p]
    if not flat_words: return pd.DataFrame()
    
    master_columns = discover_global_columns(flat_words)
    
    # Map Pages
    all_rows = []
    for clean_words in all_pages_words:
        page_grid = map_to_master_grid(clean_words, master_columns)
        all_rows.extend(page_grid)
        all_rows.append({}) 

    df = pd.DataFrame(all_rows)
    
    # Ensure Columns match Master Grid
    for i in range(len(master_columns)):
        col_name = f"Col_{i}"
        if col_name not in df.columns: df[col_name] = ""
            
    # Sort Columns
    cols = sorted(list(df.columns), key=lambda x: int(x.split('_')[1]) if '_' in x else 999)
    return df[cols].fillna("")

# ==========================================
# UTILITIES
# ==========================================

def detect_layout_strategy(file_path):
    try:
        doc = fitz.open(file_path)
        text = doc[0].get_text()
        
        # Look for "Seat No:" pattern (Marksheet)
        if re.search(r"Seat\s*N[o0][: \.\-]*\d{3,}", text, re.IGNORECASE):
            return "VERTICAL_GRID"
        
        # Look for Table Headers (Ledger)
        if "Signal Processing" in text or "Credits" in text:
            return "HORIZONTAL_TABLE"
            
        return "VERTICAL_GRID" # Default
    except:
        return "VERTICAL_GRID"

def get_words_v10(page, source_type):
    words = []
    if source_type == "DIGITAL":
        raw = page.get_text("words")
        for w in raw:
            words.append({'x': (w[0]+w[2])/2, 'y': (w[1]+w[3])/2, 'text': w[4]})
    else:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        if pix.n == 4: img = cv2.cvtColor(img, cv2.COLOR_RGBA2RGB)
        results = ocr_reader.readtext(img, detail=1, paragraph=False)
        for (bbox, text, conf) in results:
            if conf < 0.3: continue
            words.append({'x': (bbox[0][0]+bbox[1][0])/4, 'y': (bbox[0][1]+bbox[2][1])/4, 'text': text})
    return words

def remove_ghost_text(words):
    if not words: return []
    words.sort(key=lambda w: (round(w['y']), w['x']))
    unique = []
    if words:
        prev = words[0]
        unique.append(prev)
        for curr in words[1:]:
            dist = abs(curr['x'] - prev['x']) + abs(curr['y'] - prev['y'])
            if curr['text'] == prev['text'] and dist < 5: continue
            unique.append(curr)
            prev = curr
    return unique

def discover_global_columns(all_words):
    if not all_words: return [0]
    x_coords = [w['x'] for w in all_words]
    bins = [round(x/5)*5 for x in x_coords]
    counts = Counter(bins)
    threshold = len(all_words) * 0.005
    valid_peaks = sorted([x for x, c in counts.items() if c > threshold])
    
    if not valid_peaks: return [0]
    
    merged = []
    curr = valid_peaks[0]
    for next_p in valid_peaks[1:]:
        if next_p - curr > 25:
            merged.append(curr)
            curr = next_p
        else:
            curr = (curr + next_p) / 2
    merged.append(curr)
    return sorted(merged)

def map_to_master_grid(words, master_columns):
    if not words: return []
    rows = {}
    for w in words:
        y_bucket = round(w['y'] / 10) * 10
        if y_bucket not in rows: rows[y_bucket] = []
        rows[y_bucket].append(w)
    sorted_y = sorted(rows.keys())
    grid_rows = []
    for y in sorted_y:
        row_words = rows[y]
        row_words.sort(key=lambda w: w['x'])
        row_data = {}
        for w in row_words:
            if not master_columns: continue
            distances = [abs(w['x'] - col_x) for col_x in master_columns]
            nearest_idx = distances.index(min(distances))
            col_key = f"Col_{nearest_idx}"
            if col_key in row_data: row_data[col_key] += " " + w['text']
            else: row_data[col_key] = w['text']
        grid_rows.append(row_data)
    return grid_rows

def save_formatted_excel(df, original_filepath):
    if df.empty:
        print("--- [Error] Excel Save Aborted: DataFrame is empty ---")
        return None
    try:
        filename = os.path.basename(original_filepath)
        safe_name = os.path.splitext(filename)[0]
        excel_name = f"{safe_name}_REPLICA.xlsx"
        path = os.path.join(settings.MEDIA_ROOT, 'docusense_reports', excel_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        print(f"--- [Excel Writer] Saving to: {path} ---")
        with pd.ExcelWriter(path, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, header=False, sheet_name='Result_Data')
            worksheet = writer.sheets['Result_Data']
            cell_format = writer.book.add_format({'text_wrap': True, 'valign': 'top'})
            for idx, col in enumerate(df.columns):
                max_len = 0
                for x in df[col]:
                    if x and len(str(x)) > max_len: max_len = len(str(x))
                width = min(max(max_len + 2, 10), 60)
                worksheet.set_column(idx, idx, width, cell_format)
        return path
    except Exception as e:
        print(f"Excel Error: {e}")
        return None