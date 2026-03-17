#!/bin/bash
# Setup script for Qwen3-TTS local server

echo "=== Creating virtual environment ==="
python -m venv venv_tts

echo "=== Activating virtual environment ==="
source venv_tts/bin/activate

echo "=== Installing dependencies ==="
pip install torch scipy numpy flask

echo "=== Installing Qwen3-TTS ==="
pip install qwen-tts

echo ""
echo "=== Installation complete! ==="
echo ""
echo "To start the TTS server, run:"
echo "  source venv_tts/bin/activate"
echo "  python qwen_tts_server.py"
echo ""
echo "To stop: Ctrl+C"
