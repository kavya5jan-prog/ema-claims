"""
Image processing service.
"""
import base64
from io import BytesIO
from typing import Optional, Tuple
from PIL import Image
from app.config import Config


def optimize_image(pil_image: Image.Image) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Optimize image for memory efficiency: resize if needed, convert to JPEG, compress.
    
    Args:
        pil_image: PIL Image object
        
    Returns:
        Tuple of (optimized_image_bytes, mime_type) or (None, None) if optimization fails
    """
    try:
        # Convert RGBA to RGB if needed (JPEG doesn't support transparency)
        if pil_image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            rgb_image = Image.new('RGB', pil_image.size, (255, 255, 255))
            if pil_image.mode == 'P':
                pil_image = pil_image.convert('RGBA')
            rgb_image.paste(pil_image, mask=pil_image.split()[-1] if pil_image.mode in ('RGBA', 'LA') else None)
            pil_image = rgb_image
        elif pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Resize if dimensions exceed maximum
        width, height = pil_image.size
        if width > Config.MAX_IMAGE_DIMENSION or height > Config.MAX_IMAGE_DIMENSION:
            # Calculate new dimensions maintaining aspect ratio
            ratio = min(Config.MAX_IMAGE_DIMENSION / width, Config.MAX_IMAGE_DIMENSION / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Compress to JPEG with quality setting
        img_buffer = BytesIO()
        pil_image.save(img_buffer, format='JPEG', quality=Config.JPEG_QUALITY, optimize=True)
        img_bytes = img_buffer.getvalue()
        
        # Check if image size exceeds limit
        if len(img_bytes) > Config.MAX_IMAGE_SIZE_BYTES:
            # Try reducing quality progressively
            for quality in [75, 65, 55, 45]:
                img_buffer = BytesIO()
                pil_image.save(img_buffer, format='JPEG', quality=quality, optimize=True)
                img_bytes = img_buffer.getvalue()
                if len(img_bytes) <= Config.MAX_IMAGE_SIZE_BYTES:
                    break
            
            # If still too large, resize further
            if len(img_bytes) > Config.MAX_IMAGE_SIZE_BYTES:
                current_width, current_height = pil_image.size
                scale_factor = (Config.MAX_IMAGE_SIZE_BYTES / len(img_bytes)) ** 0.5
                new_width = max(100, int(current_width * scale_factor))
                new_height = max(100, int(current_height * scale_factor))
                pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                img_buffer = BytesIO()
                pil_image.save(img_buffer, format='JPEG', quality=Config.JPEG_QUALITY, optimize=True)
                img_bytes = img_buffer.getvalue()
        
        return img_bytes, 'image/jpeg'
    
    except Exception as e:
        print(f"Error optimizing image: {str(e)}")
        return None, None


def extract_image_content(image_path: str) -> dict:
    """
    Extract content from an image file with memory optimization.
    
    Args:
        image_path: Path to image file
        
    Returns:
        Dictionary with image data
    """
    try:
        with Image.open(image_path) as img:
            # Get original image dimensions
            original_width, original_height = img.size
            
            # Optimize image (resize if needed, compress, convert to JPEG)
            img_bytes, mime_type = optimize_image(img.copy())
            
            if not img_bytes or not mime_type:
                raise Exception('Failed to optimize image')
            
            # Get final dimensions after optimization
            optimized_img = Image.open(BytesIO(img_bytes))
            final_width, final_height = optimized_img.size
            optimized_img.close()
            
            # Convert to base64
            image_base64 = base64.b64encode(img_bytes).decode('utf-8')
            
            # Check size limit
            if len(img_bytes) > Config.MAX_IMAGE_SIZE_BYTES:
                print(f"Warning: Image {image_path} size ({len(img_bytes)} bytes) exceeds limit ({Config.MAX_IMAGE_SIZE_BYTES} bytes)")
            
            return {
                'type': 'image',
                'filename': image_path.split('/')[-1],
                'data': f"data:{mime_type};base64,{image_base64}",
                'format': 'jpg',
                'original_dimensions': {
                    'width': original_width,
                    'height': original_height
                },
                'optimized_dimensions': {
                    'width': final_width,
                    'height': final_height
                },
                'size_bytes': len(img_bytes)
            }
    
    except Exception as e:
        print(f"Error extracting image content: {str(e)}")
        return {
            'type': 'image',
            'filename': image_path.split('/')[-1],
            'error': str(e)
        }


