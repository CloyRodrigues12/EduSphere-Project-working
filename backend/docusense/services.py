# backend/docusense/services.py
import threading
from .models import AcademicDocument

def process_document(doc_id):
    """
    This function will eventually run the Pandas/AI analysis.
    For now, it just simulates a delay.
    """
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        print(f"--- [DocuSense] Starting Analysis for: {doc.filename} ---")
        
        # Update status to PROCESSING
        doc.status = 'PROCESSING'
        doc.save()

        # TODO: Phase 2 - Add the actual AI Logic here
        import time
        time.sleep(2) 
        
        # Fake success for now
        doc.status = 'COMPLETED'
        doc.analysis_data = {
            "summary": "Analysis pending implementation...", 
            "stats": {"pass_rate": 0, "avg_marks": 0}
        }
        doc.save()
        print(f"--- [DocuSense] Finished: {doc.filename} ---")
        
    except AcademicDocument.DoesNotExist:
        print("Error: Document not found")

def trigger_analysis_background(doc_id):
    """
    Run the processing in a background thread so the API returns instantly.
    """
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()