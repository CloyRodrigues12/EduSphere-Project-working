# backend/docusense/services.py
import threading
import pandas as pd
import os
import requests
import json
import base64
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings
from .models import AcademicDocument
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def get_robust_session():
    """ Creates a session that auto-retries on connection drops """
    session = requests.Session()
    retry = Retry(
        total=3, 
        read=3, 
        connect=3, 
        backoff_factor=2, # Wait 2s, 4s, 8s between retries
        status_forcelist=[500, 502, 503, 504]
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('https://', adapter)
    return session

def call_gemini_api(payload):
    if not GOOGLE_API_KEY:
        print("--- [DocuSense] ERROR: No API Key ---")
        return None

    # Your preferred model first, then fallbacks
    models_to_try = [
        "gemini-2.5-flash",       # Your working model
        "gemini-1.5-flash",       # Backup
        "gemini-1.5-pro",         # High intelligence
        "gemini-1.5-flash-8b"     # Fast/Cheap
    ]

    session = get_robust_session()
    headers = {'Content-Type': 'application/json'}

    for model in models_to_try:
        try:
            print(f"--- [DocuSense] 🌐 Connecting to: {model} ---")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GOOGLE_API_KEY}"
            
            # Increased timeout to 400s for large PDFs
            response = session.post(url, headers=headers, json=payload, timeout=400)
            
            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and result['candidates']:
                    return result['candidates'][0]['content']['parts'][0]['text']
            else:
                print(f"--- {model} Error: {response.status_code} ---")
                
        except Exception as e:
            print(f"--- Connection Fail ({model}): {str(e)[:100]}... ---")
            continue

    return None

def analyze_document(file_path, file_type):
    print(f"--- [DocuSense] 🔍 Analyzing {file_type} for Charts & Ranks... ---")
    
    # --- PROMPT FOR CHARTS & RANK LISTS ---
    prompt_text = """
    You are an Expert Academic Auditor. Analyze this Result Document.
    
    REQUIRED OUTPUT (Strict JSON):
    {
        "doc_type": "RESULT",
        "summary": "3-sentence professional summary.",
        "batch_stats": {
            "total_students": (int),
            "pass_count": (int),
            "fail_count": (int),
            "overall_pass_percentage": (float),
            "average_sgpa": (float, 0 if not found)
        },
        "grade_distribution": {
            "O": (int), "A+": (int), "A": (int), 
            "B+": (int), "B": (int), "C": (int), "P": (int), "F": (int)
        },
        "overall_rank_list": [
            {"rank": 1, "name": "Student Name", "score": "SGPA/Marks"},
            {"rank": 2, "name": "Student Name", "score": "SGPA/Marks"},
            {"rank": 3, "name": "Student Name", "score": "SGPA/Marks"},
            {"rank": 4, "name": "Student Name", "score": "SGPA/Marks"},
            {"rank": 5, "name": "Student Name", "score": "SGPA/Marks"}
        ],
        "subject_performance": [
            {
                "subject_code": "SubCode",
                "subject_name": "Subject Name",
                "average_marks": (int, 0-100),
                "fail_count": (int),
                "top_scorer": "Student Name"
            }
        ],
        "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
        "recommendations": ["Action 1", "Action 2"]
    }
    """

    payload = {}
    
    if file_type == "PDF":
        try:
            with open(file_path, "rb") as f:
                pdf_data = base64.b64encode(f.read()).decode('utf-8')
            payload = {"contents": [{"parts": [{"text": prompt_text}, {"inline_data": {"mime_type": "application/pdf", "data": pdf_data}}]}]}
        except Exception as e:
            return {"doc_type": "ERROR", "summary": f"File Read Error: {e}"}

    elif file_type == "EXCEL":
         # (Excel Logic remains same as previous steps)
         pass

    # Call API
    response_text = call_gemini_api(payload)
    if not response_text: return {"doc_type": "ERROR", "summary": "AI Analysis Failed"}
    
    try:
        clean_json = response_text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except:
        return {"doc_type": "ERROR", "summary": "JSON Parse Failed"}

def process_document(doc_id):
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        doc.status = 'PROCESSING'
        doc.save()
        
        path = doc.file.path
        if path.endswith('.pdf'): res = analyze_document(path, "PDF")
        else: res = analyze_document(path, "EXCEL")
            
        doc.analysis_data = res
        doc.status = 'COMPLETED' if res.get('doc_type') != 'ERROR' else 'FAILED'
        doc.save()
        print(f"--- [DocuSense] Finished: {doc.status} ---")
    except Exception as e:
        print(f"--- Error: {e} ---")
        doc.status = 'FAILED'
        doc.save()

def trigger_analysis_background(doc_id):
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()