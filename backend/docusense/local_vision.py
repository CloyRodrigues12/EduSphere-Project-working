import fitz  # PyMuPDF
import pandas as pd
import numpy as np
import os
import re
import json
import easyocr
from collections import Counter
from django.conf import settings

print("--- [System] Initializing V23 Master Excel Engine... ---")
ocr_reader = easyocr.Reader(['en'], gpu=True)

def extract_data_smart_parser(file_path, progress_callback=None):
    filename = os.path.basename(file_path)
    if progress_callback: progress_callback(5, "Initializing Vision...")
    
    doc = fitz.open(file_path)
    total_pages = len(doc)
    page1_text = doc[0].get_text()
    source_type = "DIGITAL" if len(page1_text.strip()) > 50 else "OCR"
    
    all_pages_words = []
    
    # 1. Extraction
    for i, page in enumerate(doc):
        if progress_callback:
            percent = 10 + int((i / total_pages) * 40)
            progress_callback(percent, f"Scanning Page {i+1}/{total_pages} ({source_type})...")
        p_words = get_words(page, source_type)
        p_words = remove_ghost_text(p_words)
        all_pages_words.append(p_words)

    # 2. Grid Alignment
    if progress_callback: progress_callback(55, "Aligning Grid...")
    flat_words = [w for p in all_pages_words for w in p]
    master_columns = discover_global_columns(flat_words)

    # 3. Mapping
    if progress_callback: progress_callback(65, "Mapping Data...")
    all_rows = []
    for p_words in all_pages_words:
        lines = cluster_words_into_lines(p_words)
        for line in lines:
            row_data = map_line_to_columns(line, master_columns)
            all_rows.append(row_data)
        all_rows.append({}) 

    # 4. Raw Grid DataFrame
    df_grid = pd.DataFrame(all_rows)
    for i in range(len(master_columns)):
        col_name = f"Col_{i}"
        if col_name not in df_grid.columns: df_grid[col_name] = ""
    cols = sorted(list(df_grid.columns), key=lambda x: int(x.split('_')[1]) if '_' in x else 999)
    df_grid = df_grid[cols].fillna("")

    # 5. Semantic Analysis (Extracts Name, Seat, SGPA, Subjects)
    if progress_callback: progress_callback(80, "Analyzing & Structuring Data...")
    analytics = perform_semantic_analysis(df_grid)

    # 6. Generate Master Excel
    if progress_callback: progress_callback(90, "Generating Master Report...")
    excel_path = save_master_excel(analytics['students_full'], file_path)
    
    return df_grid, excel_path, analytics

def perform_semantic_analysis(df):
    students = []
    current_student = None
    subject_stats = {} 

    # Regex
    seat_label_pat = re.compile(r"Seat\s*N[o0][:.\-\s]*(\d{5,6})", re.IGNORECASE)
    # Name pattern: Look for "Name:" followed by uppercase words
    name_label_pat = re.compile(r"Name[:\s]*([A-Z\s.]+)", re.IGNORECASE)
    sgpa_label_pat = re.compile(r"SGPA[:\s]*(\d+\.\d+)", re.IGNORECASE)
    mark_clean_pat = re.compile(r"(\d{1,3})") 

    for idx, row in df.iterrows():
        row_values = [str(v).strip() for v in row.values if str(v).strip()]
        row_str = " ".join(row_values)
        
        # 1. DETECT NEW STUDENT
        seat_match = seat_label_pat.search(row_str)
        new_seat_no = None
        new_name = "Unknown"
        
        if seat_match:
            new_seat_no = seat_match.group(1)
            # Try to extract Name from the same line
            name_match = name_label_pat.search(row_str)
            if name_match:
                new_name = name_match.group(1).strip()
            else:
                # Heuristic: Text after seat no might be name
                # E.g. "Seat No: 12345 Name: JOHN DOE"
                parts = row_str.split("Name")
                if len(parts) > 1:
                    new_name = parts[1].split("PR")[0].strip().strip(":").strip() # Cleanup
        
        # Fallback for Ledger (Seat No is first digit)
        elif row_values and row_values[0].isdigit() and len(row_values[0]) >= 5:
             if not current_student:
                 new_seat_no = row_values[0]
                 if len(row_values) > 1:
                     new_name = row_values[1] # Name is usually next to seat no

        if new_seat_no:
            if current_student: students.append(current_student)
            current_student = {
                'seat_no': new_seat_no, 
                'name': new_name,
                'sgpa': 0.0, 
                'subjects': []
            }

        if not current_student: continue

        # 2. CAPTURE SGPA
        sgpa_match = sgpa_label_pat.search(row_str)
        if sgpa_match:
            try: current_student['sgpa'] = float(sgpa_match.group(1))
            except: pass
        elif current_student['sgpa'] == 0.0:
            for v in row_values:
                if re.match(r"^[0-9]\.\d{2}$", v):
                    try: current_student['sgpa'] = float(v)
                    except: pass

        # 3. CAPTURE MARKS
        potential_sub_name = "Unknown Subject"
        longest_text = ""
        for v in row_values:
            if len(v) > 3 and not re.search(r"\d", v) and "Seat" not in v and "SGPA" not in v:
                if len(v) > len(longest_text): longest_text = v
        if longest_text: potential_sub_name = longest_text

        for col_name in df.columns:
            raw_val = str(row[col_name]).strip()
            if not raw_val or raw_val == current_student['seat_no']: continue
            
            clean_val = raw_val.replace(" P", "").replace(" F", "").replace("#", "").replace("*", "").strip()
            is_valid_mark = False
            mark_value = 0
            
            if raw_val in ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F', 'Ab']:
                is_valid_mark = True
            elif clean_val.isdigit():
                m = int(clean_val)
                if m <= 150:
                    is_valid_mark = True
                    mark_value = m

            if is_valid_mark:
                sub_key = potential_sub_name if potential_sub_name != "Unknown Subject" else f"Col_{col_name}"
                
                exists = False
                for s in current_student['subjects']:
                    if s['col'] == col_name and s['val'] == raw_val: exists = True
                
                if not exists:
                    current_student['subjects'].append({
                        'col': col_name,
                        'name': sub_key,
                        'val': raw_val
                    })
                    
                    if sub_key not in subject_stats:
                        subject_stats[sub_key] = {'pass':0, 'fail':0, 'scores':[]}
                    
                    if raw_val in ['F', 'Ab'] or (mark_value > 0 and mark_value < 35):
                        subject_stats[sub_key]['fail'] += 1
                    else:
                        subject_stats[sub_key]['pass'] += 1
                        if mark_value > 0: subject_stats[sub_key]['scores'].append(mark_value)

    if current_student: students.append(current_student)

    students.sort(key=lambda x: x['sgpa'], reverse=True)
    rank_list = [{"rank": i+1, "seat_no": s['seat_no'], "name": s['name'], "sgpa": s['sgpa']} for i, s in enumerate(students[:50])]

    chart_data = []
    for sub_name, stats in subject_stats.items():
        if stats['pass'] + stats['fail'] > 5:
            avg = sum(stats['scores'])/len(stats['scores']) if stats['scores'] else 0
            chart_data.append({
                'subject_id': sub_name,
                'pass': stats['pass'],
                'fail': stats['fail'],
                'avg': round(avg, 2),
                'top_score': max(stats['scores']) if stats['scores'] else 0
            })

    avg_sgpa = 0
    valid_sgpa = [s['sgpa'] for s in students if s['sgpa'] > 0]
    if valid_sgpa: avg_sgpa = round(sum(valid_sgpa)/len(valid_sgpa), 2)

    return {
        'total_students': len(students),
        'average_sgpa': avg_sgpa,
        'overall_rank_list': rank_list,
        'subject_performance': chart_data,
        'students_full': students
    }

def save_master_excel(students_data, original_filepath):
    """
    Creates a clean, structured Excel:
    | Seat No | Name | SGPA | Subject 1 | Subject 2 | ... |
    """
    try:
        filename = os.path.basename(original_filepath)
        safe_name = os.path.splitext(filename)[0]
        excel_name = f"{safe_name}_MASTER.xlsx"
        path = os.path.join(settings.MEDIA_ROOT, 'docusense_reports', excel_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # 1. Collect all unique subject names
        all_subjects = set()
        for s in students_data:
            for sub in s['subjects']:
                all_subjects.add(sub['name'])
        
        sorted_subjects = sorted(list(all_subjects))
        
        # 2. Build rows
        excel_rows = []
        for s in students_data:
            row = {
                "Seat Number": s['seat_no'],
                "Student Name": s['name'],
                "SGPA": s['sgpa']
            }
            # Fill subjects
            for sub in s['subjects']:
                row[sub['name']] = sub['val']
            excel_rows.append(row)
            
        df = pd.DataFrame(excel_rows)
        
        # Ensure columns order
        cols = ["Seat Number", "Student Name", "SGPA"] + sorted_subjects
        # Add missing columns if any (pandas does this but good to be explicit)
        for c in cols:
            if c not in df.columns: df[c] = ""
        df = df[cols]

        print(f"--- [Excel Writer] Saving Master Report to: {path} ---")
        
        with pd.ExcelWriter(path, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Master_Data')
            worksheet = writer.sheets['Master_Data']
            
            # Styling
            header_fmt = writer.book.add_format({'bold': True, 'bg_color': '#DCE6F1', 'border': 1})
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_fmt)
                worksheet.set_column(col_num, col_num, 15)
                
            worksheet.set_column(1, 1, 25) # Wider Name column
            worksheet.freeze_panes(1, 2) # Freeze Name & Seat
            
        return os.path.join('docusense_reports', excel_name)
        
    except Exception as e:
        print(f"Master Excel Error: {e}")
        return None

# --- HELPERS (Unchanged) ---
def get_words(page, source_type):
    words = []
    if source_type == "DIGITAL":
        raw = page.get_text("words")
        for w in raw:
            words.append({'x': (w[0]+w[2])/2, 'y': (w[1]+w[3])/2, 'text': w[4], 'x0': w[0], 'x1': w[2], 'y0': w[1], 'y1': w[3]})
    else:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_bytes = pix.tobytes("png")
        results = ocr_reader.readtext(img_bytes, detail=1, paragraph=False)
        for (bbox, text, conf) in results:
            if conf < 0.3: continue
            x0, y0 = bbox[0][0]/2, bbox[0][1]/2
            x1, y1 = bbox[2][0]/2, bbox[2][1]/2
            words.append({'x': (x0+x1)/2, 'y': (y0+y1)/2, 'text': text, 'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1})
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
    threshold = len(all_words) * 0.002
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

def cluster_words_into_lines(words):
    if not words: return []
    words.sort(key=lambda w: w['y0'])
    lines = []
    current_line = [words[0]]
    for w in words[1:]:
        ref = current_line[-1]
        overlap = min(ref['y1'], w['y1']) - max(ref['y0'], w['y0'])
        if overlap > (ref['y1']-ref['y0']) * 0.4:
            current_line.append(w)
        else:
            lines.append(current_line)
            current_line = [w]
    lines.append(current_line)
    return lines

def map_line_to_columns(line_words, columns):
    row_data = {}
    line_words.sort(key=lambda w: w['x0'])
    for w in line_words:
        distances = [abs(w['x'] - col_x) for col_x in columns]
        if not distances: continue
        nearest_idx = distances.index(min(distances))
        col_key = f"Col_{nearest_idx}"
        if col_key in row_data: row_data[col_key] += " " + w['text']
        else: row_data[col_key] = w['text']
    return row_data

def save_formatted_excel(df, original_filepath):
    # (Kept for compatibility, but Master Excel is superior)
    try:
        filename = os.path.basename(original_filepath)
        safe_name = os.path.splitext(filename)[0]
        excel_name = f"{safe_name}_REPLICA.xlsx"
        path = os.path.join(settings.MEDIA_ROOT, 'docusense_reports', excel_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with pd.ExcelWriter(path, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, header=False, sheet_name='Result_Data')
        return os.path.join('docusense_reports', excel_name)
    except: return None