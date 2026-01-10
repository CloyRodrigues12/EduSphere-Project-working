import threading
import time
import os
from .models import AcademicDocument
from .local_vision import extract_data_smart_parser

def process_document(doc_id):
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        doc.status = 'PROCESSING'
        
        # Init Progress Meta
        file_size_mb = doc.file.size / (1024 * 1024)
        doc.analysis_data = {
            "progress": 0,
            "current_log": "Initializing Analysis...",
            "meta": {"size_mb": round(file_size_mb, 2)},
            "eta": "Calculating..."
        }
        doc.save()
        
        start_time = time.time()
        
        # Live Callback
        def update_progress(percent, message):
            try:
                elapsed = time.time() - start_time
                eta_seconds = (elapsed / (percent / 100)) - elapsed if percent > 0 else 0
                eta_str = f"{int(eta_seconds)}s remaining" if percent > 5 else "Calculating..."
                
                # Refresh from DB to avoid overwrites
                doc.refresh_from_db()
                current_data = doc.analysis_data or {}
                current_data.update({
                    "progress": percent,
                    "current_log": message,
                    "eta": eta_str
                })
                doc.analysis_data = current_data
                doc.save(update_fields=['analysis_data'])
            except: pass

        print(f"--- [DocuSense] Processing: {doc.filename} ---")
        
        # EXECUTE PARSER
        df, excel_path, analytics = extract_data_smart_parser(doc.file.path, update_progress)

        if not df.empty:
            update_progress(100, "Finalizing Report...")
            doc.refresh_from_db()
            doc.analysis_data.update({
                "progress": 100,
                "current_log": "Completed.",
                "doc_type": "VISUAL_GRID",
                "excel_path": excel_path,
                "summary": "Analysis Successful.",
                "batch_stats": {
                    "total_students": analytics['total_students'],
                    "average_sgpa": analytics['average_sgpa']
                },
                "overall_rank_list": analytics['overall_rank_list'],
                "subject_analytics": analytics['subject_performance'],
                "full_data": analytics['students_full']
            })
            doc.status = 'COMPLETED'
        else:
            doc.analysis_data = {"error": "Extraction failed (Empty Data)."}
            doc.status = 'FAILED'
            
        doc.save()

    except Exception as e:
        print(f"--- [DocuSense] Error: {e} ---")
        doc.status = 'FAILED'
        doc.analysis_data = {"error": str(e)}
        doc.save()

def trigger_analysis_background(doc_id):
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()