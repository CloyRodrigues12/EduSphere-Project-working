# backend/docusense/services.py
import threading
import pandas as pd
from .models import AcademicDocument
from .local_vision import extract_text_from_images, parse_ocr_text, save_local_excel

def process_document(doc_id):
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        doc.status = 'PROCESSING'
        doc.save()
        
        print(f"--- [DocuSense] Starting Local OCR Pipeline for: {doc.filename} ---")
        
        # 1. RUN VISION ENGINE (OCR)
        # This will take time as it renders images
        raw_text = extract_text_from_images(doc.file.path)
        
        # 2. PARSE DATA (Regex)
        df = parse_ocr_text(raw_text)
        
        if not df.empty:
            # 3. SAVE EXCEL
            excel_path = save_local_excel(df, doc.filename)
            
            # 4. COMPUTE ANALYTICS
            # Convert points to numeric
            df['Points'] = pd.to_numeric(df['Points'], errors='coerce').fillna(0)
            
            # SGPA Calculation
            student_groups = df.groupby('Student Name')['Points'].mean()
            
            # Rank List
            ranks = student_groups.sort_values(ascending=False).head(5)
            rank_list = [{"rank": i+1, "name": n, "score": f"{s:.2f}"} for i, (n, s) in enumerate(ranks.items())]

            # Batch Stats
            passed = len(student_groups[student_groups > 0]) # Simple logic for now
            total = len(student_groups)

            doc.analysis_data = {
                "doc_type": "RESULT",
                "excel_path": excel_path,
                "summary": "Data extracted successfully using Local OCR models.",
                "batch_stats": {
                    "total_students": total,
                    "average_sgpa": round(student_groups.mean(), 2),
                    "pass_count": passed,
                    "fail_count": total - passed
                },
                "overall_rank_list": rank_list,
                "grade_distribution": {}, # Can populate later
                "subject_performance": []
            }
            doc.status = 'COMPLETED'
        else:
            doc.analysis_data = {"error": "OCR completed but no student data was mapped."}
            doc.status = 'FAILED'
            
        doc.save()
        print(f"--- [DocuSense] Finished: {doc.status} ---")

    except Exception as e:
        print(f"--- [DocuSense] Error: {e} ---")
        doc.status = 'FAILED'
        doc.save()

def trigger_analysis_background(doc_id):
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()