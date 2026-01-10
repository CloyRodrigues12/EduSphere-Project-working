import fitz  # PyMuPDF
import pandas as pd
import numpy as np
import os
import re
import json
import easyocr
import time
from collections import Counter
from django.conf import settings

print("--- [System] Initializing V10 Global Grid Engine (Stable)... ---")
ocr_reader = easyocr.Reader(['en'], gpu=True)

def extract_data_smart_parser(file_path, progress_callback=None):
    """
    Enhanced V10 Parser with Progress Tracking and Semantic Analysis.
    """
    filename = os.path.basename(file_path)
    if progress_callback: progress_callback(5, "Initializing AI Vision Engine...")
    
    doc = fitz.open(file_path)
    total_pages = len(doc)
    
    # 1. Detect Mode
    page1_text = doc[0].get_text()
    source_type = "DIGITAL" if len(page1_text.strip()) > 50 else "OCR"
    
    all_pages_words = []
    
    # 2. Extract Words (Page-Aware)
    for i, page in enumerate(doc):
        # Update Progress
        if progress_callback:
            percent = 10 + int((i / total_pages) * 50) # Scale 10-60%
            progress_callback(percent, f"Scanning Page {i+1} of {total_pages} ({source_type})...")
            
        p_words = get_words(page, source_type)
        clean_words = remove_ghost_text(p_words)
        all_pages_words.append(clean_words)

    # 3. Discover Global Columns
    if progress_callback: progress_callback(65, "Aligning Global Grid Structure...")
    flat_words = [w for p in all_pages_words for w in p]
    master_columns = discover_global_columns(flat_words)

    # 4. Map Each Page
    if progress_callback: progress_callback(75, "Mapping Data to Grid Cells...")
    all_rows = []
    for clean_words in all_pages_words:
        page_grid = map_to_master_grid(clean_words, master_columns)
        all_rows.extend(page_grid)
        all_rows.append({}) 

    # 5. Create DataFrame
    df = pd.DataFrame(all_rows)
    for i in range(len(master_columns)):
        col_name = f"Col_{i}"
        if col_name not in df.columns: df[col_name] = ""
            
    cols = sorted(list(df.columns), key=lambda x: int(x.split('_')[1]) if '_' in x else 999)
    df = df[cols]
    
    # --- CRITICAL FIX: CLEAN NAN VALUES ---
    df.fillna("", inplace=True)

    # 6. Save Enhanced Excel
    if progress_callback: progress_callback(85, "Generating Smart Excel Report...")
    excel_path = save_formatted_excel(df, file_path)
    
    # 7. Semantic Analysis for Charts
    if progress_callback: progress_callback(90, "Analyzing Student Performance...")
    analytics = perform_semantic_analysis(df)
    
    return df, excel_path, analytics

# --- SEMANTIC ANALYSIS ENGINE ---
def perform_semantic_analysis(df):
    """
    Converts raw grid columns into meaningful data for charts.
    """
    seat_col = None
    sgpa_col = None
    subject_cols = []
    
    # Heuristic Column Identification
    for col in df.columns:
        sample = df[col].astype(str).tolist()[:20] # Check top 20 rows
        digit_matches = sum(1 for x in sample if re.match(r"^\d{5,6}$", x))
        float_matches = sum(1 for x in sample if re.match(r"^[0-9]\.\d{2}$", x))
        
        if digit_matches > 3: seat_col = col
        elif float_matches > 3: sgpa_col = col
        else: subject_cols.append(col) # Potential subject column

    students = []
    subject_stats = {} # {Col_Name: {pass: 0, fail: 0, top_score: 0, scores: []}}

    for idx, row in df.iterrows():
        # Identify Student Row
        if not seat_col or not re.match(r"^\d{5,6}$", str(row[seat_col])):
            continue
            
        seat_no = str(row[seat_col])
        sgpa = 0.0
        try: sgpa = float(row[sgpa_col])
        except: pass
        
        student_subjects = []
        
        for col in subject_cols:
            val = str(row[col]).strip()
            # If value looks like a mark/grade
            if val in ['F', 'P', 'Ab'] or (val.replace('.','',1).isdigit() and float(val) <= 100):
                student_subjects.append({'col': col, 'val': val})
                
                # Update Subject Stats
                if col not in subject_stats: 
                    subject_stats[col] = {'pass':0, 'fail':0, 'scores':[]}
                
                if val == 'F' or val == 'Ab':
                    subject_stats[col]['fail'] += 1
                else:
                    subject_stats[col]['pass'] += 1
                    try: subject_stats[col]['scores'].append(float(val))
                    except: pass

        students.append({
            'seat_no': seat_no,
            'sgpa': sgpa,
            'subjects': student_subjects
        })

    # Top Performers List
    students.sort(key=lambda x: x['sgpa'], reverse=True)
    rank_list = [{"rank": i+1, "seat_no": s['seat_no'], "sgpa": s['sgpa']} for i, s in enumerate(students[:20])]

    # Subject Analysis for Charts
    chart_data = []
    for col, stats in subject_stats.items():
        if stats['pass'] + stats['fail'] > 5: # Ignore noise columns
            avg = sum(stats['scores'])/len(stats['scores']) if stats['scores'] else 0
            chart_data.append({
                'subject_id': col,
                'pass': stats['pass'],
                'fail': stats['fail'],
                'avg': round(avg, 2),
                'top_score': max(stats['scores']) if stats['scores'] else 0
            })

    return {
        'total_students': len(students),
        'average_sgpa': round(sum(s['sgpa'] for s in students)/len(students), 2) if students else 0, # Key matched with services.py
        'overall_rank_list': rank_list,
        'subject_performance': chart_data,
        'students_full': students # For drill-down
    }

# --- CORE VISION LOGIC (V10) ---
def get_words(page, source_type):
    words = []
    if source_type == "DIGITAL":
        raw = page.get_text("words")
        for w in raw:
            words.append({'x': (w[0] + w[2]) / 2, 'y': (w[1] + w[3]) / 2, 'text': w[4]})
    else:
        # Improved OCR handling: bytes instead of cv2 buffer
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_bytes = pix.tobytes("png")
        results = ocr_reader.readtext(img_bytes, detail=1, paragraph=False)
        for (bbox, text, conf) in results:
            if conf < 0.3: continue
            words.append({'x': (bbox[0][0] + bbox[1][0]) / 4, 'y': (bbox[0][1] + bbox[2][1]) / 4, 'text': text})
    return words

def remove_ghost_text(words):
    if not words: return []
    words.sort(key=lambda w: (round(w['y']), w['x']))
    unique = []
    prev = words[0]
    unique.append(prev)
    for curr in words[1:]:
        dist = abs(curr['x'] - prev['x']) + abs(curr['y'] - prev['y'])
        if curr['text'] == prev['text'] and dist < 5: continue 
        unique.append(curr)
        prev = curr
    return unique

def discover_global_columns(all_words):
    if not all_words: return []
    x_coords = [w['x'] for w in all_words]
    bins = [round(x/5)*5 for x in x_coords]
    counts = Counter(bins)
    threshold = len(all_words) * 0.005
    valid_peaks = sorted([x for x, c in counts.items() if c > threshold])
    if not valid_peaks: return [0]
    merged_cols = []
    curr = valid_peaks[0]
    for next_p in valid_peaks[1:]:
        if next_p - curr > 25:
            merged_cols.append(curr)
            curr = next_p
        else:
            curr = (curr + next_p) / 2
    merged_cols.append(curr)
    return sorted(merged_cols)

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
            distances = [abs(w['x'] - col_x) for col_x in master_columns]
            nearest_idx = distances.index(min(distances))
            col_key = f"Col_{nearest_idx}"
            if col_key in row_data: row_data[col_key] += " " + w['text']
            else: row_data[col_key] = w['text']
        grid_rows.append(row_data)
    return grid_rows

def save_formatted_excel(df, original_filepath):
    try:
        filename = os.path.basename(original_filepath)
        safe_name = os.path.splitext(filename)[0]
        excel_name = f"{safe_name}_REPLICA.xlsx"
        path = os.path.join(settings.MEDIA_ROOT, 'docusense_reports', excel_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        print(f"--- [Excel Writer] Saving Enhanced Report to: {path} ---")
        
        # Ensure No NaN values
        df = df.fillna("")
        
        with pd.ExcelWriter(path, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, header=False, sheet_name='Result_Data')
            workbook = writer.book
            worksheet = writer.sheets['Result_Data']
            
            # --- STYLING ---
            fmt_text = workbook.add_format({'text_wrap': True, 'valign': 'top'})
            fmt_fail = workbook.add_format({'text_wrap': True, 'font_color': '#9C0006', 'bg_color': '#FFC7CE'}) # Red for Fail
            fmt_pass = workbook.add_format({'text_wrap': True, 'font_color': '#006100', 'bg_color': '#C6EFCE'}) # Green for Pass
            
            # Auto-Fit & Conditional Formatting
            for idx, col in enumerate(df.columns):
                max_len = 0
                for r_idx, val in enumerate(df[col]):
                    val_str = str(val)
                    if len(val_str) > max_len: max_len = len(val_str)
                    
                    # Apply Conditional Formatting to cells
                    if val_str == 'F':
                        worksheet.write(r_idx, idx, val, fmt_fail)
                    elif val_str in ['A+', 'O']:
                        worksheet.write(r_idx, idx, val, fmt_pass)
                    else:
                        worksheet.write(r_idx, idx, val, fmt_text)
                
                width = min(max(max_len + 2, 10), 60)
                worksheet.set_column(idx, idx, width)
                
            # Freeze First Column
            worksheet.freeze_panes(0, 1)
            
        return os.path.join('docusense_reports', excel_name)
    except Exception as e:
        print(f"Excel Error: {e}")
        return None