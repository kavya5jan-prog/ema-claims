"""
PDF extraction service.
"""
import base64
from io import BytesIO
from typing import Dict, List
import pdfplumber
import PyPDF2
from PIL import Image
from app.config import Config
from app.services.image_service import optimize_image


def extract_pdf_content(pdf_path: str) -> Dict:
    """
    Extract full content from PDF including text, images, and metadata.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Dictionary with page-by-page content
    """
    result = {
        'pages': [],
        'metadata': {
            'page_count': 0,
            'title': '',
            'author': '',
            'subject': '',
        }
    }
    
    # Extract text and metadata using pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        result['metadata']['page_count'] = len(pdf.pages)
        
        # Get metadata
        if pdf.metadata:
            result['metadata']['title'] = pdf.metadata.get('Title', '')
            result['metadata']['author'] = pdf.metadata.get('Author', '')
            result['metadata']['subject'] = pdf.metadata.get('Subject', '')
        
        # Extract text and images from each page
        total_images_extracted = 0
        for page_num, page in enumerate(pdf.pages):
            # Extract text
            text = page.extract_text() or ''
            
            # Extract images from pdfplumber (with limits)
            images = []
            if page.images and total_images_extracted < Config.MAX_IMAGES_PER_PDF:
                for img_index, img_obj in enumerate(page.images):
                    # Limit images per page
                    if len(images) >= Config.MAX_IMAGES_PER_PAGE:
                        break
                    
                    # Limit total images per PDF
                    if total_images_extracted >= Config.MAX_IMAGES_PER_PDF:
                        break
                    
                    try:
                        # Get image bounding box
                        bbox = (img_obj.get('x0', 0), img_obj.get('top', 0), 
                                img_obj.get('x1', 0), img_obj.get('bottom', 0))
                        if bbox[2] > bbox[0] and bbox[3] > bbox[1]:
                            cropped = page.crop(bbox)
                            
                            # Try to get image as PIL Image using pdfplumber's to_image
                            try:
                                # Use reduced DPI for memory efficiency
                                pil_image = cropped.to_image(resolution=Config.IMAGE_DPI)
                                
                                # Optimize image (resize, compress, convert to JPEG)
                                img_bytes, mime_type = optimize_image(pil_image)
                                
                                if img_bytes and mime_type:
                                    # Convert to base64
                                    image_base64 = base64.b64encode(img_bytes).decode('utf-8')
                                    images.append({
                                        'index': img_index,
                                        'data': f"data:{mime_type};base64,{image_base64}",
                                        'ext': 'jpg'
                                    })
                                    total_images_extracted += 1
                                    
                                    # Explicitly delete large objects to free memory
                                    del pil_image
                                    del img_bytes
                                else:
                                    print(f"Warning: Failed to optimize image {img_index} from page {page_num}")
                                
                            except MemoryError as mem_error:
                                print(f"Memory error extracting image {img_index} from page {page_num}: {mem_error}")
                                break  # Stop processing images on this page if out of memory
                            except Exception as img_error:
                                print(f"Error converting image {img_index} from page {page_num} to PIL: {img_error}")
                    except MemoryError as mem_error:
                        print(f"Memory error processing image {img_index} from page {page_num}: {mem_error}")
                        break
                    except Exception as e:
                        print(f"Error extracting image {img_index} from page {page_num}: {e}")
            
            # Get page dimensions
            width = page.width
            height = page.height
            
            result['pages'].append({
                'page_number': page_num + 1,
                'text': text,
                'images': images,
                'width': width,
                'height': height
            })
    
    # Also try to extract images using PyPDF2 as fallback (with optimization)
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num, page in enumerate(pdf_reader.pages):
                # Skip if we've already hit the limit
                if page_num < len(result['pages']):
                    current_page_images = len(result['pages'][page_num]['images'])
                    if current_page_images >= Config.MAX_IMAGES_PER_PAGE:
                        continue
                
                try:
                    if '/Resources' in page and '/XObject' in page['/Resources']:
                        xobjects = page['/Resources']['/XObject']
                        if hasattr(xobjects, 'get_object'):
                            xobjects = xobjects.get_object()
                        
                        for obj_name, obj in xobjects.items():
                            # Check limits
                            if page_num < len(result['pages']):
                                if len(result['pages'][page_num]['images']) >= Config.MAX_IMAGES_PER_PAGE:
                                    break
                                if total_images_extracted >= Config.MAX_IMAGES_PER_PDF:
                                    break
                            
                            if hasattr(obj, 'get') and obj.get('/Subtype') == '/Image':
                                try:
                                    # Extract image data
                                    data = obj.get_data()
                                    
                                    # Check raw data size before processing
                                    if len(data) > Config.MAX_IMAGE_SIZE_BYTES * 3:  # Allow 3x before compression
                                        print(f"Skipping very large image from PyPDF2 on page {page_num} ({len(data)} bytes)")
                                        continue
                                    
                                    # Try to load and optimize the image
                                    try:
                                        img_buffer = BytesIO(data)
                                        pil_image = Image.open(img_buffer)
                                        img_bytes, mime_type = optimize_image(pil_image)
                                        
                                        if img_bytes and mime_type:
                                            # Convert to base64
                                            image_base64 = base64.b64encode(img_bytes).decode('utf-8')
                                            
                                            # Add to images
                                            if page_num < len(result['pages']):
                                                new_index = len(result['pages'][page_num]['images'])
                                                result['pages'][page_num]['images'].append({
                                                    'index': new_index,
                                                    'data': f"data:{mime_type};base64,{image_base64}",
                                                    'ext': 'jpg'
                                                })
                                                total_images_extracted += 1
                                                
                                                # Clean up
                                                del pil_image
                                                del img_bytes
                                        else:
                                            # Fallback: use original data if optimization fails
                                            image_base64 = base64.b64encode(data).decode('utf-8')
                                            ext = 'jpg' if '/DCTDecode' in str(obj.get('/Filter', '')) else 'png'
                                            if page_num < len(result['pages']):
                                                new_index = len(result['pages'][page_num]['images'])
                                                result['pages'][page_num]['images'].append({
                                                    'index': new_index,
                                                    'data': f"data:image/{ext};base64,{image_base64}",
                                                    'ext': ext
                                                })
                                                total_images_extracted += 1
                                    except Exception as img_process_error:
                                        # Fallback: use original data
                                        image_base64 = base64.b64encode(data).decode('utf-8')
                                        ext = 'jpg' if '/DCTDecode' in str(obj.get('/Filter', '')) else 'png'
                                        if page_num < len(result['pages']):
                                            new_index = len(result['pages'][page_num]['images'])
                                            result['pages'][page_num]['images'].append({
                                                'index': new_index,
                                                'data': f"data:image/{ext};base64,{image_base64}",
                                                'ext': ext
                                            })
                                            total_images_extracted += 1
                                    
                                except MemoryError as mem_error:
                                    print(f"Memory error extracting PyPDF2 image from page {page_num}: {mem_error}")
                                    break
                                except Exception as e:
                                    print(f"Error extracting image with PyPDF2 from page {page_num}: {e}")
                except MemoryError as mem_error:
                    print(f"Memory error processing page {page_num} with PyPDF2: {mem_error}")
                    break
                except Exception as e:
                    print(f"Error processing page {page_num} with PyPDF2: {e}")
    except MemoryError as mem_error:
        print(f"Memory error in PyPDF2 image extraction: {mem_error}")
    except Exception as e:
        print(f"Error in PyPDF2 image extraction: {e}")
    
    return result


