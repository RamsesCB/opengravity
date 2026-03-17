#!/usr/bin/env python3
"""
Qwen3-TTS Local Server
Run this script before starting the bot in local mode.
Usage: python qwen_tts_server.py
"""
import argparse
import base64
import io
import json
import logging
import os
import sys
import warnings
from pathlib import Path

import torch
from flask import Flask, request, Response
from qwen_tts import QwenTTS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

warnings.filterwarnings("ignore")

app = Flask(__name__)

MODEL_NAME = "Qwen/Qwen3-TTS-8k-HiFusion"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
tts_model = None


def load_model():
    global tts_model
    if tts_model is None:
        logger.info(f"Loading Qwen3-TTS model on {DEVICE}...")
        tts_model = QwenTTS(device=DEVICE)
        tts_model.load_model(MODEL_NAME)
        logger.info("Model loaded successfully!")
    return tts_model


@app.route('/tts', methods=['POST'])
def tts():
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'es')
        
        if not text:
            return json.dumps({'error': 'No text provided'}), 400

        model = load_model()
        
        logger.info(f"Generating TTS for text: {text[:50]}...")
        
        audio = model.generate(
            text=text,
            language=language,
            stream=False
        )
        
        wav_io = io.BytesIO()
        import numpy as np
        from scipy.io import wavfile
        
        audio_np = audio.cpu().numpy() if torch.is_tensor(audio) else audio
        
        if audio_np.ndim > 1:
            audio_np = audio_np.squeeze()
        
        sample_rate = 24000
        wav_io = io.BytesIO()
        wavfile.write(wav_io, sample_rate, audio_np.astype(np.int16))
        wav_io.seek(0)
        
        audio_base64 = base64.b64encode(wav_io.read()).decode('utf-8')
        
        return json.dumps({
            'audio': audio_base64,
            'sample_rate': sample_rate
        })
        
    except Exception as e:
        logger.error(f"TTS error: {e}")
        import traceback
        traceback.print_exc()
        return json.dumps({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return json.dumps({'status': 'ok', 'device': DEVICE})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Qwen3-TTS Server')
    parser.add_argument('--port', type=int, default=5001, help='Port to run server on')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind to')
    args = parser.parse_args()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    Qwen3-TTS Server                           ║
╠══════════════════════════════════════════════════════════════╣
║  Device: {DEVICE:<53}║
║  Model:  {MODEL_NAME:<53}║
║  URL:    http://{args.host}:{args.port}/tts                  ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(host=args.host, port=args.port, debug=False)
