"""
WSGI entry point for production deployment (Render, etc.)
This file explicitly imports the Flask app from app.py to avoid conflicts
with the app/ directory.
"""
import sys
import os
import importlib.util

# Import app.py as a module explicitly to avoid conflict with app/ directory
spec = importlib.util.spec_from_file_location("app_module", "app.py")
app_module = importlib.util.module_from_spec(spec)
sys.modules["app_module"] = app_module
spec.loader.exec_module(app_module)

# Get the app instance from the imported module
app = app_module.app

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)

