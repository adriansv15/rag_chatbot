FROM python:3.13.0-slim

# Set working directory
WORKDIR /app

# Install system dependencies required by ChromaDB
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create persistent Chroma directory
RUN mkdir -p /app/my_vector_db

# Copy backend code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI with Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
