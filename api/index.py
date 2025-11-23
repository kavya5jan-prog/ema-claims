"""
Vercel serverless function wrapper for Flask app
This file exports the Flask app for Vercel's Python runtime
"""
import sys
import os

# Add parent directory to path to import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the Flask app
from app import app

# Vercel expects the app to be exported
# The @vercel/python builder will automatically handle WSGI
__all__ = ['app']
