"""
File handling utilities.
"""
from typing import Tuple
from app.services.openai_service import get_openai_service
from app.prompts import document_classification_prompt


def identify_document_source_from_filename(filename: str) -> str:
    """
    Map filename to source type based on filename keywords.
    
    Args:
        filename: Name of the file
        
    Returns:
        Document source type
    """
    filename_lower = filename.lower()
    if 'fnol' in filename_lower:
        return 'fnol'
    elif 'claimant' in filename_lower:
        return 'claimant'
    elif 'other_driver' in filename_lower or 'other driver' in filename_lower:
        return 'other_driver'
    elif 'police' in filename_lower:
        return 'police'
    elif 'repair' in filename_lower or 'estimate' in filename_lower:
        return 'repair_estimate'
    elif 'policy' in filename_lower or 'policy_document' in filename_lower:
        return 'policy'
    else:
        return 'unknown'


def identify_document_source_from_content(content_text: str, filename: str = '') -> Tuple[str, bool]:
    """
    Use OpenAI to classify document type from content.
    
    Args:
        content_text: Text content of the document
        filename: Name of the file
        
    Returns:
        Tuple of (doc_type, is_relevant)
    """
    openai_service = get_openai_service()
    if not openai_service.is_available():
        return ('unknown', False)
    
    if not content_text or len(content_text.strip()) < 50:
        # Not enough content to analyze
        return ('unknown', False)
    
    # Limit content to first 2000 characters for efficiency
    content_sample = content_text[:2000] if len(content_text) > 2000 else content_text
    
    full_prompt = document_classification_prompt + f"\n\nFilename: {filename}\n\nContent:\n{content_sample}"
    
    result = openai_service.call_with_json_response(
        system_prompt=None,
        user_content=full_prompt,
        max_tokens=500
    )
    
    if not result:
        return ('unknown', False)
    
    doc_type = result.get('document_type', 'unknown')
    confidence = result.get('confidence', 0.0)
    is_relevant = result.get('is_relevant', False)
    
    # Only return classification if confidence is reasonable
    if confidence >= 0.6 and doc_type != 'unknown':
        return (doc_type, is_relevant)
    else:
        # Even if type is unknown, check if content is relevant
        return ('unknown', is_relevant)


def identify_document_source(filename: str, content: str = None) -> Tuple[str, bool]:
    """
    Map filename to source type, with optional content-based fallback.
    
    Args:
        filename: Name of the file
        content: Optional text content for content-based detection
        
    Returns:
        Tuple of (source, is_relevant)
    """
    # First try filename-based detection
    source = identify_document_source_from_filename(filename)
    is_relevant = False
    
    # If unknown and content provided, try content-based detection
    if source == 'unknown' and content:
        source, is_relevant = identify_document_source_from_content(content, filename)
    elif source != 'unknown':
        # If we matched by filename, assume it's relevant
        is_relevant = True
    
    return (source, is_relevant)


