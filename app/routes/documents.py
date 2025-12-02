"""
Document processing routes.
"""
from flask import Blueprint, request, jsonify, Response
from app.services.openai_service import get_openai_service
from app.prompts import get_summary_prompt

bp = Blueprint('documents', __name__)


@bp.route('/generate-summary', methods=['POST'])
def generate_summary():
    """Generate a summary of all uploaded files using OpenAI."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'}), 500
        
        # Get all uploaded files data from request
        files_data = request.json.get('files', [])
        
        if not files_data:
            return jsonify({'error': 'No files provided'}), 400
        
        # Build text summary content
        text_content = "Please analyze the following auto insurance claim documents and provide a comprehensive summary based ONLY on the visible text:\n\n"
        
        for file_data in files_data:
            filename = file_data.get('filename', file_data.get('originalFilename', 'Unknown'))
            file_type = file_data.get('type', 'unknown')
            text_content += f"\n--- {filename} ({file_type.upper()}) ---\n"
            
            if file_type == 'pdf':
                pages = file_data.get('pages', [])
                for page in pages:
                    page_text = page.get('text', '').strip()
                    if page_text:
                        text_content += f"\nPage {page.get('page_number', '?')}:\n{page_text}\n"
        
        system_prompt = get_summary_prompt()
        
        summary = openai_service.call_with_text_response(
            system_prompt=system_prompt,
            user_content=text_content,
            max_tokens=2000
        )
        
        if not summary:
            return jsonify({'error': 'Failed to generate summary'}), 500
        
        return jsonify({
            'summary': summary,
            'success': True
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Summary generation failed: {str(e)}'}), 500


@bp.route('/download-claim-rationale-pdf', methods=['POST'])
def download_claim_rationale_pdf():
    """Generate and return a PDF of the claim rationale."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
        from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
        from io import BytesIO
        import html2text
        
        # Parse and validate request data
        request_data = request.json
        if not request_data:
            print("download_claim_rationale_pdf: No request data provided.")
            return jsonify({'error': 'No request data provided.'}), 400
            
        rationale = request_data.get('rationale', {})
        
        if not rationale:
            print("download_claim_rationale_pdf: No rationale data provided.")
            return jsonify({'error': 'No rationale data provided.'}), 400
        
        # Ensure rationale is a dictionary
        if not isinstance(rationale, dict):
            print("download_claim_rationale_pdf: Rationale is not a dictionary.")
            return jsonify({'error': 'Invalid rationale format. Expected a dictionary.'}), 400
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMargin=18)
        
        # Container for the 'Flowable' objects
        elements = []
        
        # Define styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor='#333333',
            spaceAfter=12,
            alignment=TA_LEFT
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor='#333333',
            spaceAfter=10,
            spaceBefore=12,
            alignment=TA_LEFT
        )
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=11,
            textColor='#333333',
            spaceAfter=8,
            alignment=TA_JUSTIFY,
            leading=14
        )
        
        # Convert HTML to plain text
        h = html2text.HTML2Text()
        h.ignore_links = True
        h.body_width = 0
        
        # Helper function to safely convert text to PDF paragraph
        def safe_paragraph(text, style):
            """Safely convert text to Paragraph, handling empty strings and None."""
            if not text:
                return None
            try:
                # Convert to string and strip
                text_str = str(text).strip()
                if not text_str:
                    return None
                # Convert HTML to plain text if needed
                if '<' in text_str or '>' in text_str:
                    text_str = h.handle(text_str).strip()
                # Escape XML special characters for ReportLab
                text_str = text_str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                return Paragraph(text_str, style)
            except Exception as e:
                print(f"Error creating paragraph: {e}")
                return None
        
        # Title
        elements.append(Paragraph("Claim File Rationale", title_style))
        elements.append(Spacer(1, 0.2*inch))
        
        # Incident Summary
        if rationale.get('incident_summary'):
            para = safe_paragraph(rationale['incident_summary'], normal_style)
            if para:
                elements.append(Paragraph("Incident Summary", heading_style))
                elements.append(para)
                elements.append(Spacer(1, 0.15*inch))
        
        # Evidence Overview
        if rationale.get('evidence_overview'):
            evidence = rationale['evidence_overview']
            has_evidence = False
            if isinstance(evidence, dict):
                if evidence.get('narratives'):
                    para = safe_paragraph(evidence['narratives'], normal_style)
                    if para:
                        if not has_evidence:
                            elements.append(Paragraph("Evidence Overview", heading_style))
                            has_evidence = True
                        elements.append(Paragraph("<b>Narratives:</b>", normal_style))
                        elements.append(para)
                if evidence.get('photos'):
                    para = safe_paragraph(evidence['photos'], normal_style)
                    if para:
                        if not has_evidence:
                            elements.append(Paragraph("Evidence Overview", heading_style))
                            has_evidence = True
                        elements.append(Paragraph("<b>Photos:</b>", normal_style))
                        elements.append(para)
            if has_evidence:
                elements.append(Spacer(1, 0.15*inch))
        
        # Liability Assessment Logic
        if rationale.get('liability_assessment_logic'):
            para = safe_paragraph(rationale['liability_assessment_logic'], normal_style)
            if para:
                elements.append(Paragraph("Liability Assessment Logic", heading_style))
                elements.append(para)
                elements.append(Spacer(1, 0.15*inch))
        
        # Key Evidence
        if rationale.get('key_evidence') and isinstance(rationale['key_evidence'], list) and len(rationale['key_evidence']) > 0:
            elements.append(Paragraph("Key Evidence Supporting Assessment", heading_style))
            for item in rationale['key_evidence']:
                if item:
                    item_str = str(item).strip()
                    if item_str:
                        # Convert HTML to plain text if needed
                        if '<' in item_str or '>' in item_str:
                            item_str = h.handle(item_str).strip()
                        # Escape XML special characters
                        item_str = item_str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        elements.append(Paragraph(f"• {item_str}", normal_style))
            elements.append(Spacer(1, 0.15*inch))
        
        # Open Questions
        if rationale.get('open_questions') and isinstance(rationale['open_questions'], list) and len(rationale['open_questions']) > 0:
            elements.append(Paragraph("Open Questions / Follow-Up", heading_style))
            for item in rationale['open_questions']:
                if item:
                    item_str = str(item).strip()
                    if item_str:
                        # Convert HTML to plain text if needed
                        if '<' in item_str or '>' in item_str:
                            item_str = h.handle(item_str).strip()
                        # Escape XML special characters
                        item_str = item_str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        elements.append(Paragraph(f"• {item_str}", normal_style))
            elements.append(Spacer(1, 0.15*inch))
        
        # Coverage Considerations
        if rationale.get('coverage_considerations'):
            para = safe_paragraph(rationale['coverage_considerations'], normal_style)
            if para:
                elements.append(Paragraph("Coverage Considerations", heading_style))
                elements.append(para)
                elements.append(Spacer(1, 0.15*inch))
        
        # Recommendation
        if rationale.get('recommendation'):
            para = safe_paragraph(rationale['recommendation'], normal_style)
            if para:
                elements.append(Paragraph("Recommendation", heading_style))
                elements.append(para)
        
        # Check if we have any content
        if len(elements) <= 2:  # Only title and spacer
            return jsonify({'error': 'No content available to generate PDF.'}), 400
        
        # Build PDF
        try:
            doc.build(elements)
        except Exception as build_error:
            print(f"download_claim_rationale_pdf: Error building PDF: {build_error}")
            return jsonify({'error': f'Error building PDF: {str(build_error)}'}), 500
        
        # Get PDF data
        pdf_data = buffer.getvalue()
        buffer.close()
        
        if not pdf_data or len(pdf_data) == 0:
            return jsonify({'error': 'Generated PDF is empty.'}), 500
        
        # Return PDF as response
        return Response(
            pdf_data,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': 'attachment; filename=claim_rationale.pdf'
            }
        )
    
    except ImportError as imp_err:
        # Fallback: return JSON if reportlab / html2text are not available
        print(f"download_claim_rationale_pdf: ImportError while generating PDF: {imp_err}")
        return jsonify({
            'error': 'PDF generation is currently unavailable. Please contact support.'
        }), 500
    except Exception as e:
        print(f"download_claim_rationale_pdf: Unexpected error: {e}")
        return jsonify({'error': f'PDF generation failed: {str(e)}'}), 500
