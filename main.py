import os
from pathlib import Path

# Load environment variables from .env
env_file = Path(__file__).resolve().parent / ".env"
if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_file)
    except ImportError:
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

from sarvamai import SarvamAI

client = SarvamAI()

response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[
        {"role": "user", "content": "Hello! Introduce yourself in one sentence."}
    ],
)

print(response.choices[0].message.content)
