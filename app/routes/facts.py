"""
Fact extraction routes.
"""
import sys
from flask import Blueprint, request, jsonify
from app.services.openai_service import get_openai_service
from app.services.document_service import extract_facts_from_documents
from app.config import Config

bp = Blueprint('facts', __name__)


@bp.route('/extract-facts', methods=['POST'])
def extract_facts():
    """Extract structured facts from all uploaded files using OpenAI."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'}), 500
        
        # Get all uploaded files data from request
        if not request.json:
            return jsonify({'error': 'Invalid request: JSON body required'}), 400
        
        files_data = request.json.get('files', [])
        
        if not files_data:
            return jsonify({'error': 'No files provided'}), 400
        
        # Memory limit validation: Count total images and check payload size
        total_images = 0
        total_payload_size = 0
        
        try:
            # Estimate payload size and count images
            import json as json_module
            payload_json = json_module.dumps(request.json)
            total_payload_size = sys.getsizeof(payload_json)
            
            for file_data in files_data:
                file_type = file_data.get('type', 'unknown')
                
                if file_type == 'pdf':
                    pages = file_data.get('pages', [])
                    for page in pages:
                        images = page.get('images', [])
                        total_images += len(images)
                        
                        # Estimate size of image data
                        for img in images:
                            img_data = img.get('data', '')
                            if img_data:
                                # Base64 data size estimation (rough)
                                total_payload_size += sys.getsizeof(img_data)
                
                elif file_type == 'image':
                    total_images += 1
                    img_data = file_data.get('data', '')
                    if img_data:
                        total_payload_size += sys.getsizeof(img_data)
            
            # Check limits
            if total_images > Config.MAX_TOTAL_IMAGES_PER_REQUEST:
                return jsonify({
                    'error': f'Too many images ({total_images}). Maximum allowed: {Config.MAX_TOTAL_IMAGES_PER_REQUEST}. Please reduce the number of images or split your request.'
                }), 400
            
            # Check payload size (rough estimate: 50MB limit)
            MAX_PAYLOAD_SIZE_MB = 50
            MAX_PAYLOAD_SIZE_BYTES = MAX_PAYLOAD_SIZE_MB * 1024 * 1024
            if total_payload_size > MAX_PAYLOAD_SIZE_BYTES:
                return jsonify({
                    'error': f'Request payload too large (estimated {total_payload_size / (1024*1024):.1f}MB). Maximum allowed: {MAX_PAYLOAD_SIZE_MB}MB. Please reduce file sizes or number of files.'
                }), 400
            
            print(f"Processing request: {total_images} images, ~{total_payload_size / (1024*1024):.1f}MB payload")
        
        except Exception as validation_error:
            print(f"Warning: Error during memory validation: {validation_error}")
            # Continue processing but log the warning
        
        # Extract facts from documents
        try:
            result = extract_facts_from_documents(files_data)
            return jsonify(result), 200
        
        except MemoryError as mem_error:
            error_msg = f'Insufficient memory to process request. Please reduce the number of files or images and try again.'
            print(f"Memory error in fact extraction: {mem_error}")
            return jsonify({'error': error_msg}), 500
        except Exception as e:
            error_msg = str(e)
            print(f"ERROR: Fact extraction error: {error_msg}")  # Log for debugging
            import traceback
            print(f"ERROR: Fact extraction traceback: {traceback.format_exc()}")
            return jsonify({'error': f'Fact extraction failed: {error_msg}'}), 500
    
    except MemoryError as mem_error:
        error_msg = f'Insufficient memory to process request. Please reduce the number of files or images and try again.'
        print(f"Memory error in request handling: {mem_error}")
        return jsonify({'error': error_msg}), 500
    except Exception as e:
        error_msg = str(e)
        print(f"Request error: {error_msg}")  # Log for debugging
        return jsonify({'error': f'Request failed: {error_msg}'}), 500


