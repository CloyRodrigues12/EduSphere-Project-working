# backend/docusense/generators.py
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart

def draw_grade_pie_chart(data):
    """ Draws a Pie Chart for Grade Distribution """
    d = Drawing(400, 200)
    pc = Pie()
    pc.x = 100; pc.y = 25; pc.width = 150; pc.height = 150
    
    # Filter zeros
    filtered = {k: v for k, v in data.items() if v > 0}
    if not filtered: return d
    
    pc.data = list(filtered.values())
    pc.labels = list(filtered.keys())
    d.add(pc)
    return d

def draw_subject_bar_chart(subjects):
    """ Draws a Bar Chart for Subject Averages """
    d = Drawing(400, 200)
    if not subjects: return d

    data = [s.get('average_marks', 0) for s in subjects]
    names = [s.get('subject_code', '?') for s in subjects]

    bc = VerticalBarChart()
    bc.x = 50; bc.y = 50; bc.height = 125; bc.width = 300
    bc.data = [data]
    bc.valueAxis.valueMin = 0
    bc.valueAxis.valueMax = 100
    bc.categoryAxis.categoryNames = names
    d.add(bc)
    return d

def generate_pdf_report(doc):
    buffer = io.BytesIO()
    doc_template = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    story = []
    styles = getSampleStyleSheet()
    
    data = doc.analysis_data
    stats = data.get('batch_stats', {})

    # --- TITLE ---
    story.append(Paragraph("DocuSense Intelligence Report", styles['Heading1']))
    story.append(Paragraph(f"<b>File:</b> {doc.filename}", styles['Normal']))
    story.append(Spacer(1, 20))

    # --- 1. OVERVIEW ---
    story.append(Paragraph("1. Performance Snapshot", styles['Heading2']))
    overview_data = [
        ["Total Students", stats.get('total_students', '-')],
        ["Pass Rate", f"{stats.get('overall_pass_percentage', 0)}%"],
        ["Avg SGPA", stats.get('average_sgpa', '-')],
        ["Failures", stats.get('fail_count', '-')]
    ]
    t = Table(overview_data, colWidths=[200, 100])
    t.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 1, colors.black), ('BACKGROUND', (0,0), (0,-1), colors.lightgrey)]))
    story.append(t)
    story.append(Spacer(1, 20))

    # --- 2. VISUALS ---
    story.append(Paragraph("2. Visual Analytics", styles['Heading2']))
    if 'grade_distribution' in data:
        story.append(Paragraph("<b>Grade Distribution</b>", styles['Normal']))
        story.append(draw_grade_pie_chart(data['grade_distribution']))
        story.append(Spacer(1, 10))

    if 'subject_performance' in data:
        story.append(Paragraph("<b>Subject-wise Performance</b>", styles['Normal']))
        story.append(draw_subject_bar_chart(data['subject_performance']))

    # --- 3. RANK LIST ---
    story.append(PageBreak())
    story.append(Paragraph("3. The Leaderboard", styles['Heading1']))
    if 'overall_rank_list' in data:
        r_data = [["Rank", "Name", "Score"]]
        for p in data['overall_rank_list']:
            r_data.append([str(p['rank']), p['name'], str(p['score'])])
        rt = Table(r_data, colWidths=[50, 250, 100])
        rt.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 1, colors.black), ('BACKGROUND', (0,0), (-1,0), colors.darkblue), ('TEXTCOLOR', (0,0), (-1,0), colors.white)]))
        story.append(rt)

    doc_template.build(story)
    buffer.seek(0)
    return buffer