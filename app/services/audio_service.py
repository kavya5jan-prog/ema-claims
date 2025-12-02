"""
Audio processing service for transcription using OpenAI Whisper API.
"""
from typing import Optional
from app.services.openai_service import get_openai_service


def transcribe_audio(audio_file_path: str) -> Optional[str]:
    """
    Transcribe audio file using OpenAI Whisper API.
    
    Args:
        audio_file_path: Path to the audio file
        
    Returns:
        Transcription text or None if error
    """
    openai_service = get_openai_service()
    if not openai_service.is_available():
        raise Exception('OpenAI API key not configured')
    
    try:
        if not openai_service.client:
            raise Exception('OpenAI client not available')
        
        # Open audio file and transcribe
        with open(audio_file_path, 'rb') as audio_file:
            transcription = openai_service.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        
        return transcription.text
    
    except Exception as e:
        error_msg = str(e)
        print(f"Error in transcribe_audio: {error_msg}")
        raise Exception(f"Audio transcription failed: {error_msg}")

