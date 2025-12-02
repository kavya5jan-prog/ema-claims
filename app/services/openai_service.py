"""
OpenAI service for centralized API calls.
"""
import json
import re
from typing import Optional, Dict, Any, List, Union
from openai import OpenAI
from app.config import Config


class OpenAIService:
    """Service for OpenAI API interactions."""
    
    def __init__(self):
        """Initialize OpenAI client."""
        self.client = None
        if Config.OPENAI_API_KEY:
            try:
                self.client = OpenAI(api_key=Config.OPENAI_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize OpenAI client: {str(e)}")
        else:
            print("Warning: OPENAI_API_KEY not found in environment variables")
    
    def is_available(self) -> bool:
        """Check if OpenAI client is available."""
        return self.client is not None
    
    def call_openai(
        self,
        user_content: Union[str, List[Dict[str, Any]]],
        system_prompt: Optional[str] = None,
        response_format: Optional[Dict[str, str]] = None,
        max_tokens: int = 4000,
        model: str = "gpt-4o"
    ) -> Optional[str]:
        """
        Make a call to OpenAI API.
        
        Args:
            user_content: User content (string or list of content parts)
            system_prompt: Optional system prompt
            response_format: Optional response format (e.g., {"type": "json_object"})
            max_tokens: Maximum tokens in response
            model: Model to use
            
        Returns:
            Response text or None if error
        """
        if not self.client:
            return None
        
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            if isinstance(user_content, str):
                messages.append({"role": "user", "content": user_content})
            else:
                # For multimodal content (text + images)
                messages.append({"role": "user", "content": user_content})
            
            params = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens
            }
            
            if response_format:
                params["response_format"] = response_format
            
            response = self.client.chat.completions.create(**params)
            content = response.choices[0].message.content
            
            # Explicit check for None content
            if content is None:
                error_msg = "OpenAI API returned None for message content. This may occur if the response was filtered or the model refused to respond."
                print(f"Warning: {error_msg}")
                raise ValueError(error_msg)
            
            return content
        
        except ValueError:
            # Re-raise ValueError (e.g., when content is None) so it can be handled upstream
            raise
        except Exception as e:
            print(f"Warning: OpenAI API call failed: {str(e)}")
            return None
    
    def parse_json_response(
        self,
        response_text: Optional[str],
        fallback_parsing: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Parse JSON response from OpenAI.
        
        Args:
            response_text: Response text from OpenAI
            fallback_parsing: If True, try to extract JSON from text if direct parse fails
            
        Returns:
            Parsed JSON dict or None if parsing fails
        """
        # Explicit None check to prevent json.loads() from receiving None
        if response_text is None:
            return None
        
        # Check for empty string
        if not response_text.strip():
            return None
        
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            if fallback_parsing:
                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    try:
                        return json.loads(json_match.group())
                    except json.JSONDecodeError:
                        pass
            return None
    
    def call_with_json_response(
        self,
        system_prompt: Optional[str],
        user_content: Union[str, List[Dict[str, Any]]],
        max_tokens: int = 4000,
        model: str = "gpt-4o"
    ) -> Optional[Dict[str, Any]]:
        """
        Call OpenAI and parse JSON response.
        
        Args:
            system_prompt: Optional system prompt
            user_content: User content
            max_tokens: Maximum tokens
            model: Model to use
            
        Returns:
            Parsed JSON dict or None if error
        """
        response_text = self.call_openai(
            system_prompt=system_prompt,
            user_content=user_content,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
            model=model
        )
        
        # Defensive check: validate response before parsing
        if response_text is None:
            raise ValueError("OpenAI API returned None response. The API call may have failed or the response was empty.")
        
        if not isinstance(response_text, str):
            raise TypeError(f"Expected string response from OpenAI API, but got {type(response_text).__name__}")
        
        return self.parse_json_response(response_text, fallback_parsing=True)
    
    def call_with_text_response(
        self,
        system_prompt: Optional[str],
        user_content: Union[str, List[Dict[str, Any]]],
        max_tokens: int = 2000,
        model: str = "gpt-4o"
    ) -> Optional[str]:
        """
        Call OpenAI and return text response (no JSON format).
        
        Args:
            system_prompt: Optional system prompt
            user_content: User content
            max_tokens: Maximum tokens
            model: Model to use
            
        Returns:
            Response text or None if error
        """
        return self.call_openai(
            system_prompt=system_prompt,
            user_content=user_content,
            response_format=None,
            max_tokens=max_tokens,
            model=model
        )


# Global instance
_openai_service = None


def get_openai_service() -> OpenAIService:
    """Get global OpenAI service instance."""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service


