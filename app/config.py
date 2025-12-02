"""
Application configuration.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration class."""
    
    # Flask configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # Upload folder configuration
    @staticmethod
    def get_upload_folder():
        """Get upload folder path based on environment."""
        if os.environ.get('VERCEL'):
            return '/tmp'
        else:
            upload_folder = 'uploads'
            try:
                os.makedirs(upload_folder, exist_ok=True)
            except OSError as e:
                print(f"Warning: Could not create uploads directory: {str(e)}")
                upload_folder = '/tmp'
                print(f"Using fallback upload folder: {upload_folder}")
            return upload_folder
    
    # UPLOAD_FOLDER will be set dynamically via get_upload_folder()
    
    # OpenAI configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    
    # Image processing configuration (memory optimization)
    IMAGE_DPI = int(os.getenv('IMAGE_DPI', '72'))
    MAX_IMAGE_DIMENSION = int(os.getenv('MAX_IMAGE_DIMENSION', '2048'))
    MAX_IMAGE_SIZE_MB = float(os.getenv('MAX_IMAGE_SIZE_MB', '2.0'))
    MAX_IMAGE_SIZE_BYTES = int(MAX_IMAGE_SIZE_MB * 1024 * 1024)
    MAX_IMAGES_PER_PAGE = int(os.getenv('MAX_IMAGES_PER_PAGE', '5'))
    MAX_IMAGES_PER_PDF = int(os.getenv('MAX_IMAGES_PER_PDF', '20'))
    MAX_TOTAL_IMAGES_PER_REQUEST = int(os.getenv('MAX_TOTAL_IMAGES_PER_REQUEST', '50'))
    JPEG_QUALITY = int(os.getenv('JPEG_QUALITY', '85'))

