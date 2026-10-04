#!/bin/sh
set -e

echo "============================================"
echo "  LabTrack Backend Entrypoint"
echo "============================================"

# --- Step 1: Wait for PostgreSQL to be ready ---
echo "[1/4] Waiting for PostgreSQL at ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}..."

# Install pg_isready if not available (slim images may not have it)
# Use a Python-based fallback for maximum compatibility
python -c "
import socket, time, os
host = os.environ.get('POSTGRES_HOST', 'localhost')
port = int(os.environ.get('POSTGRES_PORT', '5432'))
retries = 30
for i in range(retries):
    try:
        sock = socket.create_connection((host, port), timeout=2)
        sock.close()
        print(f'  PostgreSQL is accepting connections on {host}:{port}')
        break
    except (socket.error, socket.timeout):
        if i < retries - 1:
            print(f'  Waiting... ({i+1}/{retries})')
            time.sleep(2)
        else:
            print('  ERROR: PostgreSQL not reachable after 60s')
            exit(1)
"

# --- Step 2: Run Alembic migrations ---
echo "[2/4] Running database migrations..."
alembic upgrade head
echo "  Migrations applied successfully."

# --- Step 3: Seed database if empty ---
echo "[3/4] Checking if database needs seeding..."
NEEDS_SEED=$(python -c "
import asyncio, os
async def check():
    # Use raw asyncpg to avoid SQLAlchemy session issues at startup
    try:
        import asyncpg
        host = os.environ.get('POSTGRES_HOST', 'localhost')
        port = os.environ.get('POSTGRES_PORT', '5432')
        user = os.environ.get('POSTGRES_USER', 'postgres')
        password = os.environ.get('POSTGRES_PASSWORD', 'postgres')
        database = os.environ.get('POSTGRES_DB', 'labtrack')
        conn = await asyncpg.connect(host=host, port=port, user=user, password=password, database=database)
        count = await conn.fetchval('SELECT COUNT(*) FROM users')
        await conn.close()
        return count
    except Exception as e:
        print(f'  Warning: Could not check seed status ({e}), will attempt seed.')
        return 0
count = asyncio.run(check())
print('no' if count > 0 else 'yes')
")

if [ "$NEEDS_SEED" = "yes" ]; then
    echo "  Database is empty. Running seed script..."
    python populate_realistic_data.py || echo "  Warning: Seed script had issues (non-fatal)."
    echo "  Seeding complete."
else
    echo "  Database already has data. Skipping seed."
fi

# --- Step 4: Start the application server ---
echo "[4/4] Starting LabTrack API server..."
echo "============================================"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
