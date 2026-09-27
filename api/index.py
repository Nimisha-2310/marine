import os
import sys

# Ensure root directory and backend directory are in path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'backend'))

from backend.server import app

# Vercel WSGI entry point
handler = app
