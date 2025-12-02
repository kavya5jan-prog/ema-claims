"""
Vercel serverless function wrapper for Flask app
This file exports the Flask app for Vercel's Python runtime
"""
import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path to import app
try:
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not os.path.exists(parent_dir):
        raise ValueError(f"Parent directory does not exist: {parent_dir}")
    sys.path.insert(0, parent_dir)
    logger.info(f"Added parent directory to path: {parent_dir}")
except Exception as e:
    logger.error(f"Error setting up parent directory path: {str(e)}")
    raise

# Set Vercel environment variable
os.environ['VERCEL'] = '1'

# Import the Flask app from the new app factory
app = None
try:
    from app import create_app
    app = create_app()
    logger.info("Successfully created app using app factory")
except ImportError as e:
    logger.error(f"Failed to import app factory: {str(e)}")
    raise
except Exception as e:
    logger.error(f"Failed to create app: {str(e)}")
    raise

# Verify app was successfully created
if app is None:
    error_msg = "Flask app is None after creation"
    logger.error(error_msg)
    raise RuntimeError(error_msg)

# Verify app is a Flask application
if not hasattr(app, 'route'):
    error_msg = "Created object does not appear to be a Flask application (missing 'route' attribute)"
    logger.error(error_msg)
    raise TypeError(error_msg)

logger.info("Flask app successfully loaded and ready for Vercel")

# Vercel expects the app to be exported
# The @vercel/python builder will automatically handle WSGI
# The app variable is now available at module level for Vercel to detect
