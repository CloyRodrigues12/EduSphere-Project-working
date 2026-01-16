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

print("--- [System] Initializing V20 Robust Engine... ---")
ocr_reader = easyocr.Reader(['en'], gpu=True)

def extract_data_smart_parser(file_path, progress_callback=None):
    """
    V20: Visual Grid with Robust Semantic Analysis.
    """
    filename = os.path.basename(file_path)
    if progress_callback: progress_callback(5, "Initializing AI Vision Engine...")
    
    doc = fitz.open(file_path)
    total_pages = len(doc)
    page1_text = doc[0].get_text()
    source_type = "DIGITAL" if len(page1_text.strip()) > 50 else "OCR"
    
    all_pages_words = []
    
    # 1. Extraction
    for i, page in enumerate(doc):
        if progress_callback:
            percent = 10 + int((i / total_pages) * 50)
            progress_callback(percent, f"Scanning Page {i+1}/{total_pages} ({source_type})...")
        p_words = get_words(page, source_type)
        clean_words = remove_ghost_text(p_words)
        all_pages_words.append(clean_words)

    # 2. Grid Discovery
    if progress_callback: progress_callback(65, "Aligning Global Grid...")
    flat_words = [w for p in all_pages_words for w in p]
    master_columns = discover_global_columns(flat_words)

    # 3. Mapping
    if progress_callback: progress_callback(75, "Mapping Data...")
    all_rows = []
    for clean_words in all_pages_words:
        page_grid = map_to_master_grid(clean_words, master_columns)
        all_rows.extend(page_grid)
        all_rows.append({}) 

    # 4. DataFrame
    df = pd.DataFrame(all_rows)
    for i in range(len(master_columns)):
        col_name = f"Col_{i}"
        if col_name not in df.columns: df[col_name] = ""
            
    cols = sorted(list(df.columns), key=lambda x: int(x.split('_')[1]) if '_' in x else 999)
    df = df[cols].fillna("")

    # 5. Save Excel
    if progress_callback: progress_callback(85, "Generating Excel Report...")
    excel_path = save_formatted_excel(df, file_path)
    
    # 6. Analysis (FIXED)
    if progress_callback: progress_callback(90, "Analyzing Performance...")
    analytics = perform_semantic_analysis(df)
    
    return df, excel_path, analytics

# --- FIXED SEMANTIC ANALYSIS ---
def perform_semantic_analysis(df):
    """
    Robustly extracts Seat Nos and Marks even if mixed with text.
    """
    students = []
    subject_stats = {} 

    # Regex Compilations
    seat_label_pat = re.compile(r"Seat\s*N[o0][:.\-\s]*(\d{5,6})", re.IGNORECASE)
    sgpa_label_pat = re.compile(r"SGPA[:\s]*(\d+\.\d+)", re.IGNORECASE)
    strict_digit_pat = re.compile(r"^\d{1,3}$") # Marks 0-999

    for idx, row in df.iterrows():
        # Scan row for Seat Number
        seat_no = None
        sgpa = 0.0
        
        # Convert row to string to search for labels
        row_str = " ".join([str(v) for v in row.values])
        
        # 1. Try finding "Seat No: 12345" label
        m_seat = seat_label_pat.search(row_str)
        if m_seat:
            seat_no = m_seat.group(1)
        else:
            # 2. Fallback: Look for standalone 5-digit number in first few columns
            for val in row.values[:5]:
                s_val = str(val).strip()
                if s_val.isdigit() and len(s_val) == 5:
                    seat_no = s_val
                    break
        
        if not seat_no: continue # Skip row if no seat found

        # 3. Find SGPA
        m_sgpa = sgpa_label_pat.search(row_str)
        if m_sgpa:
            try: sgpa = float(m_sgpa.group(1))
            except: pass
        
        # 4. Extract Subjects / Marks
        student_subjects = []
        for col in df.columns:
            val = str(row[col]).strip()
            # Skip the seat number itself
            if val == seat_no: continue
            
            # Check if value is a Mark or Grade
            is_mark = False
            
            # Is it a Grade?
            if val in ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F', 'Ab']:
                is_mark = True
            # Is it a Number (0-100)?
            elif strict_digit_pat.match(val):
                if int(val) <= 100: is_mark = True
                
            if is_mark:
                # Add to record
                student_subjects.append({'col': col, 'val': val})
                
                # Stats
                if col not in subject_stats: 
                    subject_stats[col] = {'pass':0, 'fail':0, 'scores':[]}
                
                if val in ['F', 'Ab'] or (val.isdigit() and int(val) < 40): # Assuming <40 is fail roughly
                    subject_stats[col]['fail'] += 1
                else:
                    subject_stats[col]['pass'] += 1
                    if val.isdigit(): subject_stats[col]['scores'].append(int(val))

        students.append({
            'seat_no': seat_no,
            'sgpa': sgpa,
            'subjects': student_subjects
        })

    # Rank List
    students.sort(key=lambda x: x['sgpa'], reverse=True)
    rank_list = [{"rank": i+1, "seat_no": s['seat_no'], "sgpa": s['sgpa']} for i, s in enumerate(students[:20])]

    # Chart Data
    chart_data = []
    for col, stats in subject_stats.items():
        total = stats['pass'] + stats['fail']
        if total > 5: # Ignore noise columns
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
        'average_sgpa': round(sum(s['sgpa'] for s in students)/len(students), 2) if students else 0,
        'overall_rank_list': rank_list,
        'subject_performance': chart_data,
        'students_full': students
    }

# --- UNCHANGED HELPERS (V10) ---
def get_words(page, source_type):
    words = []
    if source_type == "DIGITAL":
        raw = page.get_text("words")
        for w in raw:
            words.append({'x': (w[0] + w[2]) / 2, 'y': (w[1] + w[3]) / 2, 'text': w[4]})
    else:
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
        df = df.fillna("")
        
        with pd.ExcelWriter(path, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, header=False, sheet_name='Result_Data')
            workbook = writer.book
            worksheet = writer.sheets['Result_Data']
            fmt_text = workbook.add_format({'text_wrap': True, 'valign': 'top'})
            fmt_fail = workbook.add_format({'text_wrap': True, 'font_color': '#9C0006', 'bg_color': '#FFC7CE'})
            fmt_pass = workbook.add_format({'text_wrap': True, 'font_color': '#006100', 'bg_color': '#C6EFCE'})
            
            for idx, col in enumerate(df.columns):
                max_len = 0
                for r_idx, val in enumerate(df[col]):
                    val_str = str(val)
                    if len(val_str) > max_len: max_len = len(val_str)
                    if val_str == 'F': worksheet.write(r_idx, idx, val, fmt_fail)
                    elif val_str in ['A+', 'O']: worksheet.write(r_idx, idx, val, fmt_pass)
                    else: worksheet.write(r_idx, idx, val, fmt_text)
                width = min(max(max_len + 2, 10), 60)
                worksheet.set_column(idx, idx, width)
            worksheet.freeze_panes(0, 1)
        return os.path.join('docusense_reports', excel_name)
    except Exception as e:
        print(f"Excel Error: {e}")
        return None