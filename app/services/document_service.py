"""
Document processing service for fact extraction.
"""
import sys
import logging
from typing import List, Dict, Any
from app.config import Config
from app.services.openai_service import get_openai_service
from app.prompts import get_fact_extraction_prompt
from app.utils.file_utils import identify_document_source
from app.utils.fact_utils import normalize_facts, detect_conflicts

# Set up logging
logger = logging.getLogger(__name__)


def extract_facts_from_documents(files_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main extraction orchestrator.
    
    Args:
        files_data: List of file data dictionaries
        
    Returns:
        Dictionary with 'facts' and 'conflicts' keys
    """
    openai_service = get_openai_service()
    if not openai_service.is_available():
        raise Exception('OpenAI API key not configured')
    
    # Prepare content for OpenAI
    content_parts = []
    images_added_count = 0  # Track number of images being sent to OpenAI
    
    text_content = get_fact_extraction_prompt()
    
    for file_data in files_data:
        filename = file_data.get('filename', file_data.get('originalFilename', 'Unknown'))
        expected_filename = file_data.get('expectedFileName', filename)
        source = identify_document_source(expected_filename)[0]  # Get just the source string
        file_type = file_data.get('type', 'unknown')
        
        text_content += f"\n--- Document: {filename} (Source: {source}) ---\n"
        
        if file_type == 'pdf':
            pages = file_data.get('pages', [])
            for page in pages:
                page_text = page.get('text', '').strip()
                if page_text:
                    text_content += f"\nPage {page.get('page_number', '?')}:\n{page_text}\n"
        
        elif file_type == 'audio':
            # Handle audio transcription
            pages = file_data.get('pages', [])
            transcription = file_data.get('transcription', '')
            if transcription:
                text_content += f"\nAudio Transcription:\n{transcription}\n"
            elif pages:
                # Fallback to pages if transcription not directly available
                for page in pages:
                    page_text = page.get('text', '').strip()
                    if page_text:
                        text_content += f"\nAudio Transcription:\n{page_text}\n"
            
            # Add images from PDF (with limits)
            for page in pages:
                images = page.get('images', [])
                for img in images:
                    # Limit total images sent to OpenAI API
                    if images_added_count >= Config.MAX_TOTAL_IMAGES_PER_REQUEST:
                        print(f"Warning: Reached image limit ({Config.MAX_TOTAL_IMAGES_PER_REQUEST}), skipping remaining images")
                        break
                    
                    img_data = img.get('data', '')
                    if img_data:
                        if img_data.startswith('data:'):
                            parts = img_data.split(',')
                            if len(parts) == 2:
                                base64_data = parts[1]
                                mime_part = parts[0]
                                if 'image/' in mime_part:
                                    mime_type = mime_part.split('image/')[1].split(';')[0]
                                else:
                                    mime_type = img.get('ext', 'png')
                            else:
                                continue
                        else:
                            base64_data = img_data
                            mime_type = img.get('ext', 'png')
                        
                        # Check individual image size before adding
                        if len(base64_data) > Config.MAX_IMAGE_SIZE_BYTES * 2:  # Allow 2x for base64 overhead
                            print(f"Warning: Skipping large image ({len(base64_data)} bytes) from {filename}")
                            continue
                        
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/{mime_type};base64,{base64_data}"
                            }
                        })
                        images_added_count += 1
                
                if images_added_count >= Config.MAX_TOTAL_IMAGES_PER_REQUEST:
                    break
        
        elif file_type == 'image':
            # Limit total images sent to OpenAI API
            if images_added_count >= Config.MAX_TOTAL_IMAGES_PER_REQUEST:
                print(f"Warning: Reached image limit ({Config.MAX_TOTAL_IMAGES_PER_REQUEST}), skipping image {filename}")
                text_content += f"\nThis is an image file: {filename} (skipped due to image limit)\n"
            else:
                img_data = file_data.get('data', '')
                if img_data:
                    if img_data.startswith('data:'):
                        parts = img_data.split(',')
                        if len(parts) == 2:
                            base64_data = parts[1]
                            mime_part = parts[0]
                            if 'image/' in mime_part:
                                mime_type = mime_part.split('image/')[1].split(';')[0]
                            else:
                                mime_type = file_data.get('format', 'png').lower()
                        else:
                            continue
                    else:
                        base64_data = img_data
                        mime_type = file_data.get('format', 'png').lower()
                    
                    # Check individual image size before adding
                    if len(base64_data) > Config.MAX_IMAGE_SIZE_BYTES * 2:  # Allow 2x for base64 overhead
                        print(f"Warning: Skipping large image ({len(base64_data)} bytes): {filename}")
                        text_content += f"\nThis is an image file: {filename} (skipped due to size limit)\n"
                    else:
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/{mime_type};base64,{base64_data}"
                            }
                        })
                        images_added_count += 1
                        text_content += f"\nThis is an image file: {filename}\n"
    
    # Add text content
    content_parts.insert(0, {
        "type": "text",
        "text": text_content
    })
    
    # Call OpenAI API with JSON mode
    try:
        # Estimate content size before API call
        try:
            content_size = sys.getsizeof(str(content_parts))
            if content_size > 20 * 1024 * 1024:  # 20MB warning
                warning_msg = f"Large content payload ({content_size / (1024*1024):.1f}MB) being sent to OpenAI API"
                logger.warning(warning_msg)
                print(f"Warning: {warning_msg}")
        except Exception as size_error:
            logger.debug(f"Could not estimate content size: {str(size_error)}")
            pass  # Ignore size estimation errors
        
        logger.info(f"Calling OpenAI API with {len(content_parts)} content parts")
        print(f"DEBUG: extract_facts_from_documents: Calling OpenAI API with {len(content_parts)} content parts")
        
        try:
            # Use longer timeout for fact extraction (180 seconds) due to potentially large payloads
            result = openai_service.call_with_json_response(
                system_prompt=None,
                user_content=content_parts,
                max_tokens=4000,
                timeout=180.0
            )
            logger.debug(f"OpenAI API call completed, result type: {type(result).__name__}")
        except ValueError as ve:
            # ValueError from OpenAI service indicates API errors (timeout, rate limit, etc.)
            error_msg = str(ve)
            logger.error(f"OpenAI API error: {error_msg}", exc_info=True)
            print(f"ERROR: OpenAI API error: {error_msg}")
            import traceback
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise Exception(error_msg)
        except TypeError as te:
            # TypeError indicates unexpected response type
            error_msg = f"OpenAI API returned unexpected type: {str(te)}"
            logger.error(error_msg, exc_info=True)
            print(f"ERROR: {error_msg}")
            import traceback
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise Exception(error_msg)
        except Exception as api_error:
            # Catch any other unexpected errors
            error_msg = f"OpenAI API call failed: {str(api_error)}"
            logger.error(error_msg, exc_info=True)
            print(f"ERROR: {error_msg}")
            import traceback
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise Exception(error_msg)
        
        # Clean up content_parts to free memory
        del content_parts
        
        logger.debug(f"OpenAI API returned result type: {type(result).__name__}")
        print(f"DEBUG: extract_facts_from_documents: OpenAI API returned result type: {type(result).__name__}")
        
        # Validate result structure
        if not isinstance(result, dict):
            error_msg = f"Expected dict response from OpenAI API, but got {type(result).__name__}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise Exception(error_msg)
        
        facts = result.get('facts', [])
        
        # Create a mapping of document identifiers to sources
        doc_source_map = {}
        doc_text_samples = {}
        for file_data in files_data:
            filename = file_data.get('filename', file_data.get('originalFilename', 'Unknown'))
            expected_filename = file_data.get('expectedFileName', filename)
            source, _ = identify_document_source(expected_filename)
            doc_source_map[expected_filename.lower()] = source
            doc_source_map[filename.lower()] = source
            
            # Store text samples for matching
            if file_data.get('type') == 'pdf':
                pages = file_data.get('pages', [])
                text_sample = ' '.join([p.get('text', '')[:200] for p in pages[:2]]).lower()
                doc_text_samples[source] = text_sample
            elif file_data.get('type') == 'audio':
                # For audio, use transcription text
                transcription = file_data.get('transcription', '')
                if transcription:
                    doc_text_samples[source] = transcription[:400].lower()
                else:
                    pages = file_data.get('pages', [])
                    if pages:
                        text_sample = ' '.join([p.get('text', '')[:200] for p in pages[:2]]).lower()
                        doc_text_samples[source] = text_sample
        
        # Ensure all facts have source properly set
        for fact in facts:
            if not fact.get('source') or fact.get('source') == 'unknown':
                fact_source_text = fact.get('source_text', '').lower()
                
                # Try to match by document name keywords
                matched = False
                for doc_name, source in doc_source_map.items():
                    doc_keywords = doc_name.replace('_', ' ').replace('-', ' ').split()
                    if any(keyword in fact_source_text for keyword in doc_keywords if len(keyword) > 3):
                        fact['source'] = source
                        matched = True
                        break
                
                # If still not matched, try to match by text content similarity
                if not matched and fact_source_text:
                    for source, text_sample in doc_text_samples.items():
                        # Check if any significant words from fact appear in document
                        fact_words = set([w for w in fact_source_text.split() if len(w) > 4])
                        doc_words = set([w for w in text_sample.split() if len(w) > 4])
                        if fact_words and len(fact_words.intersection(doc_words)) >= 2:
                            fact['source'] = source
                            break
        
        # Normalize facts
        normalized_facts = normalize_facts(facts)
        
        # Detect conflicts
        conflicts = detect_conflicts(normalized_facts)
        
        return {
            'facts': normalized_facts,
            'conflicts': conflicts
        }
    
    except MemoryError as mem_error:
        error_msg = f"Insufficient memory during OpenAI API call. Try reducing the number of images or files."
        logger.error(error_msg, exc_info=True)
        print(f"Memory error in extract_facts_from_documents: {mem_error}")
        import traceback
        print(f"ERROR: Traceback: {traceback.format_exc()}")
        raise Exception(error_msg)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error in extract_facts_from_documents: {error_msg}", exc_info=True)
        print(f"Error in extract_facts_from_documents: {error_msg}")
        import traceback
        print(f"ERROR: Traceback: {traceback.format_exc()}")
        raise Exception(f"Fact extraction failed: {error_msg}")

