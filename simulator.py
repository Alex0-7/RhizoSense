#!/usr/bin/env python3
"""
RhizoSense Simulator root entrypoint.
"""
import sys
from pathlib import Path
import runpy

if __name__ == "__main__":
    target = Path(__file__).parent / "simulator" / "simulator.py"
    runpy.run_path(str(target), run_name="__main__")
