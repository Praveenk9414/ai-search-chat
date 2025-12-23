import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "koesn/llama3-8b-instruct:latest"


def stream_ollama_answer(prompt: str):
    """
    Stream tokens from Ollama (REAL streaming).
    """
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": True
    }

    with requests.post(OLLAMA_URL, json=payload, stream=True) as response:
        response.raise_for_status()

        for line in response.iter_lines():
            if not line:
                continue

            data = json.loads(line.decode("utf-8"))

            if "response" in data:
                yield data["response"]

            if data.get("done"):
                break
