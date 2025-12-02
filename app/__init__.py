"""
Flask application factory.
"""
import sys
import os
import importlib.util
from flask import Flask
from app.config import Config


def create_app(config_class=Config):
    """Create and configure Flask application."""
    app = Flask(__name__, static_folder='../static', template_folder='../templates')
    app.config.from_object(config_class)
    
    # Set upload folder from config
    app.config['UPLOAD_FOLDER'] = config_class.get_upload_folder()
    
    # Register blueprints
    from app.routes import main, facts, analysis, documents
    app.register_blueprint(main.bp)
    app.register_blueprint(facts.bp)
    app.register_blueprint(analysis.bp)
    app.register_blueprint(documents.bp)
    
    return app


# Import app instance from root app.py for gunicorn compatibility
# This allows both "gunicorn app:app" and "gunicorn wsgi:app" to work
try:
    # Get the parent directory (project root)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    app_py_path = os.path.join(parent_dir, 'app.py')
    
    # Import app.py as a module explicitly to avoid conflict with app/ directory
    spec = importlib.util.spec_from_file_location("app_module", app_py_path)
    app_module = importlib.util.module_from_spec(spec)
    sys.modules["app_module"] = app_module
    spec.loader.exec_module(app_module)
    
    # Get the app instance from the imported module
    app = app_module.app
except Exception as e:
    # If import fails, fall back to creating app using factory
    # This ensures the module can still be imported even if app.py has issues
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Could not import app from app.py: {str(e)}. Falling back to create_app().")
    app = create_app()

