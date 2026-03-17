#!/usr/bin/env python3
"""
Qwen3-TTS Local Server with Voice Design Support
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
from qwen_tts import QwenTTS, Qwen3TTSModel

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

warnings.filterwarnings("ignore")

app = Flask(__name__)

MODEL_VOICE_DESIGN = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
MODEL_BASE = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
voice_design_model = None
base_model = None

DEFAULT_VOICE_PROMPT = """gender: Masculino
pitch: Voz profunda de barítono, resonante y con cuerpo
speed: Ritmo controlado y calmado, hablando con pausas reflexivas
volume: Moderado y firme, proyectando autoridad natural sin necesidad de gritar
age: Mediana edad (45-55 años)
clarity: Altamente articulada y elocuente, con una dicción impecable
fluency: Flujo suave y seguro, propio de un líder experimentado
accent: Acento en español (neutro corporativo o peninsular)
texture: Cálida, firme y aterciopelada, que inspira confianza inmediata
emotion: Serenidad, empatía y gran seguridad en sí mismo
tone: Inspirador, profesional y directivo, pero accesible y de buen corazón
personality: Íntegro, líder corporativo, decente y sumo confiable"""


def load_voice_design_model():
    global voice_design_model
    if voice_design_model is None:
        logger.info(f"Loading Qwen3-TTS VoiceDesign model on {DEVICE}...")
        voice_design_model = QwenTTS(device=DEVICE)
        voice_design_model.load_model(MODEL_VOICE_DESIGN)
        logger.info("VoiceDesign model loaded successfully!")
    return voice_design_model


def load_base_model():
    global base_model
    if base_model is None:
        logger.info(f"Loading Qwen3-TTS Base model on {DEVICE}...")
        base_model = QwenTTS(device=DEVICE)
        base_model.load_model(MODEL_BASE)
        logger.info("Base model loaded successfully!")
    return base_model


@app.route('/tts', methods=['POST'])
def tts():
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'es')
        voice_prompt = data.get('voice_prompt', DEFAULT_VOICE_PROMPT)
        use_voice_design = data.get('use_voice_design', True)
        
        if not text:
            return json.dumps({'error': 'No text provided'}), 400

        if use_voice_design:
            model = load_voice_design_model()
            logger.info(f"Generating TTS with VoiceDesign...")
            logger.info(f"Voice prompt: {voice_prompt[:50]}...")
            
            audio = model.generate_voice_design(
                text=text,
                instruct=voice_prompt,
                language=language,
                stream=False
            )
        else:
            model = load_base_model()
            logger.info(f"Generating TTS with Base model...")
            
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
    return json.dumps({
        'status': 'ok',
        'device': DEVICE,
        'voice_design_model': MODEL_VOICE_DESIGN,
        'default_voice_prompt': DEFAULT_VOICE_PROMPT[:100] + '...'
    })


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Qwen3-TTS Server')
    parser.add_argument('--port', type=int, default=5001, help='Port to run server on')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind to')
    args = parser.parse_args()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║              Qwen3-TTS Server (Voice Design)                ║
╠══════════════════════════════════════════════════════════════╣
║  Device: {DEVICE:<53}║
║  VoiceDesign Model: {MODEL_VOICE_DESIGN:<43}║
║  URL:    http://{args.host}:{args.port}/tts                  ║
╠══════════════════════════════════════════════════════════════╣
║  Default Voice Prompt (first 100 chars):                  ║
║  {DEFAULT_VOICE_PROMPT[:60]:<60}║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(host=args.host, port=args.port, debug=False)
