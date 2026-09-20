"""
LabTrack End-to-End Workflow Test
Seeds all demo data and validates the full borrowing lifecycle.

Usage (from /backend directory):
    python test_workflow.py

Requirements: pip install httpx
Backend must be running at http://localhost:8000
"""
import httpx
import sys
from datetime import datetime, timedelta

BASE = "http://localhost:8000/api/v1"
PASS = 0
FAIL = 0


# ─── Output Helpers ───────────────────────────────────────────────────────────

def log(step, msg, ok=True):
    global PASS, FAIL
    icon = "✅" if ok else "❌"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {icon} Step {step}: {msg}")


def expect(step, resp, expected_status, desc):
    if resp.status_code == expected_status:
        log(step, f"{desc} → HTTP {resp.status_code}")
    else:
        log(step, f"{desc} → Expected {expected_status}, got {resp.status_code}: {resp.text}", ok=False)
    return resp


def section(title):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


# ─── Request Helpers ──────────────────────────────────────────────────────────

def register(client, name, email, password, role, dept_id=None):
    body = {"name": name, "email": email, "password": password, "role": role}
    if dept_id:
        body["department_id"] = dept_id
    return client.post(f"{BASE}/auth/register", json=body)


def login(client, email, password):
    return client.post(f"{BASE}/auth/login", data={"username": email, "password": password})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  LabTrack End-to-End Workflow Test")
print("=" * 60)

client = httpx.Client(timeout=15)


# ─── Step 1: Register All 5 Users ────────────────────────────────────────────
section("SETUP — Step 1: Register Users")

users = [
    ("Dr. Rajesh Kumar",  "admin@labtrack.edu",            "admin123", "ADMIN"),
    ("Priya Sharma",      "priya.assistant@labtrack.edu",  "asst123",  "ASSISTANT"),
    ("Amit Verma",        "amit.assistant@labtrack.edu",   "asst123",  "ASSISTANT"),
    ("Prof. Anand Mehta", "anand.faculty@labtrack.edu",    "fac123",   "FACULTY"),
    ("Dhruveen Patel",    "dhruveen.student@labtrack.edu", "stu123",   "STUDENT"),
]

for name, email, pw, role in users:
    r = register(client, name, email, pw, role)
    # 200 = created, 400 = already exists (idempotent re-run)
    ok = r.status_code in (200, 400)
    log("1", f"Register {role} ({name}) → HTTP {r.status_code}", ok=ok)


# ─── Login All Users ──────────────────────────────────────────────────────────
section("SETUP — Login & Collect Tokens")

tokens = {}
for name, email, pw, role in users:
    r = login(client, email, pw)
    if r.status_code == 200:
        key = f"{role}_{name.split()[0]}"
        tokens[key] = r.json()["access_token"]
        log("1", f"Login {name} → OK")
    else:
        log("1", f"Login {name} → FAILED: {r.text}", ok=False)

admin_token   = tokens.get("ADMIN_Dr.", "")
priya_token   = tokens.get("ASSISTANT_Priya", "")
amit_token    = tokens.get("ASSISTANT_Amit", "")
faculty_token = tokens.get("FACULTY_Prof.", "")
student_token = tokens.get("STUDENT_Dhruveen", "")

if not all([admin_token, priya_token, amit_token, faculty_token, student_token]):
    print("\n❌ Could not obtain all tokens — aborting.\n")
    client.close()
    sys.exit(1)


# ─── Step 2: Create 8 Departments ────────────────────────────────────────────
section("SETUP — Step 2: Create 8 Departments (Admin)")

departments = [
    ("Chemical Engineering",           "CE",    "Dr. Viral Shah"),
    ("Computer Science & Engineering", "CSE",   "Dr. Sneha Desai"),
    ("Information Technology",         "IT",    "Dr. Meera Joshi"),
    ("AI & Machine Learning",          "AIML",  "Dr. Karan Trivedi"),
    ("Mechanical Engineering",         "ME",    "Dr. Suresh Patel"),
    ("Electrical Engineering",         "EE",    "Dr. Rajesh Kumar"),
    ("Electronics & Communication",    "EC",    "Dr. Neha Rao"),
    ("Civil Engineering",              "Civil", "Dr. Arun Pillai"),
]

dept_ids = {}
for name, code, hod in departments:
    r = client.post(
        f"{BASE}/departments/",
        json={"name": name, "code": code, "hod_name": hod},
        headers=auth(admin_token),
    )
    if r.status_code == 200:
        dept_ids[code] = r.json()["id"]
        log("2", f"Created dept {code} (id={dept_ids[code]})")
    elif r.status_code == 400 and "already exists" in r.text:
        all_depts = client.get(f"{BASE}/departments/", headers=auth(admin_token)).json()
        dept_ids[code] = next((d["id"] for d in all_depts if d["code"] == code), None)
        log("2", f"Dept {code} already exists (id={dept_ids[code]})")
    else:
        log("2", f"Create dept {code} → {r.status_code}: {r.text}", ok=False)


# ─── Step 3: Create 16 Labs ───────────────────────────────────────────────────
section("SETUP — Step 3: Create 16 Labs (Admin)")

labs_data = [
    ("Chemical Process Lab",       "Block D, Room 101", "CE"),
    ("Data Structures Lab",        "Block A, Room 201", "CSE"),
    ("Operating Systems Lab",      "Block A, Room 202", "CSE"),
    ("Networks Lab",               "Block A, Room 203", "CSE"),
    ("Web Technologies Lab",       "Block B, Room 101", "IT"),
    ("Cyber Security Lab",         "Block B, Room 102", "IT"),
    ("AI/ML Lab",                  "Block A, Room 301", "AIML"),
    ("Deep Learning Lab",          "Block A, Room 302", "AIML"),
    ("Thermodynamics Lab",         "Block C, Room 101", "ME"),
    ("CAD/CAM Lab",                "Block C, Room 102", "ME"),
    ("IoT Lab",                    "Block E, Room 201", "EE"),
    ("VLSI Lab",                   "Block E, Room 202", "EE"),
    ("Power Electronics Lab",      "Block E, Room 203", "EE"),
    ("Microprocessor Lab",         "Block F, Room 101", "EC"),
    ("Communication Systems Lab",  "Block F, Room 102", "EC"),
    ("Surveying & Geomatics Lab",  "Block G, Room 101", "Civil"),
]

lab_ids = {}
for name, loc, dept_code in labs_data:
    r = client.post(
        f"{BASE}/labs/",
        json={"name": name, "location": loc, "department_id": dept_ids[dept_code]},
        headers=auth(admin_token),
    )
    if r.status_code == 200:
        lab_ids[name] = r.json()["id"]
        log("3", f"Created lab: {name} (id={lab_ids[name]})")
    else:
        all_labs = client.get(f"{BASE}/labs/", headers=auth(admin_token)).json()
        existing = next((l for l in all_labs if l["name"] == name), None)
        if existing:
            lab_ids[name] = existing["id"]
            log("3", f"Lab already exists: {name} (id={lab_ids[name]})")
        else:
            log("3", f"Create lab {name} → {r.status_code}: {r.text}", ok=False)


# ─── Steps 4 & 5: Assign Assistants ──────────────────────────────────────────
section("SETUP — Steps 4-5: Assign Assistants (Admin)")

priya_me = client.get(f"{BASE}/auth/me", headers=auth(priya_token)).json()
amit_me  = client.get(f"{BASE}/auth/me", headers=auth(amit_token)).json()

for lab_name in ["IoT Lab", "VLSI Lab"]:
    r = client.post(
        f"{BASE}/labs/{lab_ids[lab_name]}/assign_assistant",
        params={"assistant_id": priya_me["id"]},
        headers=auth(admin_token),
    )
    expect("4", r, 200, f"Assign Priya → {lab_name}")

for lab_name in ["AI/ML Lab", "Networks Lab"]:
    r = client.post(
        f"{BASE}/labs/{lab_ids[lab_name]}/assign_assistant",
        params={"assistant_id": amit_me["id"]},
        headers=auth(admin_token),
    )
    expect("5", r, 200, f"Assign Amit → {lab_name}")

priya_me = client.get(f"{BASE}/auth/me", headers=auth(priya_token)).json()
print(f"  ℹ️  Priya assigned_labs: {priya_me.get('assigned_labs', [])}")


# ─── Step 6: Create Equipment Models (Admin) ─────────────────────────────────
section("SETUP — Step 6: Create Equipment Models (Admin)")

equipment_models = [
    # IoT Lab
    ("Arduino Uno R3",                  "MC", "IoT Lab",             5),
    ("Raspberry Pi 4B",                 "MC", "IoT Lab",             3),
    ("ESP32 DevKit",                    "MC", "IoT Lab",             4),
    ("DHT11 Temperature Sensor Kit",    "SN", "IoT Lab",            10),
    ("Breadboard 830 Points",           "TL", "IoT Lab",            15),
    # VLSI Lab
    ("Tektronix TBS1052C Oscilloscope", "TM", "VLSI Lab",            4),
    ("Xilinx Spartan-6 FPGA Board",     "IC", "VLSI Lab",            3),
    ("Logic Analyzer 16-Channel",       "TM", "VLSI Lab",            2),
    # AI/ML Lab
    ("NVIDIA Jetson Nano Dev Kit",      "MC", "AI/ML Lab",           3),
    ("Intel Neural Compute Stick 2",    "MC", "AI/ML Lab",           2),
    ("USB Webcam Logitech C920",        "PR", "AI/ML Lab",           5),
    # Networks Lab
    ("Cisco Catalyst 2960 Switch",      "NW", "Networks Lab",        2),
    ("TP-Link Managed Switch",          "NW", "Networks Lab",        4),
    ("Crimping Tool Kit",               "TL", "Networks Lab",        6),
    ("Cat6 Ethernet Cable Roll 305m",   "CB", "Networks Lab",        3),
    # Data Structures Lab
    ("Dell OptiPlex 3090 Desktop",      "PC", "Data Structures Lab", 30),
    ("Dell 24inch Monitor",             "PR", "Data Structures Lab", 30),
]

model_ids = {}
for name, cat, lab_name, qty in equipment_models:
    r = client.post(
        f"{BASE}/inventory/models",
        json={
            "name": name,
            "category": cat,
            "lab_id": lab_ids[lab_name],
            "description": f"{name} — {lab_name}",
        },
        headers=auth(admin_token),
    )
    if r.status_code == 200:
        model_ids[name] = r.json()["id"]
        log("6", f"Created model: {name} (id={model_ids[name]})")
    else:
        all_models = client.get(f"{BASE}/inventory/models", headers=auth(admin_token)).json()
        existing = next((m for m in all_models if m["name"] == name), None)
        if existing:
            model_ids[name] = existing["id"]
            log("6", f"Model already exists: {name} (id={model_ids[name]})")
        else:
            log("6", f"Create model {name} → {r.status_code}: {r.text}", ok=False)


# ─── Step 7: Add Equipment Units ─────────────────────────────────────────────
section("SETUP — Step 7: Add Equipment Units (Assistants)")

priya_labs = {"IoT Lab", "VLSI Lab"}
amit_labs  = {"AI/ML Lab", "Networks Lab"}

iot_first_asset_id = None
unit_total = 0

for name, cat, lab_name, qty in equipment_models:
    if lab_name in priya_labs:
        token = priya_token
    elif lab_name in amit_labs:
        token = amit_token
    else:
        token = admin_token

    model_id = model_ids.get(name)
    if not model_id:
        log("7", f"Skipping units for {name} — model not found", ok=False)
        continue

    all_models_resp = client.get(f"{BASE}/inventory/models", headers=auth(admin_token)).json()
    existing_model = next((m for m in all_models_resp if m["id"] == model_id), None)
    existing_qty = existing_model["total_quantity"] if existing_model else 0
    units_to_add = qty - existing_qty

    if units_to_add <= 0:
        log("7", f"Units already exist for {name} ({existing_qty}/{qty}) — skipping")
        continue

    for i in range(units_to_add):
        r = client.post(
            f"{BASE}/inventory/units",
            json={"model_id": model_id},
            headers=auth(token),
        )
        if r.status_code == 200:
            unit_total += 1
            asset_id = r.json()["asset_id"]
            if name == "Arduino Uno R3" and iot_first_asset_id is None:
                iot_first_asset_id = asset_id
            if i == 0 or i == units_to_add - 1:
                log("7", f"{name} unit #{existing_qty + i + 1}: {asset_id}")
        else:
            log("7", f"Failed unit for {name}: {r.text}", ok=False)

if iot_first_asset_id is None:
    print("  ℹ️  Arduino units already existed — defaulting to LT-IOT-MC-00001")
    iot_first_asset_id = "LT-IOT-MC-00001"

arduino_model_id = model_ids["Arduino Uno R3"]
vlsi_osc_model_id = model_ids["Tektronix TBS1052C Oscilloscope"]

print(f"\n  ℹ️  Total new units created : {unit_total}")
print(f"  ℹ️  First Arduino asset ID  : {iot_first_asset_id}")


# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  HAPPY PATH — Full Borrowing Lifecycle")
print("=" * 60)

now = datetime.utcnow()


# ─── Step 8: Student Requests Arduino for 7 Days ─────────────────────────────
section("Step 8: Student Requests Arduino (7 days)")

r = client.post(
    f"{BASE}/borrowing/requests",
    json={
        "model_id": arduino_model_id,
        "required_from": now.isoformat(),
        "required_until": (now + timedelta(days=7)).isoformat(),
    },
    headers=auth(student_token),
)
expect("8", r, 200, "Student request 7 days")
request_id = r.json()["id"] if r.status_code == 200 else None


# ─── Step 9: Priya Approves ───────────────────────────────────────────────────
section("Step 9: Assistant (Priya) Approves Request")

r = client.post(
    f"{BASE}/borrowing/requests/{request_id}/approve",
    headers=auth(priya_token),
)
expect("9", r, 200, f"Priya approves request #{request_id}")


# ─── Step 10: Checkout (QR Scan) ─────────────────────────────────────────────
section("Step 10: Checkout — scan " + iot_first_asset_id)

r = client.post(
    f"{BASE}/borrowing/checkout",
    json={"request_id": request_id, "asset_id": iot_first_asset_id},
    headers=auth(priya_token),
)
expect("10", r, 200, f"Checkout {iot_first_asset_id}")


# ─── Step 11: Return Equipment ────────────────────────────────────────────────
section("Step 11: Return Equipment")

r = client.post(
    f"{BASE}/borrowing/return",
    json={"asset_id": iot_first_asset_id, "condition_remarks": "Good condition, no damage"},
    headers=auth(priya_token),
)
expect("11", r, 200, f"Return {iot_first_asset_id}")


# ─── Step 12: Verify Unit Back to AVAILABLE ───────────────────────────────────
section("Step 12: Verify Unit Restored to AVAILABLE")

r = client.post(
    f"{BASE}/borrowing/requests",
    json={
        "model_id": arduino_model_id,
        "required_from": now.isoformat(),
        "required_until": (now + timedelta(days=5)).isoformat(),
    },
    headers=auth(student_token),
)
expect("12", r, 200, "Re-request after return succeeds (unit is AVAILABLE again)")
second_request_id = r.json()["id"] if r.status_code == 200 else None


# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  NEGATIVE TESTS")
print("=" * 60)


# ─── Step 13: Student 20 Days → 400 ──────────────────────────────────────────
section("Step 13: Student Exceeds 14-Day Limit → 400")

r = client.post(
    f"{BASE}/borrowing/requests",
    json={
        "model_id": arduino_model_id,
        "required_from": now.isoformat(),
        "required_until": (now + timedelta(days=20)).isoformat(),
    },
    headers=auth(student_token),
)
expect("13", r, 400, "Student 20-day request rejected")


# ─── Step 14: Faculty 35 Days → 400 ──────────────────────────────────────────
section("Step 14: Faculty Exceeds 30-Day Limit → 400")

r = client.post(
    f"{BASE}/borrowing/requests",
    json={
        "model_id": arduino_model_id,
        "required_from": now.isoformat(),
        "required_until": (now + timedelta(days=35)).isoformat(),
    },
    headers=auth(faculty_token),
)
expect("14", r, 400, "Faculty 35-day request rejected")


# ─── Step 15: Student Creates Department → 403 ───────────────────────────────
section("Step 15: Student Tries to Create Department → 403")

r = client.post(
    f"{BASE}/departments/",
    json={"name": "Fake Department", "code": "FAKE", "hod_name": "Nobody"},
    headers=auth(student_token),
)
expect("15", r, 403, "Student blocked from creating dept")


# ─── Step 16: Wrong Assistant Approves → 403 ─────────────────────────────────
section("Step 16: Amit Tries to Approve IoT Lab Request → 403")

r_fresh = client.post(
    f"{BASE}/borrowing/requests",
    json={
        "model_id": arduino_model_id,
        "required_from": now.isoformat(),
        "required_until": (now + timedelta(days=3)).isoformat(),
    },
    headers=auth(student_token),
)
wrong_req_id = None
if r_fresh.status_code == 200:
    wrong_req_id = r_fresh.json()["id"]
    r = client.post(
        f"{BASE}/borrowing/requests/{wrong_req_id}/approve",
        headers=auth(amit_token),
    )
    expect("16", r, 403, "Amit blocked from approving IoT Lab request")
else:
    log("16", f"Could not create request to test: {r_fresh.text}", ok=False)


# ─── Step 17: Checkout Wrong Asset (Model Mismatch) → 400 ────────────────────
section("Step 17: Checkout Wrong Asset ID (Model Mismatch) → 400")

if wrong_req_id:
    # First approve it via Priya (correct assistant)
    r = client.post(
        f"{BASE}/borrowing/requests/{wrong_req_id}/approve",
        headers=auth(priya_token),
    )
    if r.status_code == 200:
        log("17", f"Priya approved request #{wrong_req_id} for mismatch test")
    else:
        log("17", f"Could not approve request for mismatch test: {r.text}", ok=False)

    # Attempt checkout with a VLSI Oscilloscope asset against an IoT/Arduino request
    r = client.post(
        f"{BASE}/borrowing/checkout",
        json={"request_id": wrong_req_id, "asset_id": "LT-VLSI-TM-00001"},
        headers=auth(priya_token),
    )
    expect("17", r, 400, "Checkout with wrong asset_id (model mismatch) rejected")
else:
    log("17", "Skipped — no request available from Step 16", ok=False)


# ─── Step 18: Checkout Already-Issued Unit → 400 ─────────────────────────────
section("Step 18: Checkout Already-Issued Unit → 400")

if second_request_id:
    # Approve the second request (from Step 12)
    r = client.post(
        f"{BASE}/borrowing/requests/{second_request_id}/approve",
        headers=auth(priya_token),
    )
    if r.status_code == 200:
        log("18", f"Priya approved request #{second_request_id}")
    else:
        log("18", f"Could not approve for double-checkout test: {r.text}", ok=False)

    # Checkout the first Arduino unit → marks it ISSUED
    r = client.post(
        f"{BASE}/borrowing/checkout",
        json={"request_id": second_request_id, "asset_id": iot_first_asset_id},
        headers=auth(priya_token),
    )
    if r.status_code == 200:
        log("18", f"Initial checkout of {iot_first_asset_id} succeeded")

        # Create another request and try to checkout the same ISSUED unit
        r_extra = client.post(
            f"{BASE}/borrowing/requests",
            json={
                "model_id": arduino_model_id,
                "required_from": now.isoformat(),
                "required_until": (now + timedelta(days=3)).isoformat(),
            },
            headers=auth(student_token),
        )
        if r_extra.status_code == 200:
            extra_req_id = r_extra.json()["id"]
            client.post(
                f"{BASE}/borrowing/requests/{extra_req_id}/approve",
                headers=auth(priya_token),
            )
            r_double = client.post(
                f"{BASE}/borrowing/checkout",
                json={"request_id": extra_req_id, "asset_id": iot_first_asset_id},
                headers=auth(priya_token),
            )
            expect("18", r_double, 400, f"Double-checkout of {iot_first_asset_id} rejected (already ISSUED)")
        else:
            log("18", f"Could not create extra request: {r_extra.text}", ok=False)
    else:
        log("18", f"Initial checkout failed: {r.text}", ok=False)
else:
    log("18", "Skipped — no request available from Step 12", ok=False)


# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print(f"  RESULTS: {PASS} passed  |  {FAIL} failed")
print("=" * 60 + "\n")

client.close()
sys.exit(0 if FAIL == 0 else 1)
