# backend/docusense/services.py
import threading
import pandas as pd
import os
import requests
import json
from pypdf import PdfReader
from django.conf import settings
from .models import AcademicDocument
from dotenv import load_dotenv

# Load API Key
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def extract_text_from_pdf(file_path):
    """ Extract text from PDF """
    try:
        reader = PdfReader(file_path)
        text = ""
        # Limit pages (first 10)
        for i, page in enumerate(reader.pages):
            if i > 10: break 
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"PDF Error: {e}")
        return ""

def call_gemini_api(prompt):
    """
    Direct HTTP call to Google Gemini API to bypass SDK issues.
    """
    if not GOOGLE_API_KEY:
        raise Exception("Google API Key not found in .env")

    # We try the reliable 'gemini-1.5-flash' model first
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GOOGLE_API_KEY}"
    
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        
        # Check if 1.5-flash failed (e.g., 404), try gemini-pro as backup
        if response.status_code != 200:
            print(f"Gemini 1.5-flash failed ({response.status_code}). Trying gemini-pro...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GOOGLE_API_KEY}"
            response = requests.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            print(f"API Error: {response.text}")
            return None

        # Parse Response
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
        
    except Exception as e:
        print(f"HTTP Request Error: {e}")
        return None

def analyze_with_gemini(text, file_type="PDF"):
    """ Generates the Prompt and parses the JSON response """
    
    # Construct the Prompt
    prompt = f"""
    You are an expert University Data Analyst. Analyze the following document text (extracted from {file_type}).
    
    YOUR JOB:
    1. Identify if it is a 'Result Sheet' (marks, grades) or a 'General Report'.
    2. Extract key insights, pass/fail counts (if visible), and determining the tone.
    3. Return ONLY a valid JSON string. No markdown formatting.

    JSON STRUCTURE:
    {{
        "doc_type": "RESULT" or "REPORT",
        "summary": "Executive summary (max 3 sentences).",
        "tone": "Positive, Critical, Urgent, or Neutral",
        "risk_level": "Low, Medium, or High",
        "key_points": ["Point 1", "Point 2", "Point 3"],
        "action_items": ["Action 1", "Action 2"],
        "ai_stats": {{
            "total_students_detected": (integer or 0),
            "pass_count": (integer or 0),
            "fail_count": (integer or 0),
            "pass_percentage": (float or 0),
            "top_performer": "Name (Score) or 'Unknown'",
            "hardest_subject": "Subject Name or 'None'"
        }}
    }}

    DOCUMENT TEXT (Truncated):
    {text[:25000]}
    """

    try:
        # Get raw string from Gemini
        ai_response_text = call_gemini_api(prompt)
        
        if not ai_response_text:
            return {"summary": "AI Service Unavailable", "doc_type": "ERROR"}

        # Clean Markdown artifacts (Gemini likes to wrap JSON in ```json ... ```)
        clean_json = ai_response_text.replace("```json", "").replace("```", "").strip()
        
        return json.loads(clean_json)

    except Exception as e:
        print(f"JSON Parse Error: {e}")
        return {
            "summary": "Failed to parse AI response.",
            "doc_type": "ERROR",
            "error_details": str(e)
        }

def process_document(doc_id):
    """ Main Hub """
    try:
        doc = AcademicDocument.objects.get(id=doc_id)
        print(f"--- [DocuSense] Analyzing: {doc.filename} ---")
        doc.status = 'PROCESSING'
        doc.save()

        file_path = doc.file.path
        if not os.path.exists(file_path): raise FileNotFoundError("File not found")
        ext = os.path.splitext(file_path)[1].lower()
        
        analysis_result = {}

        # 1. PDF -> Gemini
        if ext == '.pdf':
            text = extract_text_from_pdf(file_path)
            if not text: raise Exception("Empty PDF")
            analysis_result = analyze_with_gemini(text, "PDF")

        # 2. Excel -> Gemini
        elif ext in ['.xlsx', '.xls', '.csv']:
            df = pd.read_csv(file_path) if ext == '.csv' else pd.read_excel(file_path)
            # Create summary for AI
            summary_str = df.describe(include='all').to_string()
            excel_context = f"Headers: {list(df.columns)}\nData:\n{summary_str}"
            analysis_result = analyze_with_gemini(excel_context, "EXCEL")
            
        else:
            raise Exception("Unsupported format")

        doc.analysis_data = analysis_result
        doc.status = 'COMPLETED'
        doc.save()
        print(f"--- [DocuSense] Success ---")

    except Exception as e:
        print(f"--- [DocuSense] Error: {e} ---")
        doc.status = 'FAILED'
        doc.analysis_data = {"error": str(e)}
        doc.save()

def trigger_analysis_background(doc_id):
    thread = threading.Thread(target=process_document, args=(doc_id,))
    thread.start()