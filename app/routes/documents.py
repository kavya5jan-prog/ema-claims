"""
Document processing routes.
"""
from flask import Blueprint, request, jsonify, Response
from app.services.openai_service import get_openai_service
from app.prompts import get_summary_prompt, get_email_draft_prompt
from app.config import Config
import uuid
from datetime import datetime
import requests
import logging

bp = Blueprint('documents', __name__)
logger = logging.getLogger(__name__)

# Log all requests to this blueprint for debugging
@bp.before_request
def log_request():
    logger.info(f"[DOCUMENTS BLUEPRINT] {request.method} {request.path}")
    logger.info(f"[DOCUMENTS BLUEPRINT] Request endpoint: {request.endpoint}")
    logger.info(f"[DOCUMENTS BLUEPRINT] Request URL: {request.url}")


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


@bp.route('/generate-email-draft', methods=['POST'])
def generate_email_draft():
    """Generate an email draft requesting missing evidence using OpenAI."""
    try:
        logger.info("[EMAIL DRAFT] Request received at /generate-email-draft")
        logger.info(f"[EMAIL DRAFT] Request method: {request.method}")
        logger.info(f"[EMAIL DRAFT] Request headers: {dict(request.headers)}")
        
        openai_service = get_openai_service()
        if not openai_service.is_available():
            error_msg = 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'
            logger.error(f"[EMAIL DRAFT ERROR] {error_msg}")
            return jsonify({'error': error_msg}), 500
        
        if not request.json:
            error_msg = 'Invalid request: JSON body required'
            logger.error(f"[EMAIL DRAFT ERROR] {error_msg}")
            logger.error(f"[EMAIL DRAFT ERROR] Request content type: {request.content_type}")
            logger.error(f"[EMAIL DRAFT ERROR] Request data: {request.data}")
            return jsonify({'error': error_msg}), 400
        
        request_data = request.json
        logger.info(f"[EMAIL DRAFT] Request data keys: {list(request_data.keys())}")
        
        selected_evidence = request_data.get('selected_evidence', [])
        contact = request_data.get('contact', {})
        claim_context = request_data.get('claim_context', '')
        
        logger.info(f"[EMAIL DRAFT] Selected evidence count: {len(selected_evidence)}")
        logger.info(f"[EMAIL DRAFT] Contact: {contact.get('name', 'N/A')} ({contact.get('email', 'N/A')})")
        
        if not selected_evidence:
            error_msg = 'No evidence items selected.'
            logger.error(f"[EMAIL DRAFT ERROR] {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        if not contact or not contact.get('email'):
            error_msg = 'Contact information is required.'
            logger.error(f"[EMAIL DRAFT ERROR] {error_msg}")
            logger.error(f"[EMAIL DRAFT ERROR] Contact data: {contact}")
            return jsonify({'error': error_msg}), 400
        
        # Build user content for OpenAI
        user_content = f"""Contact Information:
Name: {contact.get('name', 'N/A')}
Email: {contact.get('email', 'N/A')}
Role: {contact.get('role', 'N/A')}

Missing Evidence Items:
"""
        for idx, evidence in enumerate(selected_evidence, 1):
            # Handle both new structure (evidence_needed) and old structure (component)
            evidence_needed = evidence.get('evidence_needed') or evidence.get('component', 'N/A')
            user_content += f"\n{idx}. {evidence_needed}\n"
            if evidence.get('why_it_matters'):
                user_content += f"   Why it matters: {evidence.get('why_it_matters')}\n"
            elif evidence.get('reason'):
                # Fallback for old structure
                user_content += f"   Why it matters: {evidence.get('reason')}\n"
            if evidence.get('suggested_follow_up'):
                user_content += f"   Suggested follow-up: {evidence.get('suggested_follow_up')}\n"
            if evidence.get('priority'):
                user_content += f"   Priority: {evidence.get('priority')}\n"
        
        if claim_context:
            user_content += f"\n\nClaim Context:\n{claim_context}\n"
        
        system_prompt = get_email_draft_prompt()
        
        logger.info("[EMAIL DRAFT] Calling OpenAI service to generate draft")
        draft = openai_service.call_with_text_response(
            system_prompt=system_prompt,
            user_content=user_content,
            max_tokens=2000
        )
        
        if not draft:
            error_msg = 'Failed to generate email draft. OpenAI API returned an empty response.'
            logger.error(f"[EMAIL DRAFT ERROR] {error_msg}")
            logger.error(f"[EMAIL DRAFT ERROR] OpenAI service response was None or empty")
            return jsonify({'error': error_msg}), 500
        
        logger.info(f"[EMAIL DRAFT] Successfully generated draft (length: {len(draft)} characters)")
        return jsonify({
            'draft': draft,
            'success': True
        }), 200
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_msg = f'Email draft generation failed: {str(e)}'
        logger.error(f"[EMAIL DRAFT ERROR] {error_msg}")
        logger.error(f"[EMAIL DRAFT ERROR] Traceback:\n{error_trace}")
        print(f"[EMAIL DRAFT ERROR] Exception: {str(e)}")
        print(f"[EMAIL DRAFT ERROR] Traceback:\n{error_trace}")
        return jsonify({'error': error_msg}), 500


@bp.route('/send-email-request', methods=['POST'])
def send_email_request():
    """Send an email request using SendGrid."""
    try:
        request_data = request.json
        to_email = request_data.get('to')
        subject = request_data.get('subject', 'Request for Additional Evidence')
        body = request_data.get('body', '')
        selected_evidence = request_data.get('selected_evidence', [])
        
        if not to_email:
            return jsonify({'error': 'Recipient email is required.'}), 400
        
        if not body:
            return jsonify({'error': 'Email body is required.'}), 400
        
        # Check if SendGrid is configured
        if not Config.SENDGRID_API_KEY:
            # Fallback to mock mode for development
            print(f"[MOCK EMAIL SEND - SendGrid not configured]")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Body: {body[:200]}...")  # Truncate for logging
            print(f"Selected Evidence Items: {len(selected_evidence)}")
            print(f"Timestamp: {datetime.now().isoformat()}")
            print(f"Note: Set SENDGRID_API_KEY environment variable to enable actual email sending")
            
            message_id = str(uuid.uuid4())
            return jsonify({
                'success': True,
                'message_id': message_id,
                'sent_at': datetime.now().isoformat(),
                'mock_mode': True,
                'note': 'SendGrid not configured - email was logged but not sent'
            }), 200
        
        # Validate SendGrid configuration
        if not Config.SENDGRID_FROM_EMAIL:
            return jsonify({
                'error': 'SENDGRID_FROM_EMAIL is required. Please set SENDGRID_FROM_EMAIL environment variable.'
            }), 500
        
        # Send email using SendGrid REST API
        try:
            url = 'https://api.sendgrid.com/v3/mail/send'
            headers = {
                'Authorization': f'Bearer {Config.SENDGRID_API_KEY}',
                'Content-Type': 'application/json'
            }
            
            # Format request body according to SendGrid v3 API
            payload = {
                'personalizations': [
                    {
                        'to': [{'email': to_email}]
                    }
                ],
                'from': {
                    'email': Config.SENDGRID_FROM_EMAIL,
                    'name': Config.SENDGRID_FROM_NAME
                },
                'subject': subject,
                'content': [
                    {
                        'type': 'text/plain',
                        'value': body
                    }
                ]
            }
            
            # Send request
            response = requests.post(url, headers=headers, json=payload)
            
            # Check response status
            if response.status_code == 202:
                # Success - SendGrid returns 202 Accepted
                # Get message ID from response headers
                message_id = response.headers.get('X-Message-Id') or str(uuid.uuid4())
                
                # Log successful send
                print(f"[SENDGRID EMAIL SENT]")
                print(f"To: {to_email}")
                print(f"Subject: {subject}")
                print(f"Status Code: {response.status_code}")
                print(f"Message ID: {message_id}")
                print(f"Timestamp: {datetime.now().isoformat()}")
                
                return jsonify({
                    'success': True,
                    'message_id': message_id,
                    'sent_at': datetime.now().isoformat(),
                    'status_code': response.status_code
                }), 200
            else:
                # Handle error responses
                error_message = f"HTTP {response.status_code}"
                try:
                    error_data = response.json()
                    if 'errors' in error_data and len(error_data['errors']) > 0:
                        error_message = error_data['errors'][0].get('message', error_message)
                    elif 'error' in error_data:
                        error_message = error_data['error']
                except:
                    error_message = response.text or error_message
                
                print(f"[SENDGRID ERROR] Failed to send email: {error_message}")
                print(f"Response Status: {response.status_code}")
                print(f"Response Body: {response.text[:500]}")
                
                # Provide more helpful error messages
                if response.status_code == 401:
                    return jsonify({'error': 'SendGrid authentication failed. Please check your SENDGRID_API_KEY.'}), 500
                elif response.status_code == 403:
                    return jsonify({'error': 'SendGrid access forbidden. Please check your API key permissions.'}), 500
                elif response.status_code == 400:
                    return jsonify({'error': f'Invalid email request: {error_message}'}), 400
                else:
                    return jsonify({'error': f'SendGrid error: {error_message}'}), 500
        
        except requests.exceptions.RequestException as send_error:
            # Handle network/request errors
            error_message = str(send_error)
            print(f"[SENDGRID ERROR] Request failed: {error_message}")
            return jsonify({'error': f'Failed to connect to SendGrid: {error_message}'}), 500
    
    except Exception as e:
        print(f"[EMAIL SEND ERROR] Unexpected error: {str(e)}")
        return jsonify({'error': f'Email sending failed: {str(e)}'}), 500


@bp.route('/send-test-email', methods=['POST'])
def send_test_email():
    """Send a test email to verify SendGrid integration."""
    try:
        request_data = request.json or {}
        test_email = request_data.get('to')
        
        # If no email provided, use a default test email or return error
        if not test_email:
            return jsonify({'error': 'Please provide a recipient email address in the request body: {"to": "your-email@example.com"}'}), 400
        
        # Check if SendGrid is configured
        if not Config.SENDGRID_API_KEY:
            return jsonify({
                'error': 'SendGrid API key not configured',
                'message': 'Please set SENDGRID_API_KEY environment variable to send test emails',
                'mock_mode': True
            }), 500
        
        # Validate SendGrid configuration
        if not Config.SENDGRID_FROM_EMAIL:
            return jsonify({
                'error': 'SENDGRID_FROM_EMAIL is required. Please set SENDGRID_FROM_EMAIL environment variable.'
            }), 500
        
        # Create test email content
        subject = 'Test Email - Auto Claims System'
        body = f"""Hello,

This is a test email from the Auto Claims System to verify SendGrid integration.

If you received this email, the SendGrid integration is working correctly!

Test Details:
- Timestamp: {datetime.now().isoformat()}
- System: Auto Claims System
- Integration: SendGrid

Warm regards,
Kavya
Ema Automobile Insurance
"""
        
        # Send email using SendGrid REST API
        try:
            url = 'https://api.sendgrid.com/v3/mail/send'
            headers = {
                'Authorization': f'Bearer {Config.SENDGRID_API_KEY}',
                'Content-Type': 'application/json'
            }
            
            # Format request body according to SendGrid v3 API
            payload = {
                'personalizations': [
                    {
                        'to': [{'email': test_email}]
                    }
                ],
                'from': {
                    'email': Config.SENDGRID_FROM_EMAIL,
                    'name': Config.SENDGRID_FROM_NAME
                },
                'subject': subject,
                'content': [
                    {
                        'type': 'text/plain',
                        'value': body
                    }
                ]
            }
            
            # Send request
            response = requests.post(url, headers=headers, json=payload)
            
            # Check response status
            if response.status_code == 202:
                # Success - SendGrid returns 202 Accepted
                # Get message ID from response headers
                message_id = response.headers.get('X-Message-Id') or str(uuid.uuid4())
                
                # Log successful send
                print(f"[SENDGRID TEST EMAIL SENT]")
                print(f"To: {test_email}")
                print(f"Subject: {subject}")
                print(f"Status Code: {response.status_code}")
                print(f"Message ID: {message_id}")
                print(f"Timestamp: {datetime.now().isoformat()}")
                
                return jsonify({
                    'success': True,
                    'message': 'Test email sent successfully',
                    'to': test_email,
                    'message_id': message_id,
                    'sent_at': datetime.now().isoformat(),
                    'status_code': response.status_code
                }), 200
            else:
                # Handle error responses
                error_message = f"HTTP {response.status_code}"
                try:
                    error_data = response.json()
                    if 'errors' in error_data and len(error_data['errors']) > 0:
                        error_message = error_data['errors'][0].get('message', error_message)
                    elif 'error' in error_data:
                        error_message = error_data['error']
                except:
                    error_message = response.text or error_message
                
                print(f"[SENDGRID TEST ERROR] Failed to send test email: {error_message}")
                print(f"Response Status: {response.status_code}")
                print(f"Response Body: {response.text[:500]}")
                
                # Provide more helpful error messages
                if response.status_code == 401:
                    return jsonify({'error': 'SendGrid authentication failed. Please check your SENDGRID_API_KEY.'}), 500
                elif response.status_code == 403:
                    return jsonify({'error': 'SendGrid access forbidden. Please check your API key permissions.'}), 500
                elif response.status_code == 400:
                    return jsonify({'error': f'Invalid email request: {error_message}'}), 400
                else:
                    return jsonify({'error': f'SendGrid error: {error_message}'}), 500
        
        except requests.exceptions.RequestException as send_error:
            # Handle network/request errors
            error_message = str(send_error)
            print(f"[SENDGRID TEST ERROR] Request failed: {error_message}")
            return jsonify({'error': f'Failed to connect to SendGrid: {error_message}'}), 500
    
    except Exception as e:
        print(f"[TEST EMAIL ERROR] Unexpected error: {str(e)}")
        return jsonify({'error': f'Test email failed: {str(e)}'}), 500
