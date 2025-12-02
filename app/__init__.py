"""
Flask application factory.
"""
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

