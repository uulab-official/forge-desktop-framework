#!/usr/bin/env python3
"""Forge Worker"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import actions to register them
import actions  # noqa: F401

# Run the standard worker loop
from forge_worker import run_worker

run_worker()
