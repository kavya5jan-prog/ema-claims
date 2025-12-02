"""
Fact processing utilities.
"""
import re
from typing import List, Dict, Any
from app.services.openai_service import get_openai_service
from app.prompts import get_conflict_detection_prompt


def normalize_facts(facts_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Unify conflicting facts into standard schema.
    
    Args:
        facts_list: List of fact dictionaries
        
    Returns:
        List of normalized fact dictionaries
    """
    normalized_facts = []
    
    for fact in facts_list:
        normalized = fact.copy()
        
        # Normalize directions
        if 'normalized_value' in fact and fact.get('category') == 'location':
            direction = fact.get('normalized_value', '').lower()
            direction_mapping = {
                'north': 'N', 'south': 'S', 'east': 'E', 'west': 'W',
                'northeast': 'NE', 'northwest': 'NW',
                'southeast': 'SE', 'southwest': 'SW'
            }
            for key, value in direction_mapping.items():
                if key in direction:
                    normalized['normalized_value'] = value
                    break
        
        # Normalize impact points
        if fact.get('category') == 'impact':
            impact = fact.get('normalized_value', '').lower()
            impact = impact.replace('-', '_').replace(' ', '_')
            normalized['normalized_value'] = impact
        
        # Normalize time formats
        if fact.get('category') == 'temporal':
            time_value = fact.get('normalized_value', '')
            # Try to extract and normalize time format
            time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?', time_value)
            if time_match:
                hour = int(time_match.group(1))
                minute = time_match.group(2)
                period = time_match.group(3) or ''
                if period:
                    normalized['normalized_value'] = f"{hour:02d}:{minute} {period.upper()}"
                else:
                    normalized['normalized_value'] = f"{hour:02d}:{minute}"
        
        normalized_facts.append(normalized)
    
    return normalized_facts


def detect_conflicts(facts_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identify contradictions across sources using OpenAI.
    
    Args:
        facts_list: List of fact dictionaries
        
    Returns:
        List of conflict dictionaries
    """
    openai_service = get_openai_service()
    if not openai_service.is_available():
        # Fallback: return empty conflicts if OpenAI is not available
        return []
    
    if not facts_list or len(facts_list) < 2:
        # Need at least 2 facts to have conflicts
        return []
    
    # Format facts for the prompt
    facts_text = "\n\nFact Matrix:\n"
    for idx, fact in enumerate(facts_list):
        facts_text += f"\nFact {idx + 1}:\n"
        facts_text += f"  Source Text: {fact.get('source_text', 'N/A')}\n"
        facts_text += f"  Extracted Fact: {fact.get('extracted_fact', 'N/A')}\n"
        facts_text += f"  Category: {fact.get('category', 'N/A')}\n"
        facts_text += f"  Source: {fact.get('source', 'N/A')}\n"
        facts_text += f"  Confidence: {fact.get('confidence', 0)}\n"
        if fact.get('normalized_value'):
            facts_text += f"  Normalized Value: {fact.get('normalized_value')}\n"
        if fact.get('is_implied'):
            facts_text += f"  Is Implied: {fact.get('is_implied')}\n"
    
    # Prepare content for OpenAI
    system_prompt = get_conflict_detection_prompt()
    full_prompt = system_prompt + facts_text
    
    # Call OpenAI API with JSON mode
    result = openai_service.call_with_json_response(
        system_prompt=None,
        user_content=full_prompt,
        max_tokens=4000
    )
    
    if not result:
        return []
    
    conflicts = result.get('conflicts', [])
    
    # Ensure backward compatibility: map to expected format
    # Frontend expects: fact_description, sources, conflicting_values
    # Additional fields are optional enhancements
    formatted_conflicts = []
    for conflict in conflicts:
        # Match source snippets to actual facts from the fact matrix
        value_details = conflict.get('value_details', [])
        enhanced_value_details = []
        
        for value_detail in value_details:
            value = value_detail.get('value', '')
            detail_sources = value_detail.get('sources', [])
            ai_snippets = value_detail.get('source_snippets', [])
            
            # Find matching facts from the fact matrix
            matching_facts = []
            for fact in facts_list:
                fact_source = fact.get('source', '')
                fact_value = fact.get('normalized_value', '') or fact.get('extracted_fact', '')
                
                # Check if this fact matches the value and source
                if fact_source in detail_sources:
                    # Check if the fact's value matches (fuzzy match)
                    if value.lower() in fact_value.lower() or fact_value.lower() in value.lower():
                        matching_facts.append(fact)
            
            # Use AI-provided snippets if available, otherwise use source_text from matching facts
            final_snippets = []
            if ai_snippets:
                final_snippets = ai_snippets
            else:
                # Fallback: use source_text from matching facts
                for fact in matching_facts[:3]:  # Limit to 3 snippets
                    snippet = fact.get('source_text', '')
                    if snippet and snippet not in final_snippets:
                        final_snippets.append(snippet[:200])  # Limit snippet length
            
            enhanced_value_details.append({
                'value': value,
                'sources': detail_sources,
                'source_snippets': final_snippets
            })
        
        formatted_conflicts.append({
            'fact_description': conflict.get('fact_description', ''),
            'sources': conflict.get('sources', []),
            'conflicting_values': conflict.get('conflicting_values', []),
            'conflict_type': conflict.get('conflict_type', ''),
            'severity': conflict.get('severity', 'medium'),
            'explanation': conflict.get('explanation', ''),
            'recommended_version': conflict.get('recommended_version', ''),
            'evidence': conflict.get('evidence', ''),
            'value_details': enhanced_value_details
        })
    
    return formatted_conflicts


