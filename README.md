# LabTrack

LabTrack is a laboratory inventory and equipment borrowing platform for administrators, lab assistants, faculty, and students. It uses a React frontend, a FastAPI backend, and PostgreSQL.

## Features

- Manage departments, labs, equipment models, and individual equipment units.
- Generate unique asset IDs and QR labels; import equipment with duplicate-upload protection.
- Submit reservations, approve requests, issue equipment at the counter, and record returns.
- Submit faculty event / club requests to the assigned lab assistant. Approval issues the equipment.
- Manage inter-lab transfers, borrowing history, and notifications.
- View faculty and assistants in the admin user directory, with a separate student list.
- Choose a department during registration: CE (Computer Engineering), CSE (Computer Science Engineering), IT (Information Technology), AIML (Artificial Intelligence and Machine Learning), or EC (Electronics and Communication). The selected database department determines the portal label; student ID codes are not used to guess it.
- Display dates as `dd-mm-yyyy`. Student IDs support regular `24CE069` and D2D `D25CE150` formats; faculty, assistant, and lab examples are `FCE001`, `ASST001`, and `LAB-IOT`.
- Optionally deliver notification emails using Gmail API or SMTP.

## Technology

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, JavaScript / JSX, Vite 8, React Router, Axios |
| Interface | CSS, Lucide icons, Recharts, QR scanning and labels |
| Backend | Python, FastAPI, Pydantic, JWT authentication |
| Database | PostgreSQL, SQLAlchemy, asyncpg, Alembic migrations |
| Optional containers | Docker Compose, PostgreSQL, Nginx, FastAPI |

## Requirements

- **Node.js:** 22.12 or newer; Vite also supports Node 20.19 or newer within the 20.x release line.
- **Python:** 3.10 or newer, with `pip` and `venv`.
- **PostgreSQL:** a running server and an account that can create and migrate application tables.
- **Docker Desktop:** only needed for the optional Docker setup.

The commands below use **Windows PowerShell** and the checkout location `D:\PROJECTS\LABTRACK`. Change the path if your checkout is elsewhere. Virtual-environment activation and `uv` are not required.

## First-time local setup

### 1. Create the database

Start PostgreSQL and create an empty database named `labtrack` using pgAdmin or `psql`. If `psql` is on your PATH:

```powershell
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE labtrack;"
```

Enter your PostgreSQL password when prompted. Skip creation if the database already exists. Application startup creates tables through migrations; it does not create the PostgreSQL database itself.

### 2. Install dependencies

Install frontend dependencies from the project root:

```powershell
Set-Location D:\PROJECTS\LABTRACK
npm ci
```

Create the backend virtual environment and install its dependencies:

```powershell
Set-Location D:\PROJECTS\LABTRACK\backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

If `python` is unavailable but the Windows Python launcher is installed, use `py -3 -m venv venv`. Reuse an existing `backend\venv` rather than recreating it.

### 3. Configure the backend

Copy the root configuration template to `backend\.env` only if that file does not already exist:

```powershell
Set-Location D:\PROJECTS\LABTRACK
if (-not (Test-Path backend\.env)) {
    Copy-Item .env.example backend\.env
}
```

Edit `backend\.env` with your own values:

```dotenv
SECRET_KEY=REPLACE_WITH_A_RANDOM_SECRET
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD
POSTGRES_DB=labtrack
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

BOOTSTRAP_ADMIN_EMAIL=your-admin@example.com
BOOTSTRAP_ADMIN_NAME="System Administrator"
BOOTSTRAP_ADMIN_PASSWORD=YOUR_PRIVATE_PASSWORD_AT_LEAST_12_CHARACTERS

GMAIL_ENABLED=false
SMTP_ENABLED=false
```

Generate a random secret locally and paste it into `SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Replace all placeholders before starting. For local PostgreSQL, remove any `POSTGRES_HOST=db` setting; `db` is a Docker service hostname. If `DATABASE_URL` is set, it overrides the separate PostgreSQL connection settings.

Startup creates the first active administrator only when the bootstrap email and password are configured and no administrator exists. There is **no default login password**. After successful setup, remove the bootstrap password from the environment file. Later starts do not reset existing accounts.

### 4. Configure the frontend

The default local API address is `http://localhost:8000/api/v1`. No additional frontend configuration is required.

To override it, create `.env.local` at the project root:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

The root `.env.example` uses `VITE_API_URL=/api/v1` for Docker. This also works with the local Vite development server through its `/api` proxy to port 8000. Restart Vite after changing frontend environment values.

## Start both servers

Keep PostgreSQL running and open **two separate PowerShell terminals**. After first-time setup, use these commands whenever you start the project.

### Terminal 1: backend

```powershell
Set-Location D:\PROJECTS\LABTRACK\backend
.\venv\Scripts\python.exe -m app.startup
if ($LASTEXITCODE -eq 0) {
    .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
}
```

`app.startup` checks the database connection, applies pending Alembic migrations, inserts missing policy defaults, and optionally creates the first administrator. If preparation fails, fix the reported issue before starting Uvicorn. Running Uvicorn directly does not perform this preparation.

| Backend endpoint | Address |
| --- | --- |
| Interactive API documentation | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |
| API base path | http://localhost:8000/api/v1 |

The backend root URL is not a web page; use `/docs` or `/health` to check the server.

### Terminal 2: frontend

```powershell
Set-Location D:\PROJECTS\LABTRACK
npm run dev -- --port 5173 --strictPort
```

Open **http://localhost:5173** and sign in using the administrator email and password you configured. Keep both terminals open while using the app. `--strictPort` prevents Vite from silently switching to a port outside the configured CORS origins.

### Stop and restart

Press **Ctrl+C** in each terminal to stop the servers. Restart using the same two command blocks. Dependency installation is only needed for a fresh checkout or after dependency changes.

## Optional demo data

Normal startup does not add demo accounts or equipment. To populate a separate, empty development database, run from `backend` **before admin bootstrapping**:

```powershell
.\venv\Scripts\python.exe -m alembic upgrade head
# Set DEMO_SEED_PASSWORD privately in this terminal to at least 12 characters.
.\venv\Scripts\python.exe -m app.seed_db
```

Set `DEMO_SEED_PASSWORD` as a shell environment variable; this seed command does not read that value from the backend `.env`. It refuses a populated database, commits demo data together, and becomes a no-op after a successful seed. Do not run `test_workflow.py` as an installation or seeding step.

Demo emails include `admin@labtrack.edu`, `dmiller@charusat.ac.in`, `fee001@charusat.ac.in`, and `24ee001@charusat.edu.in`. They use the password you explicitly supplied. See [database startup and seeding](backend/STARTUP.md) for details.

## Optional Gmail notifications

Email delivery is not required to run either server. The configured sender is `labtrack23@gmail.com`. Gmail API delivery requires OAuth credentials and authorization before enabling it.

Follow [Gmail API and SMTP setup](backend/MAIL_SETUP.md). Keep delivery disabled until setup is complete. Store credentials in the backend environment file, outside version control.

## Optional Docker setup

Use the **root** `docker-compose.yml`. Copy `.env.example` to the root `.env` if it does not exist, then configure the database password, secret key, and optional bootstrap administrator there. Local backend commands read `backend\.env`; root Docker Compose reads the root `.env`.

```powershell
Set-Location D:\PROJECTS\LABTRACK
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
# Edit .env before continuing.
docker compose up --build -d
docker compose logs -f backend
```

- Frontend: **http://localhost** (port 80).
- Backend documentation: **http://localhost:8000/docs**.
- PostgreSQL: port **5432**, with data in the `postgres_data` volume.

The backend container prepares the database automatically. Avoid port conflicts with local PostgreSQL or manually started servers. Docker startup has not yet been verified on this machine because the Docker engine was unavailable.

Stop containers with `docker compose down`. This preserves the database volume. Adding `-v` deletes the volume and its data.

## Development commands

Run from the project root:

```powershell
npm run lint
npm run build
npm run preview
```

`build` writes the production frontend bundle to `dist`. `preview` serves that bundle for local review; the backend must still run. For preview, configure an API address reachable from the browser and include the preview origin in backend `ALLOWED_ORIGINS`. The documented Vite development proxy is used by `npm run dev`.

To inspect or apply backend migrations, run from `backend`:

```powershell
.\venv\Scripts\python.exe -m alembic current
.\venv\Scripts\python.exe -m alembic upgrade head
```

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Database unavailable / connection refused | Start PostgreSQL and check the host, port, database name, and password in `backend\.env`. |
| Missing `SECRET_KEY` or configuration validation error | Run backend commands from `backend` and replace environment placeholders. |
| Missing table or migration failure | Run `app.startup` using the backend virtual environment. Use `alembic upgrade head` for migration diagnostics. |
| Python module not found | Install `requirements.txt` using the same virtual-environment Python used to start the server. |
| Frontend cannot reach the API | Confirm port 8000 is running, check `VITE_API_URL`, and restart Vite after configuration changes. |
| CORS error | Include the exact frontend origin in `ALLOWED_ORIGINS` and restart the backend. |
| Port 5173 or 8000 already in use | Stop the previous server, or update the port and corresponding API / CORS settings. |
| Administrator cannot sign in on a new database | Configure both bootstrap values, run `app.startup`, and use those credentials. There are no built-in default credentials. |
| Gmail messages are not delivered | Complete OAuth setup and enable the selected provider as described in `backend/MAIL_SETUP.md`. |

## Project layout

```text
LABTRACK/
├── src/                     React pages, components, context, and API clients
├── public/                  Static frontend assets
├── backend/
│   ├── app/                 FastAPI routes, schemas, database models, services
│   ├── alembic/             Database migrations
│   ├── requirements.txt     Python dependencies
│   ├── STARTUP.md           Database preparation and demo-seed details
│   └── MAIL_SETUP.md        Gmail API and SMTP instructions
├── audit-artifacts/         Verification scripts and audit reports
├── .env.example             Configuration template
├── docker-compose.yml       Optional complete container setup
└── package.json             Frontend dependencies and commands
```
