"""
Main routes (index, upload).
"""
import os
from functools import wraps
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from app.config import Config
from app.services.pdf_service import extract_pdf_content
from app.services.image_service import extract_image_content
from app.services.audio_service import transcribe_audio
from app.utils.file_utils import identify_document_source

bp = Blueprint('main', __name__)

# Get the base directory (project root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAMPLE_FILES_FOLDER = os.path.join(BASE_DIR, 'sample files')

# Hardcoded credentials for prototype
VALID_USER_ID = 'ema'
VALID_PASSWORD = 'thp'


def login_required(f):
    """Decorator to require login for routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('main.login'))
        return f(*args, **kwargs)
    return decorated_function


@bp.route('/')
def index():
    """Root route - redirect based on login status."""
    if session.get('logged_in'):
        return redirect(url_for('main.review'))
    else:
        return redirect(url_for('main.login'))


@bp.route('/login', methods=['GET'])
def login():
    """Render the login page."""
    # If already logged in, redirect to review
    if session.get('logged_in'):
        return redirect(url_for('main.review'))
    return render_template('login.html')


@bp.route('/login', methods=['POST'])
def login_post():
    """Handle login authentication."""
    try:
        user_id = request.form.get('userId', '').strip()
        password = request.form.get('password', '').strip()
        
        # Validate credentials
        if user_id == VALID_USER_ID and password == VALID_PASSWORD:
            session['logged_in'] = True
            session['user_id'] = user_id
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/logout')
def logout():
    """Log out the user and redirect to login."""
    session.clear()
    return redirect(url_for('main.login'))


@bp.route('/review')
@login_required
def review():
    """Render the review page (main application page)."""
    return render_template('index.html')


@bp.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and extraction (PDFs and images)."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get file extension
        filename_lower = file.filename.lower()
        is_pdf = filename_lower.endswith('.pdf')
        is_image = any(filename_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png'])
        is_audio = any(filename_lower.endswith(ext) for ext in ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm', '.ogg'])
        
        if not (is_pdf or is_image or is_audio):
            return jsonify({'error': 'Invalid file type. Only PDF, PNG, JPEG, JPG, and audio files (MP3, WAV, M4A, etc.) are supported.'}), 400
        
        # Save uploaded file
        file_path = os.path.join(Config.UPLOAD_FOLDER, file.filename)
        file.save(file_path)
        
        try:
            # Extract content
            content_text = ''
            if is_pdf:
                # Extract PDF content
                extracted_content = extract_pdf_content(file_path)
                extracted_content['type'] = 'pdf'
                extracted_content['filename'] = file.filename
                
                # Extract text content for type detection (first 2-3 pages)
                pages = extracted_content.get('pages', [])
                for page in pages[:3]:  # First 3 pages
                    page_text = page.get('text', '').strip()
                    if page_text:
                        content_text += page_text + '\n'
            elif is_audio:
                # Transcribe audio file
                transcription = transcribe_audio(file_path)
                extracted_content = {
                    'type': 'audio',
                    'filename': file.filename,
                    'transcription': transcription,
                    'pages': [{
                        'page_number': 1,
                        'text': transcription
                    }]
                }
                content_text = transcription
            else:
                # Extract image content
                extracted_content = extract_image_content(file_path)
                # For images, we'll use filename-based detection primarily
                # Content-based detection for images would require OCR/vision API
                content_text = ''  # Images don't have text content easily extractable
            
            # Detect document source type (for consistency, even though single upload is pre-matched)
            detected_source, is_relevant = identify_document_source(file.filename, content_text if content_text else None)
            extracted_content['detected_source'] = detected_source
            extracted_content['is_relevant'] = is_relevant
            
            # Clean up uploaded file
            os.remove(file_path)
            
            return jsonify(extracted_content), 200
        
        except Exception as e:
            # Clean up on error
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@bp.route('/upload-multiple', methods=['POST'])
def upload_multiple_files():
    """Handle multiple file uploads with automatic type detection."""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        
        if not files or len(files) == 0:
            return jsonify({'error': 'No files selected'}), 400
        
        results = []
        
        for file in files:
            if file.filename == '':
                results.append({
                    'filename': 'unknown',
                    'error': 'Empty filename'
                })
                continue
            
            try:
                # Get file extension
                filename_lower = file.filename.lower()
                is_pdf = filename_lower.endswith('.pdf')
                is_image = any(filename_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png'])
                is_audio = any(filename_lower.endswith(ext) for ext in ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm', '.ogg'])
                
                if not (is_pdf or is_image or is_audio):
                    results.append({
                        'filename': file.filename,
                        'error': 'Invalid file type. Only PDF, PNG, JPEG, JPG, and audio files (MP3, WAV, M4A, etc.) are supported.'
                    })
                    continue
                
                # Save uploaded file
                file_path = os.path.join(Config.UPLOAD_FOLDER, file.filename)
                file.save(file_path)
                
                try:
                    # Extract content
                    content_text = ''
                    if is_pdf:
                        # Extract PDF content
                        extracted_content = extract_pdf_content(file_path)
                        extracted_content['type'] = 'pdf'
                        extracted_content['filename'] = file.filename
                        
                        # Extract text content for type detection (first 2-3 pages)
                        pages = extracted_content.get('pages', [])
                        for page in pages[:3]:  # First 3 pages
                            page_text = page.get('text', '').strip()
                            if page_text:
                                content_text += page_text + '\n'
                    elif is_audio:
                        # Transcribe audio file
                        transcription = transcribe_audio(file_path)
                        extracted_content = {
                            'type': 'audio',
                            'filename': file.filename,
                            'transcription': transcription,
                            'pages': [{
                                'page_number': 1,
                                'text': transcription
                            }]
                        }
                        content_text = transcription
                    else:
                        # Extract image content
                        extracted_content = extract_image_content(file_path)
                        # For images, we'll use filename-based detection primarily
                        # Content-based detection for images would require OCR/vision API
                        content_text = ''  # Images don't have text content easily extractable
                    
                    # Detect document source type
                    detected_source, is_relevant = identify_document_source(file.filename, content_text if content_text else None)
                    
                    # Add detected source to response
                    extracted_content['detected_source'] = detected_source
                    extracted_content['is_relevant'] = is_relevant
                    
                    results.append(extracted_content)
                    
                except Exception as e:
                    results.append({
                        'filename': file.filename,
                        'error': f'Error processing file: {str(e)}'
                    })
                finally:
                    # Clean up uploaded file
                    if os.path.exists(file_path):
                        os.remove(file_path)
            
            except Exception as e:
                results.append({
                    'filename': file.filename if file else 'unknown',
                    'error': f'Upload failed: {str(e)}'
                })
        
        return jsonify({'results': results}), 200
    
    except Exception as e:
        return jsonify({'error': f'Bulk upload failed: {str(e)}'}), 500


@bp.route('/list-sample-files', methods=['GET'])
def list_sample_files():
    """List all files in the sample files folder."""
    try:
        if not os.path.exists(SAMPLE_FILES_FOLDER):
            return jsonify({'error': 'Sample files folder not found'}), 404
        
        files = []
        for filename in os.listdir(SAMPLE_FILES_FOLDER):
            file_path = os.path.join(SAMPLE_FILES_FOLDER, filename)
            if os.path.isfile(file_path):
                files.append(filename)
        
        return jsonify({'files': files}), 200
    
    except Exception as e:
        return jsonify({'error': f'Failed to list sample files: {str(e)}'}), 500


@bp.route('/load-sample-file/<path:filename>', methods=['GET'])
def load_sample_file(filename):
    """Load and process a sample file from the sample files folder."""
    try:
        # Security: prevent directory traversal
        filename = os.path.basename(filename)
        file_path = os.path.join(SAMPLE_FILES_FOLDER, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'Sample file not found: {filename}'}), 404
        
        if not os.path.isfile(file_path):
            return jsonify({'error': f'Not a file: {filename}'}), 400
        
        # Get file extension
        filename_lower = filename.lower()
        is_pdf = filename_lower.endswith('.pdf')
        is_image = any(filename_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png'])
        is_audio = any(filename_lower.endswith(ext) for ext in ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm', '.ogg'])
        
        if not (is_pdf or is_image or is_audio):
            return jsonify({'error': 'Invalid file type. Only PDF, PNG, JPEG, JPG, and audio files (MP3, WAV, M4A, etc.) are supported.'}), 400
        
        # Extract content
        content_text = ''
        if is_pdf:
            # Extract PDF content
            extracted_content = extract_pdf_content(file_path)
            extracted_content['type'] = 'pdf'
            extracted_content['filename'] = filename
            extracted_content['originalFilename'] = filename
            
            # Extract text content for type detection (first 2-3 pages)
            pages = extracted_content.get('pages', [])
            for page in pages[:3]:  # First 3 pages
                page_text = page.get('text', '').strip()
                if page_text:
                    content_text += page_text + '\n'
        elif is_audio:
            # Transcribe audio file
            transcription = transcribe_audio(file_path)
            extracted_content = {
                'type': 'audio',
                'filename': filename,
                'originalFilename': filename,
                'transcription': transcription,
                'pages': [{
                    'page_number': 1,
                    'text': transcription
                }]
            }
            content_text = transcription
        else:
            # Extract image content
            extracted_content = extract_image_content(file_path)
            extracted_content['filename'] = filename
            extracted_content['originalFilename'] = filename
            # For images, we'll use filename-based detection primarily
            # Content-based detection for images would require OCR/vision API
            content_text = ''  # Images don't have text content easily extractable
        
        # Detect document source type
        detected_source, is_relevant = identify_document_source(filename, content_text if content_text else None)
        extracted_content['detected_source'] = detected_source
        extracted_content['is_relevant'] = is_relevant
        
        return jsonify(extracted_content), 200
    
    except Exception as e:
        return jsonify({'error': f'Failed to load sample file: {str(e)}'}), 500

