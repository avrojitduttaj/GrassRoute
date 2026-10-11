FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl ca-certificates bash \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY start.sh .
RUN chmod +x /app/start.sh

ENV OLLAMA_HOST=127.0.0.1:11434
ENV OLLAMA_MODELS=/var/lib/ollama/models

CMD ["/app/start.sh"]