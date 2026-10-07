FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make entrypoint executable
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

# Default command — migrations + optional admin bootstrap + serve
CMD ["/app/entrypoint.sh"]
