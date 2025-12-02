"""
OpenAI service for centralized API calls.
"""
import json
import re
import logging
from typing import Optional, Dict, Any, List, Union
from openai import OpenAI
from app.config import Config

# Set up logging
logger = logging.getLogger(__name__)


class OpenAIService:
    """Service for OpenAI API interactions."""
    
    def __init__(self):
        """Initialize OpenAI client."""
        self.client = None
        if Config.OPENAI_API_KEY:
            try:
                self.client = OpenAI(api_key=Config.OPENAI_API_KEY)
                logger.info("OpenAI client initialized successfully")
                print("DEBUG: OpenAI client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
                print(f"Warning: Failed to initialize OpenAI client: {str(e)}")
        else:
            logger.warning("OPENAI_API_KEY not found in environment variables")
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
            error_msg = "OpenAI client is not initialized"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            return None
        
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
                logger.debug(f"Added system prompt (length: {len(system_prompt)})")
            
            if isinstance(user_content, str):
                messages.append({"role": "user", "content": user_content})
                logger.debug(f"Added string user content (length: {len(user_content)})")
            else:
                # For multimodal content (text + images)
                messages.append({"role": "user", "content": user_content})
                content_parts_count = len(user_content) if isinstance(user_content, list) else 1
                logger.debug(f"Added multimodal user content ({content_parts_count} parts)")
            
            params = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens
            }
            
            if response_format:
                params["response_format"] = response_format
            
            logger.info(f"Calling OpenAI API: model={model}, max_tokens={max_tokens}, response_format={response_format}")
            print(f"DEBUG: Calling OpenAI API with model={model}, max_tokens={max_tokens}, response_format={response_format}")
            
            response = self.client.chat.completions.create(**params)
            
            logger.debug(f"OpenAI API response received: type={type(response)}, has_choices={hasattr(response, 'choices')}")
            
            if not response:
                error_msg = "OpenAI API returned None response object"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(error_msg)
            
            if not hasattr(response, 'choices') or not response.choices:
                error_msg = "OpenAI API returned empty response or no choices"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(error_msg)
            
            if not response.choices[0]:
                error_msg = "OpenAI API response choices[0] is None"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(error_msg)
            
            if not hasattr(response.choices[0], 'message') or not response.choices[0].message:
                error_msg = "OpenAI API response missing message"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(error_msg)
            
            content = response.choices[0].message.content
            
            logger.debug(f"Extracted content from response: type={type(content)}, is_none={content is None}, length={len(content) if content else 0}")
            
            # Explicit check for None content
            if content is None:
                error_msg = "OpenAI API returned None for message content. This may occur if the response was filtered or the model refused to respond."
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise ValueError(error_msg)
            
            if not isinstance(content, str):
                error_msg = f"OpenAI API returned non-string content: {type(content).__name__}"
                logger.error(error_msg)
                print(f"ERROR: {error_msg}")
                raise TypeError(error_msg)
            
            logger.info(f"OpenAI API call successful, response length: {len(content)}")
            print(f"DEBUG: OpenAI API call successful, response length: {len(content)}")
            return content
        
        except ValueError as ve:
            # Re-raise ValueError (e.g., when content is None) so it can be handled upstream
            logger.error(f"ValueError in call_openai: {str(ve)}")
            raise
        except TypeError as te:
            # Re-raise TypeError
            logger.error(f"TypeError in call_openai: {str(te)}")
            raise
        except Exception as e:
            error_msg = f"OpenAI API call failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            print(f"ERROR: {error_msg}")
            import traceback
            print(f"ERROR: Traceback: {traceback.format_exc()}")
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
            Parsed JSON dict
            
        Raises:
            ValueError: If response_text is None, empty, or JSON parsing fails
            TypeError: If response_text is not a string
        """
        logger.debug(f"parse_json_response called with response_text type: {type(response_text).__name__}, is None: {response_text is None}")
        
        # Explicit None check to prevent json.loads() from receiving None
        if response_text is None:
            error_msg = "parse_json_response received None response_text"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise ValueError(f"OpenAI API error: {error_msg}")
        
        # Check for empty string
        if not isinstance(response_text, str):
            error_msg = f"parse_json_response received non-string type: {type(response_text).__name__}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise TypeError(f"OpenAI API error: {error_msg}")
        
        if not response_text.strip():
            error_msg = "parse_json_response received empty string"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise ValueError(f"OpenAI API error: {error_msg}")
        
        logger.debug(f"Parsing JSON response, length: {len(response_text)}, first 200 chars: {response_text[:200]}")
        print(f"DEBUG: Parsing JSON response, length: {len(response_text)}, first 200 chars: {response_text[:200]}")
        
        try:
            parsed = json.loads(response_text)
            logger.info("Successfully parsed JSON response")
            print(f"DEBUG: Successfully parsed JSON response")
            return parsed
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode error: {str(e)}")
            print(f"WARNING: JSON decode error: {str(e)}")
            if fallback_parsing:
                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    try:
                        match_text = json_match.group()
                        if match_text is None:
                            error_msg = "JSON regex match returned None"
                            logger.error(error_msg)
                            print(f"ERROR: {error_msg}")
                            raise ValueError(f"OpenAI API error: {error_msg}")
                        logger.debug(f"Attempting fallback JSON parsing on extracted text (length: {len(match_text)})")
                        parsed = json.loads(match_text)
                        logger.info("Successfully parsed JSON using fallback extraction")
                        print(f"DEBUG: Successfully parsed JSON using fallback extraction")
                        return parsed
                    except json.JSONDecodeError as fallback_error:
                        error_msg = f"Fallback JSON parsing also failed: {str(fallback_error)}"
                        logger.error(error_msg)
                        print(f"ERROR: {error_msg}")
                        raise ValueError(f"OpenAI API error: the JSON object must be str, bytes or bytearray, not NoneType. Original error: {str(fallback_error)}")
                    except Exception as fallback_error:
                        error_msg = f"Unexpected error during fallback parsing: {str(fallback_error)}"
                        logger.error(error_msg, exc_info=True)
                        print(f"ERROR: {error_msg}")
                        raise ValueError(f"OpenAI API error: {error_msg}")
            raise ValueError(f"OpenAI API error: the JSON object must be str, bytes or bytearray, not NoneType. JSON decode error: {str(e)}")
    
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
        logger.info(f"call_with_json_response called with system_prompt={system_prompt is not None}, user_content type={type(user_content).__name__}")
        print(f"DEBUG: call_with_json_response called with system_prompt={system_prompt is not None}, user_content type={type(user_content).__name__}")
        
        try:
            response_text = self.call_openai(
                system_prompt=system_prompt,
                user_content=user_content,
                response_format={"type": "json_object"},
                max_tokens=max_tokens,
                model=model
            )
        except (ValueError, TypeError) as e:
            # Re-raise these as they indicate API issues
            logger.error(f"call_openai raised {type(e).__name__}: {str(e)}")
            raise ValueError(f"OpenAI API error: {str(e)}")
        except Exception as e:
            error_msg = f"Unexpected error in call_openai: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise ValueError(f"OpenAI API error: {error_msg}")
        
        if response_text:
            preview = response_text[:100] if isinstance(response_text, str) else str(response_text)[:100]
        else:
            preview = None
        logger.debug(f"call_openai returned response_text type: {type(response_text).__name__}, is None: {response_text is None}, preview: {preview}")
        print(f"DEBUG: call_openai returned response_text type: {type(response_text).__name__}, preview: {preview}")
        
        # Defensive check: validate response before parsing
        if response_text is None:
            error_msg = "OpenAI API returned None response. The API call may have failed or the response was empty."
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise ValueError(f"OpenAI API error: {error_msg}")
        
        if not isinstance(response_text, str):
            error_msg = f"Expected string response from OpenAI API, but got {type(response_text).__name__}"
            logger.error(error_msg)
            print(f"ERROR: {error_msg}")
            raise TypeError(f"OpenAI API error: {error_msg}")
        
        try:
            result = self.parse_json_response(response_text, fallback_parsing=True)
            logger.debug(f"parse_json_response returned type: {type(result).__name__}, is None: {result is None}")
            print(f"DEBUG: parse_json_response returned type: {type(result).__name__}, is None: {result is None}")
            return result
        except (ValueError, TypeError) as e:
            # Re-raise with context
            logger.error(f"parse_json_response raised {type(e).__name__}: {str(e)}")
            raise
        except Exception as e:
            error_msg = f"Unexpected error in parse_json_response: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise ValueError(f"OpenAI API error: {error_msg}")
    
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


