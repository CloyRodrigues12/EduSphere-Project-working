# backend/docusense/services.py
import threading
import pandas as pd
import os
import requests
import json
import base64
import time  # <--- Added for timing logs
from django.conf import settings
from .models import AcademicDocument
from dotenv import load_dotenv

# Load API Key
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def call_gemini_api(payload):
    """
    Direct HTTP call to Google Gemini API with VERBOSE LOGGING.
    """
    if not GOOGLE_API_KEY:
        print("--- [DocuSense] ERROR: No API Key found in .env ---")
        return None

    # List of models to try
    models_to_try = [
        "gemini-2.5-flash",
        "gemini-1.5-flash", 
        "gemini-1.5-pro",
        "gemini-1.5-flash-latest"
    ]

    headers = {'Content-Type': 'application/json'}

    for model in models_to_try:
        try:
            print(f"--- [DocuSense] 🌐 Connecting to model: {model} ---")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GOOGLE_API_KEY}"
            
            print(f"--- [DocuSense] ⏳ Sending payload... (Timeout: 300s) ---")
            start_time = time.time()
            
            # 5 Minute Timeout
            response = requests.post(url, headers=headers, json=payload, timeout=300)
            
            elapsed = round(time.time() - start_time, 2)
            print(f"--- [DocuSense] 📥 Response received in {elapsed}s. Status: {response.status_code} ---")

            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and result['candidates']:
                    print(f"--- [DocuSense] ✅ AI Content Generated successfully! ---")
                    return result['candidates'][0]['content']['parts'][0]['text']
                else:
                    print(f"--- [DocuSense] ⚠️ Empty candidates. Full Response: {str(result)[:200]}... ---")
                    return None
            else:
                print(f"--- [DocuSense] ❌ Model {model} failed. Error: {response.text[:200]}... ---")
                
        except requests.exceptions.Timeout:
            print(f"--- [DocuSense] ⏰ TIMEOUT: Model {model} took too long (>300s) ---")
            continue
        except Exception as e:
            print(f"--- [DocuSense] 💥 Connection Error with {model}: {e} ---")
            continue

    print("--- [DocuSense] CRITICAL: All Gemini models failed. ---")
    return None

def analyze_document(file_path, file_type):
    """ Constructs the payload and handles file reading logs """
    print(f"--- [DocuSense] 🔍 Preparing analysis payload for {file_type}... ---")
    
    prompt_text = """
    You are an expert University Data Analyst. Analyze the attached academic document.
    
    YOUR JOB:
    1. Identify if it is a 'Result Sheet' (marks, grades) or a 'General Report'.
    2. Extract key insights, pass/fail counts (if visible), and determine the tone.
    3. Return ONLY a valid JSON string. No markdown formatting.

    JSON STRUCTURE:
    {
        "doc_type": "RESULT" or "REPORT",
        "summary": "Executive summary (max 3 sentences).",
        "tone": "Positive, Critical, Urgent, or Neutral",
        "risk_level": "Low, Medium, or High",
        "key_points": ["Point 1", "Point 2", "Point 3"],
        "action_items": ["Action 1", "Action 2"],
        "ai_stats": {
            "total_students_detected": (integer or 0),
            "pass_count": (integer or 0),
            "fail_count": (integer or 0),
            "pass_percentage": (float or 0),
            "top_performer": "Name (Score) or 'Unknown'",
            "hardest_subject": "Subject Name or 'None'"
        }
    }
    """

    payload = {}

    # --- STRATEGY A: PDF (Multimodal) ---
    if file_type == "PDF":
        try:
            print(f"--- [DocuSense] 📂 Reading PDF file: {file_path} ---")
            with open(file_path, "rb") as f:
                pdf_bytes = f.read()
                file_size_mb = len(pdf_bytes) / (1024 * 1024)
                print(f"--- [DocuSense] 📏 File Size: {file_size_mb:.2f} MB ---")
                
                if file_size_mb > 10:
                     print("--- [DocuSense] ⚠️ WARNING: Large file (>10MB). Upload may be slow. ---")

                pdf_data = base64.b64encode(pdf_bytes).decode('utf-8')
                print("--- [DocuSense] 🔑 Base64 encoding complete. ---")
                
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt_text},
                        {
                            "inline_data": {
                                "mime_type": "application/pdf",
                                "data": pdf_data
                            }
                        }
                    ]
                }]
            }
            print("--- [DocuSense] 📦 PDF Payload constructed. ---")

        except Exception as e:
            print(f"--- [DocuSense] ❌ PDF Read Error: {e} ---")
            return {"doc_type": "ERROR", "summary": f"File read error: {str(e)}", "ai_stats": {}}

    # --- STRATEGY B: Excel/CSV (Text Context) ---
    elif file_type == "EXCEL":
        try:
            print(f"--- [DocuSense] 📊 Reading Excel/CSV file... ---")
            ext = os.path.splitext(file_path)[1].lower()
            df = pd.read_csv(file_path) if ext == '.csv' else pd.read_excel(file_path)
            
            print(f"--- [DocuSense] 🔢 Data loaded. Rows: {df.shape[0]}, Columns: {df.shape[1]} ---")
            summary_str = df.describe(include='all').to_string()
            headers = list(df.columns)
            excel_context = f"Headers: {headers}\n\nData Summary:\n{summary_str}"
            
            full_prompt = prompt_text + "\n\nDOCUMENT DATA:\n" + excel_context[:30000]
            print("--- [DocuSense] 📦 Excel Payload constructed. ---")

            payload = {
                "contents": [{
                    "parts": [{"text": full_prompt}]
                }]
            }
        except Exception as e:
            print(f"--- [DocuSense] ❌ Excel Processing Error: {e} ---")
            return {"doc_type": "ERROR", "summary": f"Excel Error: {str(e)}", "ai_stats": {}}

    # --- CALL API ---
    try:
        print("--- [DocuSense] 🚀 Invoking Gemini API... ---")
        ai_response_text = call_gemini_api(payload)
        
        if not ai_response_text:
            print("--- [DocuSense] ❌ No response text received from API. ---")
            return {
                "summary": "AI Service Unavailable (Timeout or Key Issue).",
                "doc_type": "ERROR",
                "ai_stats": {}
            }

        print("--- [DocuSense] 🧹 Parsing and cleaning JSON response... ---")
        clean_json = ai_response_text.replace("```json", "").replace("```", "").strip()
        
        parsed_data = json.loads(clean_json)
        print("--- [DocuSense] ✨ JSON parsed successfully. Analysis Complete. ---")
        return parsed_data

    except Exception as e:
        print(f"--- [DocuSense] ❌ JSON Parse/API Error: {e} ---")
        return {
            "summary": "Failed to parse AI response.",
            "doc_type": "ERROR",
            "error_details": str(e),
            "ai_stats": {}
        }

def process_document(doc_id):
    """ Main Hub """
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        print(f"\n{'='*60}")
        print(f"--- [DocuSense] ▶️ START: Processing Document ID {doc_id} ---")
        print(f"--- [DocuSense] 📄 Filename: {doc.filename} ---")
        
        doc.status = 'PROCESSING'
        doc.save()

        file_path = doc.file.path
        if not os.path.exists(file_path): 
            print(f"--- [DocuSense] ❌ ERROR: File path not found: {file_path} ---")
            raise FileNotFoundError("File not found")
        
        ext = os.path.splitext(file_path)[1].lower()
        print(f"--- [DocuSense] 🏷️ Extension: {ext} ---")
        
        analysis_result = {}

        if ext == '.pdf':
            analysis_result = analyze_document(file_path, "PDF")
        elif ext in ['.xlsx', '.xls', '.csv']:
            analysis_result = analyze_document(file_path, "EXCEL")
        else:
            print(f"--- [DocuSense] ❌ Error: Unsupported format {ext} ---")
            analysis_result = {"doc_type": "ERROR", "summary": "Unsupported format", "ai_stats": {}}

        doc.analysis_data = analysis_result
        
        if analysis_result.get('doc_type') == 'ERROR':
            print("--- [DocuSense] 🔴 Marking status as FAILED ---")
            doc.status = 'FAILED'
        else:
            print("--- [DocuSense] 🟢 Marking status as COMPLETED ---")
            doc.status = 'COMPLETED'
            
        doc.save()
        print(f"--- [DocuSense] 🏁 DONE: Document {doc_id} processing finished. ---")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"--- [DocuSense] 💥 CRITICAL PROCESS ERROR: {e} ---")
        doc.status = 'FAILED'
        doc.analysis_data = {"error": str(e)}
        doc.save()

def trigger_analysis_background(doc_id):
    print(f"--- [DocuSense] 🧵 Triggering background thread for Doc ID {doc_id}... ---")
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()