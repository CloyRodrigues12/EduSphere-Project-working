import threading
import pandas as pd
import os
import re
from .models import AcademicDocument
from .local_vision import extract_data_smart_parser

def process_document(doc_id):
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        doc.status = 'PROCESSING'
        doc.save()
        
        print(f"--- [DocuSense] Processing: {doc.filename} ---")
        
        # 1. Run V10 Global Grid Parser
        df = extract_data_smart_parser(doc.file.path)

        if not df.empty:
            # 2. Post-Process Grid to find Stats (SGPA/Rank)
            # We look for a cell containing "SGPA" and grab numbers near it
            stats = extract_smart_stats(df)
            
            # 3. DB Update
            excel_name = f"{os.path.splitext(doc.filename)[0]}_REPLICA.xlsx"
            excel_rel_path = os.path.join('docusense_reports', excel_name)
            
            doc.analysis_data = {
                "doc_type": "VISUAL_GRID",
                "excel_path": excel_rel_path,
                "summary": "Analysis Complete. Data mapped to Global Grid.",
                "batch_stats": {
                    "total_students": stats['student_count'],
                    "average_sgpa": stats['avg_sgpa']
                },
                "overall_rank_list": stats['top_rankers']
            }
            doc.status = 'COMPLETED'
        else:
            doc.analysis_data = {"error": "Extraction failed."}
            doc.status = 'FAILED'
            
        doc.save()

    except Exception as e:
        print(f"--- [DocuSense] Error: {e} ---")
        doc.analysis_data = {"error": str(e)}
        doc.status = 'FAILED'
        doc.save()

def extract_smart_stats(df):
    """
    Heuristic Scanner:
    Scans the visual grid DataFrame to find SGPA and Seat Nos.
    """
    sgpas = []
    students = []
    
    # Regex Patterns
    sgpa_pat = re.compile(r"SGPA[:\s]*(\d+\.\d+)", re.IGNORECASE)
    seat_pat = re.compile(r"Seat\s*N[o0][:\.\s-]*(\d+)", re.IGNORECASE)
    
    # Convert whole DF to string for searching
    # (Iterating rows is safer than to_string() for large files)
    
    for idx, row in df.iterrows():
        row_text = " ".join([str(x) for x in row.values if x])
        
        # Search for Seat No (Student Count)
        if seat_pat.search(row_text):
            students.append(1)
            
        # Search for SGPA values (Average & Rank)
        # Check cell by cell for accuracy
        for cell in row.values:
            cell_str = str(cell)
            match = sgpa_pat.search(cell_str)
            if match:
                try:
                    val = float(match.group(1))
                    if 0 < val <= 10.0:
                        # Find name in previous rows? Too complex for heuristic.
                        # Just save score for stats.
                        sgpas.append(val)
                except: pass
            # Sometimes SGPA is just a number in a specific column "8.5"
            # If we had column headers we could do this, but in visual grid we stick to regex labels.

    avg = 0.0
    if sgpas: avg = round(sum(sgpas) / len(sgpas), 2)
    
    # Top 5 Ranks (Scores only)
    sgpas.sort(reverse=True)
    top_5 = [{"rank": i+1, "sgpa": s, "name": "Student"} for i, s in enumerate(sgpas[:5])]
    
    return {
        "student_count": len(students),
        "avg_sgpa": avg,
        "top_rankers": top_5
    }

def trigger_analysis_background(doc_id):
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()