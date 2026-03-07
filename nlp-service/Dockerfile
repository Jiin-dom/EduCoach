FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (libxml2/libxslt for lxml HTML parsing)
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with retries
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download spaCy model using pip (more reliable than spacy download)
RUN pip install --no-cache-dir https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl

# Pre-download sentence-transformers model so cold starts are fast
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy application code
COPY . .

EXPOSE 5000

# Use custom logging config to filter health check spam
# We need to start uvicorn with Python to import our config dict
CMD ["python", "-c", "import uvicorn; from logging_config import LOGGING_CONFIG; uvicorn.run('main:app', host='0.0.0.0', port=5000, log_config=LOGGING_CONFIG)"]

