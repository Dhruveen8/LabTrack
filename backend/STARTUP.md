# Database startup and seeding

Run commands from the backend directory. Local development reads `backend/.env`; Docker reads the root `.env`.

## Normal startup

```powershell
./venv/Scripts/python.exe -m app.startup
./venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Docker's entrypoint runs the same preparation before serving. It respects `PORT` (default 8000) and `WEB_CONCURRENCY` (default 2). `app.startup` checks a real authenticated SQL connection using the configured database URL, serializes Alembic migrations across simultaneous starts and inserts missing policy settings without replacing existing values. It also adds missing registration departments: CE, CSE, IT, AIML, and EC, preserving existing department records. Startup failure prevents the server from starting.

Registration department names are maintained as configured. The `CE` department is named Computer Engineering, including on databases where it previously had another name. Its existing ID and user/lab links are retained. Existing accounts are never reassigned based on their student ID.

To create the first admin, configure these backend environment values before startup:

```dotenv
BOOTSTRAP_ADMIN_EMAIL=your-admin@example.com
BOOTSTRAP_ADMIN_NAME="System Administrator"
BOOTSTRAP_ADMIN_PASSWORD=YOUR_PRIVATE_PASSWORD_AT_LEAST_12_CHARACTERS
```

There is no default admin password. Once an admin exists, subsequent starts skip admin creation and do not reset credentials. Remove the bootstrap password after initial setup. Leaving both email and password empty starts the API without an admin; configure them and rerun preparation when ready. `python create_admin.py` uses the same bootstrap logic against an already migrated database.

For a hosted PostgreSQL database, `DATABASE_URL` overrides all `POSTGRES_*` values. `postgresql://` and `postgres://` URLs are normalized to the asyncpg driver, and `sslmode` becomes asyncpg's `ssl` parameter. Use `sslmode=require` when the provider requires TLS. Do not paste connection URLs into logs or chat. Provider-specific unsupported parameters such as `channel_binding` must be omitted; a remote managed database has not yet been tested.

## Explicit demo data

Startup never creates demo accounts, fake loans or equipment. The optional seed works only on an empty, migrated database and requires an explicit password. On an existing populated database it refuses without changing data. A repeated successful demo seed is a no-op.

```powershell
./venv/Scripts/python.exe -m alembic upgrade head
# Set DEMO_SEED_PASSWORD privately in this shell (at least 12 characters).
./venv/Scripts/python.exe -m app.seed_db
```

The seed creates three departments, eight accounts, four labs with assistant assignments, six equipment models and 45 available units using the atomic asset ID allocator. All changes commit together; any failure rolls back. `populate_realistic_data.py` is a compatibility command for this same non-destructive seed. Neither seed command truncates tables. Seed before admin bootstrapping if you want a fresh demo database.

Demo login emails include `admin@labtrack.edu`, `dmiller@charusat.ac.in`, `fee001@charusat.ac.in` and `24ee001@charusat.edu.in`. Each uses the password you explicitly supplied for that demo database. Do not enable demo accounts on a public production deployment.
