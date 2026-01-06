# backend/docusense/services.py
import threading
import pandas as pd
from .models import AcademicDocument
from .local_vision import extract_data_using_visual_layout, save_clean_excel

def process_document(doc_id):
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        doc.status = 'PROCESSING'
        doc.save()
        
        print(f"--- [DocuSense] Processing: {doc.filename} ---")
        
        df = pd.DataFrame()

        if doc.file.path.endswith('.pdf'):
            df = extract_data_using_visual_layout(doc.file.path)
        else:
            print("--- [Info] Please upload PDF. ---")
            doc.analysis_data = {"error": "PDF required for visual layout parsing."}
            doc.status = 'FAILED'
            doc.save()
            return

        if not df.empty:
            excel_path = save_clean_excel(df, doc.filename)
            
            df['SGPA'] = pd.to_numeric(df['SGPA'], errors='coerce').fillna(0)
            avg_sgpa = df.drop_duplicates('Seat No')['SGPA'].mean()

            doc.analysis_data = {
                "doc_type": "RESULT",
                "excel_path": excel_path,
                "summary": "Visual Report Generated.",
                "batch_stats": {
                    "total_students": df['Seat No'].nunique(),
                    "average_sgpa": round(avg_sgpa, 2)
                },
                "overall_rank_list": [] 
            }
            doc.status = 'COMPLETED'
        else:
            doc.analysis_data = {"error": "Parser returned 0 rows."}
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