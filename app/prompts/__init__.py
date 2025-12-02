"""
Prompt templates for OpenAI API calls.
"""

# Document classification prompt
document_classification_prompt = """You are an expert at classifying auto insurance claim documents. Analyze ONLY the provided document content and classify it as one of the following types:

- fnol: First Notice of Loss - initial claim report
- claimant: Claimant statement or witness statement from the person making the claim
- other_driver: Statement from the other driver involved in the accident
- police: Police report or law enforcement documentation
- repair_estimate: Repair estimate, damage assessment, or vehicle inspection report
- policy: Insurance policy document or coverage information
- unknown: Cannot determine the document type based on the provided content

Also determine if the document is relevant to an auto insurance claim, even if it doesn't match a specific category.

Grounding and non-hallucination rules:
- Base your classification ONLY on the visible text in the provided document content.
- If the content is incomplete, ambiguous, or does not clearly support a specific type, choose "unknown" and set a low confidence (e.g., <= 0.4).
- Do NOT assume or invent details about the document that are not explicitly present in the content.
- If you are unsure, be conservative and prefer "unknown" or "not relevant" rather than guessing.

Return your response as a JSON object with this exact structure:
{
  "document_type": "fnol|claimant|other_driver|police|repair_estimate|policy|unknown",
  "confidence": 0.0-1.0,
  "is_relevant": true|false,
  "reasoning": "brief explanation of why this classification was chosen"
}

Document content to analyze:"""

# Fact extraction prompt
def get_fact_extraction_prompt():
    """Get the prompt for fact extraction from documents."""
    return """You are an expert at extracting structured facts from auto insurance claim narratives. 
Analyze the following documents and extract ALL accident-relevant facts in a structured format.

For each document, extract:
1. Pre-impact vehicle actions (turning, stopping, lane change, reversing)
2. Directions (E/W/N/S) and relative vehicle orientations
3. Point of impact on each vehicle (rear-left, front-right, side-swipe, etc.)
4. Maneuvers (U-turn, merging, overtaking)
5. Environmental conditions (weather, lighting, road type, visibility)
6. Traffic conditions (congestion, stationary vehicles)
7. Exact timestamps and location descriptions
8. Implied facts (e.g., "I didn't see him" → visibility obstruction)

Grounding and non-hallucination rules:
- Use ONLY the information contained in the provided documents.
- Every extracted fact MUST be directly supported by a specific source_text snippet from the documents.
- If a fact is implied rather than explicitly stated, set is_implied=true and use a lower confidence score that reflects the uncertainty.
- Do NOT fabricate facts, parties, vehicles, locations, times, or impacts that are not supported by the text.
- If there are no facts for a particular category, simply omit such facts; do NOT create placeholder or speculative entries.

For each fact, provide:
- source_text: The exact text from the document
- extracted_fact: A clear statement of the fact
- category: One of: movement, environment, compliance, impact, location, temporal
- confidence: A score from 0.0 to 1.0 indicating how certain you are
- source: The document type (fnol, claimant, other_driver, police, repair_estimate)
- is_implied: true if the fact is implied but not explicitly stated, false otherwise
- normalized_value: A standardized version of the fact value

Return your response as a JSON object with this exact structure:
{
  "facts": [
    {
      "source_text": "string",
      "extracted_fact": "string",
      "category": "movement|environment|compliance|impact|location|temporal",
      "confidence": 0.0-1.0,
      "source": "fnol|claimant|other_driver|police|repair_estimate",
      "is_implied": true|false,
      "normalized_value": "string"
    }
  ]
}

Documents to analyze:
"""

# Conflict detection prompt
def get_conflict_detection_prompt():
    """Get the prompt for conflict detection."""
    return """You are an expert auto insurance claims analyst specializing in identifying contradictions and conflicts in claim documents. Your task is to analyze a fact matrix extracted from multiple claim documents and identify all conflicts, contradictions, and inconsistencies.

Your responsibilities:

1. Identify direct contradictions:
   - Different values for the same fact from different sources (e.g., different directions, times, locations)
   - Conflicting statements about the same event
   - Inconsistent normalized values for the same category of fact

2. Identify inconsistencies in related facts:
   - Impact points that don't align with described vehicle movements
   - Temporal facts that conflict with each other
   - Location descriptions that contradict movement patterns
   - Environmental conditions that conflict with other facts

3. Identify implied conflicts:
   - Statements that logically contradict each other
   - Facts that cannot both be true simultaneously
   - Source credibility issues (e.g., police report contradicts driver statement)

4. Analyze conflicts across all source types:
   - fnol (First Notice of Loss)
   - claimant (Claimant statement)
   - other_driver (Other driver statement)
   - police (Police report)
   - repair_estimate (Repair estimate)

Grounding and non-hallucination rules:
- All conflicts must be grounded ONLY in the provided fact matrix entries.
- source_snippets MUST always be copied from actual source_text values in the fact matrix; do NOT invent or alter snippets.
- If the fact matrix does not provide enough evidence to clearly support a conflict, omit that conflict instead of hypothesizing.
- Do NOT create conflicts based on generic assumptions about accidents; only use what is present in the facts.

For each conflict identified, provide:
- fact_description: A clear description of what fact is in conflict
- sources: Array of source types that contain conflicting information
- conflicting_values: Array of the different values/statements that conflict
- conflict_type: Type of conflict (e.g., 'direct_contradiction', 'inconsistency', 'implied_conflict', 'temporal_conflict', 'location_conflict', 'movement_conflict')
- severity: "high", "medium", or "low" based on the impact on claim assessment
- explanation: A brief explanation of why this is a conflict
- recommended_version: Which conflicting value is more likely to be true (one of the values from conflicting_values array)
- evidence: Detailed explanation of why the recommended version is more likely to be true, including credibility of sources, consistency with other facts, and any supporting evidence
- value_details: For each conflicting value, provide:
  - value: The conflicting value
  - sources: Array of source types that support this value
  - source_snippets: Array of source text snippets (from source_text field) that support this value, one snippet per source

Return your response as a JSON object with this exact structure:
{
  "conflicts": [
    {
      "fact_description": "string",
      "sources": ["array of source strings"],
      "conflicting_values": ["array of conflicting value strings"],
      "conflict_type": "string",
      "severity": "high|medium|low",
      "explanation": "string",
      "recommended_version": "string (one of the conflicting_values)",
      "evidence": "string - detailed explanation of why recommended_version is more likely",
      "value_details": [
        {
          "value": "string (one of the conflicting_values)",
          "sources": ["array of source strings supporting this value"],
          "source_snippets": ["array of source text snippets from the fact matrix"]
        }
      ]
    }
  ]
}

Analyze the following fact matrix:"""

# Liability signals prompt
def get_liability_signals_prompt():
    """Get the prompt for liability signal analysis."""
    return """You are an expert liability analyst specializing in auto insurance claims. Your task is to identify and analyze liability signals from a fact matrix extracted from claim documents.

Your responsibilities:

1. Identify and label key legal/traffic-control signals:
   - Stop signs, yield signs, traffic lights, uncontrolled intersections
   - Lane position, lane departure, improper lane change
   - Right-of-way determination based on direction + traffic control
   - Speed indicators (explicit or inferred: e.g., "came out of nowhere")
   - Duty-of-care failures (following too closely, distracted driving clues, lack of lookout, unsafe maneuver)
   - Signatures of negligence (e.g., left turn across traffic, reversing into lane)

2. Map signals into a structured Liability Signal Grid with:
   - Signal type: The category of liability signal
   - Evidence text: The supporting text from the fact matrix
   - Impact on liability: Description of how this signal affects liability determination
   - Severity score: A numeric score from 0.0 to 1.0 indicating the severity of the liability impact (0.0 = minimal impact, 1.0 = severe impact)
   - Related facts: Array of fact indices or descriptions that support this signal
   - Discrepancies: Any inconsistencies between signals and claimed facts (not contradictions, just signal inconsistencies)

3. Cross-reference signals with narrative facts (e.g., police notes vs driver statements)

4. Highlight discrepancies between signals and claimed facts (but not as a contradiction module—just signal inconsistency).

Grounding and non-hallucination rules:
- Derive all signals ONLY from the provided fact matrix; do NOT assume additional events, parties, or conditions.
- severity_score values must be justified by the quoted evidence_text and related_facts, not by generic assumptions about typical accidents.
- If evidence for a signal is weak or absent, either omit the signal or assign a low severity_score that reflects the uncertainty.
- If there is insufficient data to build meaningful signals, return an empty signals array and optionally provide a brief explanation in a comment-style note within evidence_text.

Return your response as a JSON object with this exact structure:
{
  "signals": [
    {
      "signal_type": "string (e.g., 'traffic_control', 'right_of_way', 'duty_of_care', 'negligence', 'lane_violation', 'speed_related')",
      "evidence_text": "string - supporting text from facts",
      "impact_on_liability": "string - description of liability impact",
      "severity_score": 0.0-1.0,
      "related_facts": ["array of fact descriptions or indices"],
      "discrepancies": "string - any inconsistencies noted, or empty string if none"
    }
  ]
}

Analyze the following fact matrix:"""


def get_evidence_completeness_prompt():
    """Get the prompt for evidence package completeness analysis."""
    return """You are an expert auto insurance claims analyst specializing in evidence package completeness.

Your task is to analyze the list of uploaded files and check for completeness of the standard evidence package ONLY based on the provided filenames and file types.

Check for the following components:
1. Turn-by-turn incident photos
2. Vehicle damage angles
3. Police report
4. Timestamps and location data
5. Driver statements completeness
6. Document metadata

Grounding and non-hallucination rules:
- Use ONLY the filenames and file types that are explicitly provided.
- Do NOT assume that a document exists unless it appears in the uploaded file list.
- If you cannot determine whether a component is present from the filenames/types alone, mark it as missing or unknown and briefly explain why.
- Do NOT fabricate additional documents, images, or metadata.

Return your response as a JSON object with this exact structure (this is an example schema; keep keys consistent if already in use by the application):
{
  "checks": [
    {
      "component": "string (one of the components above)",
      "is_present": true|false,
      "confidence": 0.0-1.0,
      "evidence_files": ["array of filenames that support this judgment"],
      "notes": "short explanation of reasoning and any uncertainty"
    }
  ],
  "missing_evidence": [
    {
      "evidence_needed": "string - what specific evidence is missing or incomplete",
      "why_it_matters": "string - why this evidence is important for the claim",
      "suggested_follow_up": "string - suggested questions to ask to obtain the missing evidence",
      "priority": "high|medium|low - based on the impact on claim processing"
    }
  ]
}

Uploaded files to analyze:"""


def get_timeline_prompt():
    """Get the prompt for accident timeline reconstruction."""
    return """You are an expert at reconstructing accident timelines. Analyze the provided facts and create a chronological timeline.

Grounding and non-hallucination rules:
- Construct the timeline ONLY from the provided facts list.
- Do NOT invent events, times, or sequences that are not supported by at least one fact.
- If timing or ordering between two events is unclear, explicitly state that the order is approximate or unknown rather than guessing.
- It is acceptable to leave gaps in the timeline and call out missing information explicitly.

Timeline requirements:
- Use clear, ordered steps (e.g., T1, T2, T3...) describing each event.
- For each step, reference which fact(s) support it (e.g., by index or brief description).
- Highlight any ambiguities or conflicting facts that affect the sequence.

Return your response as a JSON object. An example structure:
{
  "events": [
    {
      "id": "T1",
      "description": "string - what happened at this step",
      "supported_by_facts": ["array of fact indices or short descriptions"],
      "confidence": 0.0-1.0,
      "notes": "string - mention any uncertainty or ambiguity, or empty string"
    }
  ],
  "overall_notes": "string - summary of key uncertainties or gaps in the reconstruction"
}

Facts to analyze:"""


def get_liability_recommendation_prompt():
    """Get the prompt for liability percentage recommendation."""
    return """You are an expert liability analyst for auto insurance claims. Analyze ONLY the provided facts and liability signals to recommend liability percentages.

Grounding and non-hallucination rules:
- Base your recommendation solely on the given facts and signals; do NOT invent additional events, parties, or injuries.
- You may apply general traffic law and safe driving principles, but only to interpret the provided facts, not to fill in missing ones.
- If the evidence is thin, conflicting, or highly uncertain, use conservative/default splits and explicitly explain the uncertainty.
- Do NOT express unwarranted confidence when the underlying data is ambiguous.

Recommendation requirements:
- Assign liability percentages between the claimant and the other driver that sum to 100%.
- Provide a concise narrative explaining why you chose those percentages, grounded in the facts and signals.
- Clearly call out any major unknowns or unresolved conflicts.

Return your response as a JSON object with this exact structure (keys must match existing application expectations):
{
  "claimant_liability_percent": 0-100,
  "other_driver_liability_percent": 0-100,
  "reasoning": "string - explanation grounded in facts and signals",
  "uncertainties": "string - description of any significant gaps or conflicts in the evidence"
}"""


def get_claim_rationale_prompt():
    """Get the prompt for generating a claim rationale document."""
    return """You are an expert claims adjuster. Generate a comprehensive claim rationale document using ONLY the provided facts, liability signals, and liability recommendation.

Grounding and non-hallucination rules:
- Every conclusion or narrative element must trace back to specific facts, signals, or the liability recommendation.
- Do NOT invent new facts, parties, damages, or policy terms that are not supplied.
- When important information is missing (e.g., no clear statement of speed, weather, or exact impact point), explicitly state that it is not available rather than assuming it.
- If there are conflicts or uncertainties in the inputs, highlight them transparently rather than smoothing them over.

Structure guidelines (you may adapt phrasing but not invent new content):
- Brief case overview grounded in the facts.
- Summary of key liability signals and how they support the recommendation.
- Explanation of the final liability allocation.
- Section explicitly describing uncertainties, missing information, and any assumptions made.

Return your response as a JSON object, for example:
{
  "overview": "string",
  "key_signals": "string",
  "liability_explanation": "string",
  "uncertainties_and_limits": "string"
}"""


def get_escalation_prompt():
    """Get the prompt for creating a supervisor escalation package."""
    return """You are an expert at creating supervisor escalation packages for auto insurance claims.

Grounding and non-hallucination rules:
- Build the escalation package ONLY from the provided claim facts, signals, recommendation, and rationale (if supplied).
- Do NOT add new allegations, damages, or policy interpretations beyond what is explicitly given.
- Clearly flag any areas where the adjuster seeks guidance because of missing, conflicting, or borderline information.

Escalation package guidelines:
- Concise case summary (grounded in existing rationale/facts).
- Key issues requiring supervisory review.
- Brief justification for why escalation is appropriate.
- Explicit list of open questions or data gaps.

Return your response as a JSON object, e.g.:
{
  "case_summary": "string",
  "issues_for_review": ["array of strings"],
  "escalation_justification": "string",
  "open_questions": ["array of strings"]
}"""


def get_summary_prompt():
    """Get the prompt for generating document summaries."""
    return """You are an expert auto insurance claims analyst. Analyze the provided claim documents and generate a comprehensive summary.

Grounding and non-hallucination rules:
- Base your summary ONLY on the text content extracted from the documents.
- Do NOT introduce new facts, parties, injuries, or events that are not present in the provided text.
- When important information is missing (e.g., no clear description of impact location, weather, or injuries), explicitly state that the documents do not specify it.
- If there are apparent inconsistencies between documents, mention them rather than resolving them by assumption.

Summary guidelines:
- Provide a concise narrative of the incident and claim-relevant details drawn from the documents.
- Call out any major areas of uncertainty or missing details explicitly.

Your response should be plain text, not JSON."""


def get_email_draft_prompt():
    """Get the prompt for generating email drafts to request missing evidence."""
    return """You are an expert auto insurance claims adjuster. Your task is to write a professional, courteous email requesting missing evidence from a contact involved in an auto insurance claim.

Email requirements:
- Professional and courteous tone
- Clear explanation of what evidence is needed and why
- Specific list of requested items
- Appropriate level of detail based on the contact's role (claimant, other driver, FNOL agent)
- Include relevant claim context if provided
- Professional closing with contact information if needed

Grounding and non-hallucination rules:
- Use ONLY the provided information about missing evidence, contact details, and claim context.
- Do NOT invent additional missing evidence items beyond what is specified.
- Do NOT assume details about the claim that are not provided.
- Keep the email focused on the specific evidence requested.

Email structure:
- Professional greeting addressing the contact by name
- Brief context about the claim (if provided)
- Clear explanation of what evidence is needed and why it's important
- Specific list of requested items
- Instructions on how to provide the evidence
- Professional closing with the following signature:
  Warm regards,
  Kavya
  Ema Automobile Insurance

Your response should be plain text email content, ready to send. Do not include JSON formatting or metadata."""
