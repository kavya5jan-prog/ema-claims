"""
Analysis routes (liability, timeline, etc.).
"""
import re
from flask import Blueprint, request, jsonify
from app.services.openai_service import get_openai_service
from app.prompts import (
    get_liability_signals_prompt,
    get_evidence_completeness_prompt,
    get_timeline_prompt,
    get_liability_recommendation_prompt,
    get_claim_rationale_prompt,
    get_escalation_prompt,
)

bp = Blueprint('analysis', __name__)


@bp.route('/analyze-liability-signals', methods=['POST'])
def analyze_liability_signals():
    """Analyze fact matrix to identify liability signals using OpenAI."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'}), 500
        
        # Get fact matrix data from request
        request_data = request.json
        facts = request_data.get('facts', [])
        
        if not facts:
            return jsonify({'error': 'No facts provided. Please extract facts first.'}), 400
        
        # Format facts for the prompt
        facts_text = "\n\nFact Matrix:\n"
        for idx, fact in enumerate(facts):
            facts_text += f"\nFact {idx + 1}:\n"
            facts_text += f"  Source Text: {fact.get('source_text', 'N/A')}\n"
            facts_text += f"  Extracted Fact: {fact.get('extracted_fact', 'N/A')}\n"
            facts_text += f"  Category: {fact.get('category', 'N/A')}\n"
            facts_text += f"  Source: {fact.get('source', 'N/A')}\n"
            facts_text += f"  Confidence: {fact.get('confidence', 0)}\n"
            if fact.get('normalized_value'):
                facts_text += f"  Normalized Value: {fact.get('normalized_value')}\n"
        
        # Prepare content for OpenAI
        system_prompt = get_liability_signals_prompt()
        
        # Call OpenAI API with JSON mode using system prompt for instructions
        result = openai_service.call_with_json_response(
            system_prompt=system_prompt,
            user_content=facts_text,
            max_tokens=4000
        )
        
        if not result:
            return jsonify({'error': 'Failed to get response from OpenAI'}), 500
        
        signals = result.get('signals', [])
        
        return jsonify({
            'signals': signals,
            'success': True
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Liability signals analysis failed: {str(e)}'}), 500


@bp.route('/check-evidence-completeness', methods=['POST'])
def check_evidence_completeness():
    """Check completeness of standard evidence package using OpenAI."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.'}), 500
        
        # Get files data from request
        request_data = request.json
        files = request_data.get('files', [])
        
        if not files:
            return jsonify({'error': 'No files provided. Please upload files first.'}), 400
        
        # Build system prompt for evidence completeness check
        system_prompt = get_evidence_completeness_prompt()
        
        # Format files for the prompt
        files_text = "\n\nUploaded Files:\n"
        for file_data in files:
            filename = file_data.get('filename', 'Unknown')
            file_type = file_data.get('type', 'unknown')
            files_text += f"\n{filename} ({file_type})\n"
        
        result = openai_service.call_with_json_response(
            system_prompt=system_prompt,
            user_content=files_text,
            max_tokens=4000
        )
        
        if not result:
            return jsonify({'error': 'Failed to get response from OpenAI'}), 500
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': f'Evidence completeness check failed: {str(e)}'}), 500


@bp.route('/generate-timeline', methods=['POST'])
def generate_timeline():
    """Generate timeline reconstruction from facts."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured.'}), 500
        
        request_data = request.json
        facts = request_data.get('facts', [])
        
        if not facts:
            return jsonify({'error': 'No facts provided. Please extract facts first.'}), 400
        
        system_prompt = get_timeline_prompt()
        
        facts_text = "\n\nFacts:\n"
        for idx, fact in enumerate(facts):
            facts_text += f"{idx + 1}. {fact.get('extracted_fact', 'N/A')}\n"
        
        result = openai_service.call_with_json_response(
            system_prompt=system_prompt,
            user_content=facts_text,
            max_tokens=4000
        )
        
        if not result:
            return jsonify({'error': 'Failed to get response from OpenAI'}), 500
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': f'Timeline generation failed: {str(e)}'}), 500


@bp.route('/get-liability-recommendation', methods=['POST'])
def get_liability_recommendation():
    """Get liability percentage recommendation."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured.'}), 500
        
        request_data = request.json
        facts = request_data.get('facts', [])
        signals = request_data.get('signals', [])
        
        if not facts:
            return jsonify({'error': 'No facts provided.'}), 400
        
        system_prompt = get_liability_recommendation_prompt()
        
        # Format facts and signals for the user content
        facts_text = "\n\nFacts:\n"
        for fact in facts:
            facts_text += f"- {fact.get('extracted_fact', 'N/A')}\n"
        
        signals_text = "\n\nSignals:\n"
        for signal in signals:
            signals_text += f"- {signal.get('signal_type', 'N/A')}: {signal.get('impact_on_liability', 'N/A')}\n"
        
        user_content = facts_text + signals_text
        
        result = openai_service.call_with_json_response(
            system_prompt=system_prompt,
            user_content=user_content,
            max_tokens=4000
        )
        
        if not result:
            return jsonify({'error': 'Failed to get response from OpenAI'}), 500
        
        # Validate percentages
        claimant_percent = result.get('claimant_liability_percent', 50)
        other_driver_percent = result.get('other_driver_liability_percent', 50)
        
        claimant_percent = max(0, min(100, int(round(claimant_percent))))
        other_driver_percent = max(0, min(100, int(round(other_driver_percent))))
        
        # Normalize to sum to 100
        total = claimant_percent + other_driver_percent
        if total > 0:
            claimant_percent = int(round(claimant_percent * 100 / total))
            other_driver_percent = 100 - claimant_percent
        
        result['claimant_liability_percent'] = claimant_percent
        result['other_driver_liability_percent'] = other_driver_percent
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': f'Liability recommendation failed: {str(e)}'}), 500


@bp.route('/generate-claim-rationale', methods=['POST'])
def generate_claim_rationale():
    """Generate claim rationale document."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured.'}), 500
        
        request_data = request.json
        facts = request_data.get('facts', [])
        signals = request_data.get('signals', [])
        recommendation = request_data.get('recommendation', {})
        
        system_prompt = get_claim_rationale_prompt()
        
        content_parts = [
            "Facts:",
            *[f"- {fact.get('extracted_fact', 'N/A')}" for fact in facts],
            "",
            "Signals:",
            *[f"- {signal.get('signal_type', 'N/A')}: {signal.get('impact_on_liability', 'N/A')}" for signal in signals],
            "",
            "Recommendation:",
            str(recommendation or {})
        ]
        user_content = "\n".join(content_parts)
        
        result = openai_service.call_with_json_response(
            system_prompt=system_prompt,
            user_content=user_content,
            max_tokens=4000
        )
        
        if not result:
            return jsonify({'error': 'Failed to get response from OpenAI'}), 500
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': f'Claim rationale generation failed: {str(e)}'}), 500


@bp.route('/generate-escalation-package', methods=['POST'])
def generate_escalation_package():
    """Generate supervisor escalation package."""
    try:
        openai_service = get_openai_service()
        if not openai_service.is_available():
            return jsonify({'error': 'OpenAI API key not configured.'}), 500
        
        request_data = request.json or {}
        facts = request_data.get('facts', [])
        signals = request_data.get('signals', [])
        recommendation = request_data.get('recommendation', {})
        rationale = request_data.get('rationale', {})
        
        system_prompt = get_escalation_prompt()
        
        content_parts = [
            "Facts:",
            *[f"- {fact.get('extracted_fact', 'N/A')}" for fact in facts],
            "",
            "Signals:",
            *[f"- {signal.get('signal_type', 'N/A')}: {signal.get('impact_on_liability', 'N/A')}" for signal in signals],
            "",
            "Recommendation:",
            str(recommendation or {}),
            "",
            "Rationale:",
            str(rationale or {})
        ]
        user_content = "\n".join(content_parts)
        
        result = openai_service.call_with_json_response(
            system_prompt=system_prompt,
            user_content=user_content,
            max_tokens=4000
        )
        
        if not result:
            return jsonify({'error': 'Failed to get response from OpenAI'}), 500
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': f'Escalation package generation failed: {str(e)}'}), 500
