# backend/docusense/local_parser.py
import pdfplumber
import pandas as pd
import re
import csv
import os
from django.conf import settings

def parse_hidden_csv_pdf(file_path):
    """
    100% Deterministic Parser for Goa University Results.
    Extracts the 'Hidden CSV' layer directly from the PDF text stream.
    """
    print(f"--- [Local Engine] Opening: {file_path} ---")
    
    # 1. EXTRACT RAW TEXT
    # We read page-by-page to ensure we don't miss anything
    full_text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
    except Exception as e:
        print(f"--- [Error] PDF Read Failed: {e}")
        return pd.DataFrame()

    if len(full_text) < 100:
        print("--- [Error] PDF seems empty or image-based. ---")
        return pd.DataFrame()

    print(f"--- [Local Engine] Extracted {len(full_text)} chars. Normalizing... ---")

    # 2. NORMALIZE: Fix "Newlines inside Quotes"
    # The PDF has rows like: "ECS510\n", "Subject Name"
    # We strip newlines ONLY inside quotes to heal the CSV rows.
    def clean_quotes(match):
        return match.group(0).replace('\n', ' ').replace('\r', '')
    
    # Regex to find quoted strings
    normalized_text = re.sub(r'"([^"]*)"', clean_quotes, full_text)
    
    # 3. PARSE LINES
    lines = normalized_text.split('\n')
    
    extracted_data = []
    
    # State Variables
    current_seat = None
    current_name = None
    
    # Regex to find Student Header
    # Matches: "Seat No: 50362" ... "Name: ADITI..."
    # We stop matching Name at "Entitlement", "Paper", or newline to avoid garbage.
    header_regex = re.compile(r"Seat\s*No[:\.]?\s*(\d+).*?Name[:\.]?\s*([A-Z\s\.]+?)(?=\s+(?:Entitlement|Paper|PR|Earned|\n))", re.IGNORECASE)

    # Regex to find a Data Row (Starts with "Code")
    # Matches: "ECS510","Electronic...",...
    row_regex = re.compile(r'^"([^"]+)","([^"]+)"')

    for line in lines:
        clean = line.strip()
        if not clean: continue

        # A. Check for Student Header
        header_match = header_regex.search(clean)
        if header_match:
            current_seat = header_match.group(1)
            current_name = header_match.group(2).strip()
            # Safety: If name is too long or contains "Paper", truncate it
            if "Paper" in current_name:
                current_name = current_name.split("Paper")[0].strip()
            continue

        # B. Check for Data Row (Hidden CSV)
        # We look for lines starting with a quoted Subject Code
        if clean.startswith('"'):
            try:
                # Parse as CSV row
                reader = csv.reader([clean], skipinitialspace=True)
                row = next(reader)
                
                # VALIDATE: Must be a Subject Row
                # Condition: Col 0 is Alphanumeric Code, Col 2 is Credits (Digit)
                if row and len(row) >= 10:
                    # Based on your snippet:
                    # 0: Code ("ECS510")
                    # 1: Name ("Electronic...")
                    # ...
                    # 9: Grade (The 10th column index 9 is "B" in your snippet, wait... let's count)
                    # "Code","Name","Credits","Th","IA","Term","ThTot","Prac","Oral","Total","Grade"
                    # 0      1      2         3    4    5      6       7      8      9       10
                    
                    # Let's count carefully from your snippet:
                    # "ECS510","Name","4","50 P","13",,"63 P",,"63","B","6","24"
                    # 0: Code
                    # 1: Name
                    # 2: Credits
                    # 3: Theory
                    # 4: IA
                    # 5: Term (Empty)
                    # 6: ThTotal
                    # 7: Prac (Empty)
                    # 8: Oral (Empty)
                    # 9: Total ("63")
                    # 10: Grade ("B") <--- TARGET
                    # 11: GP ("6")    <--- TARGET
                    
                    if len(row) > 10:
                        sub_code = row[0]
                        sub_name = row[1]
                        
                        # Grade is at index 10 (or 9 if some empty cols are skipped by PDF)
                        # We scan the end of the list for the Grade letter
                        grade = row[10]
                        points = row[11] if len(row) > 11 else "0"
                        
                        # Sanity Check: If Grade looks like a number, we might be shifted
                        if grade.isdigit() or grade == "":
                             # Fallback search
                             for item in reversed(row):
                                 if item in ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F']:
                                     grade = item
                                     break
                        
                        if current_seat:
                            extracted_data.append({
                                "Seat No": current_seat,
                                "Student Name": current_name,
                                "Subject Code": sub_code,
                                "Subject Name": sub_name,
                                "Grade": grade,
                                "Points": points
                            })

            except Exception as e:
                # Skip malformed lines
                pass

    # Convert to DataFrame
    df = pd.DataFrame(extracted_data)
    
    # Cleanup Points (Remove quotes/spaces)
    if not df.empty and 'Points' in df.columns:
         df['Points'] = df['Points'].astype(str).str.replace('"', '').str.strip()

    return df

def save_to_excel(df, original_filename):
    if df.empty: return None
    safe_name = os.path.splitext(original_filename)[0]
    file_name = f"{safe_name}_EXTRACTED.xlsx"
    save_path = os.path.join(settings.MEDIA_ROOT, 'docusense_reports', file_name)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    df.to_excel(save_path, index=False)
    return os.path.join('docusense_reports', file_name)