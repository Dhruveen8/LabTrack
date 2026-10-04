# LabTrack — Full Implementation Plan

> Based on the [Audit Report](file:///C:/Users/LENOVO/.gemini/antigravity-ide/brain/15dce2f6-3b7d-4fdc-a45e-5624cbd1ceeb/labtrack_audit_report.md) findings + 4 new user requirements

---

## New Requirements Summary

| # | Requirement | Root Cause |
|:--|:---|:---|
| NR-1 | Students must NOT access QR printing | [EquipmentDetailPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/EquipmentDetailPage.jsx) shows Print QR to all roles |
| NR-2 | Small daily-use equipment needs a fast borrow flow | No "quick-borrow" or consumable category exists |
| NR-3 | Lab assistant assignment dropdown is broken | Dropdown uses hardcoded `'USR-1002'` and compares string IDs against integer DB IDs |
| NR-4 | No error feedback on incorrect login | [LoginPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/auth/LoginPage.jsx) never displays API error messages |
| NR-5 | Change database to PostgreSQL | Current system uses SQLite, needs to be migrated to PostgreSQL |

---

## Phase 1 — Critical Security Fixes
**Priority: 🔴 IMMEDIATE | Estimated: 2–3 hours**

### Task 1.1: Guard Registration Endpoint (SEC-1)

**Problem:** Anyone can `POST /auth/register` with `role: ADMIN` and create a superuser without authentication.

**Changes:**
| File | Action |
|:---|:---|
| [auth.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/auth.py#L15-L36) | Add `current_user: User = Depends(require_admin)` to `register()` |
| [auth.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/auth.py) | Add a new `POST /auth/seed` endpoint (unguarded, runs once) for initial admin bootstrap |

```diff
 @router.post("/register", response_model=UserSchema)
 async def register(
     user_in: UserCreate,
     db: AsyncSession = Depends(get_db),
+    current_user: User = Depends(require_admin)
 ):
```

### Task 1.2: Protect All GET List Endpoints (SEC-2)

**Problem:** Departments, labs, models, units are readable without any auth.

**Changes:**
| File | Lines | Action |
|:---|:---:|:---|
| [departments.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/departments.py#L29-L32) | 29–32 | Add `Depends(get_current_user)` |
| [labs.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/labs.py#L30-L33) | 30–33 | Add `Depends(get_current_user)` |
| [inventory.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/inventory.py#L30-L33) | 30–33 | Add `Depends(get_current_user)` to models list |
| [inventory.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/inventory.py#L92-L95) | 92–95 | Add `Depends(get_current_user)` to units list |

### Task 1.3: Randomize JWT Secret Key (SEC-3)

**Changes:**
| File | Action |
|:---|:---|
| [config.py](file:///d:/PROJECTS/LABTRACK/backend/app/core/config.py#L10) | Remove hardcoded default, require from `.env` |
| [.env](file:///d:/PROJECTS/LABTRACK/backend/.env) | Generate 64-char random hex: `python -c "import secrets; print(secrets.token_hex(32))"` |

### Task 1.4: Restrict User List to Admin Only (SEC-4)

**Changes:**
| File | Lines | Action |
|:---|:---:|:---|
| [auth.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/auth.py#L58-L64) | 58–64 | Replace `Depends(get_current_user)` → `Depends(require_admin)` |

### Task 1.5: Add Login Error Feedback (NR-4)

**Problem:** [LoginPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/auth/LoginPage.jsx#L15-L19) calls `login()` but never checks the return value for errors. No error state, no error UI.

**Changes:**
| File | Action |
|:---|:---|
| [LoginPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/auth/LoginPage.jsx#L15-L19) | Add `loginError` state, catch API error from `login()`, display error banner |

```jsx
// Add state
const [loginError, setLoginError] = useState('');

const handleLoginSubmit = async (e) => {
  e.preventDefault();
  setLoginError('');
  const result = await login(emailOrId, password, selectedRole);
  if (result && !result.success) {
    setLoginError(result.error || 'Invalid credentials. Please try again.');
    return;
  }
  if (result?.success !== false) {
    navigateToRoleDashboard(selectedRole);
  }
};

// In the form JSX, before the submit button:
{loginError && (
  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
    padding: '0.65rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
    ⚠️ {loginError}
  </div>
)}
```

Also fix [LoginPage.jsx L17](file:///d:/PROJECTS/LABTRACK/src/pages/auth/LoginPage.jsx#L17): Remove the fallback `admin@university.edu` default — require the user to type credentials.

---

## Phase 2 — Backend Missing Endpoints
**Priority: 🟠 HIGH | Estimated: 4–5 hours**

### Task 2.1: Add Reject Endpoint (BE-1)

**File:** [borrowing.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/borrowing.py)

```python
@router.post("/requests/{request_id}/reject", response_model=RequestResponse)
async def reject_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    req = (await db.execute(select(Request).where(Request.id == request_id))).scalars().first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    lab_ids = current_user.assigned_labs or []
    if req.lab_id not in lab_ids:
        raise HTTPException(status_code=403, detail="Not authorized for this lab")
    req.status = RequestStatusEnum.REJECTED
    await db.commit()
    await db.refresh(req)
    return req
```

### Task 2.2: Add Extension Request Endpoints (BE-2)

**Files:** [borrowing.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/borrowing.py), [borrowing.py schema](file:///d:/PROJECTS/LABTRACK/backend/app/schemas/borrowing.py)

New endpoints:
- `POST /borrowing/requests/{id}/extend` — Student/Faculty submits extension (body: `new_due_date`, `reason`)
- `POST /borrowing/requests/{id}/approve-extension` — Assistant approves, updates transaction due_date

New schema:
```python
class ExtensionRequest(BaseModel):
    new_due_date: datetime
    reason: Optional[str] = None
```

### Task 2.3: Add Department CRUD (BE-3a)

**File:** [departments.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/departments.py)

Add:
- `GET /departments/{id}` — single department
- `PUT /departments/{id}` — update (admin only)
- `DELETE /departments/{id}` — delete with cascade check (admin only)

**Frontend:** Add `update` and `delete` methods to [departmentService.js](file:///d:/PROJECTS/LABTRACK/src/services/departmentService.js)

### Task 2.4: Add Lab CRUD (BE-3b)

**File:** [labs.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/labs.py)

Add:
- `GET /labs/{id}` — single lab
- `PUT /labs/{id}` — update (admin only)
- `DELETE /labs/{id}` — delete with cascade check (admin only)

**Frontend:** Replace stubs in [labService.js](file:///d:/PROJECTS/LABTRACK/src/services/labService.js#L57-L67)

### Task 2.5: Add Equipment CRUD (BE-3c)

**File:** [inventory.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/inventory.py)

Add:
- `PUT /inventory/models/{id}` — update model details
- `DELETE /inventory/models/{id}` — delete model + cascade units (admin only, must check no active transactions)
- `PATCH /inventory/units/{asset_id}/status` — update unit status/condition

**Frontend:** Replace stubs in [equipmentService.js](file:///d:/PROJECTS/LABTRACK/src/services/equipmentService.js#L118-L131)

### Task 2.6: Add User CRUD (BE-3d)

**File:** [auth.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/auth.py)

Add:
- `PUT /auth/users/{id}` — update role, assigned_labs, department (admin only)
- `DELETE /auth/users/{id}` — soft-delete or deactivate (admin only)

**Frontend:** Replace stubs in [userService.js](file:///d:/PROJECTS/LABTRACK/src/services/userService.js#L46-L54)

### Task 2.7: Add Bulk Unit Creation Endpoint

**File:** [inventory.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/inventory.py)

Currently the frontend creates units one-by-one in a loop ([equipmentService.js L97-L104](file:///d:/PROJECTS/LABTRACK/src/services/equipmentService.js#L97-L104)). Add:
- `POST /inventory/units/bulk` — accepts `model_id` + `quantity`, creates all units atomically in one transaction

---

## Phase 3 — Lab Assignment & Frontend Data Fixes
**Priority: 🟠 HIGH | Estimated: 3–4 hours**

### Task 3.1: Fix Assistant Dropdown ID Mismatch (NR-3)

**Root Cause:** [LabsListPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/labs/LabsListPage.jsx) has two critical bugs:

1. **Line 19/22/25:** Default values use hardcoded string `'DEPT-EE'` and `'USR-1002'` but the backend returns integer IDs (`1`, `2`, `3`). The `<select>` value never matches any `<option>` value, so the dropdown appears empty/broken.

2. **Line 63:** `usersList.find(u => u.id === selectedAssistantId)` compares integer `u.id` against string `selectedAssistantId` (from `e.target.value`). Always returns `undefined`.

**Fix:**
```diff
- const [selectedAssistantId, setSelectedAssistantId] = useState('USR-1002');
+ const [selectedAssistantId, setSelectedAssistantId] = useState(null);

// In openAssignModal:
- setSelectedAssistantId(lab.inchargeUserId || (assistants[0]?.id || 'USR-1002'));
+ setSelectedAssistantId(lab.incharge_user_id || assistants[0]?.id || null);

// In handleAssignAssistant:
- const ass = usersList.find(u => u.id === selectedAssistantId);
+ const ass = usersList.find(u => u.id === parseInt(selectedAssistantId));
```

Also fix `newLabData.departmentId` default:
```diff
- departmentId: 'DEPT-EE',
+ departmentId: departmentsList[0]?.id || '',
```

### Task 3.2: Fix Lab Department Filter Mismatch

**Problem:** [LabsListPage.jsx L33](file:///d:/PROJECTS/LABTRACK/src/pages/labs/LabsListPage.jsx#L33): `l.departmentId` doesn't exist on the backend response — the backend returns `department_id`. Also the filter uses `===` comparison on integer vs string.

**Fix:**
```diff
- filteredLabs = labsList.filter(l => l.departmentId === selectedDeptId);
+ filteredLabs = labsList.filter(l => (l.department_id || l.departmentId) === parseInt(selectedDeptId));
```

### Task 3.3: Fix Lab Incharge Display

**Problem:** [LabsListPage.jsx L155](file:///d:/PROJECTS/LABTRACK/src/pages/labs/LabsListPage.jsx#L155): Shows `lab.incharge` but the backend doesn't return an `incharge` field — it returns `incharge_user_id` (integer). Need to resolve the name from the users list.

**Fix:** In the lab card rendering, look up the user:
```jsx
const inchargeUser = usersList.find(u => u.id === lab.incharge_user_id);
// Then display:
<span>In-Charge: <strong>{inchargeUser?.name || 'Unassigned'}</strong></span>
```

### Task 3.4: Fix Lab Stats — Use Real Data (FE-5)

**Problem:** [labService.js L80-L95](file:///d:/PROJECTS/LABTRACK/src/services/labService.js#L80-L95) returns fabricated stats.

**Fix:** Create a backend endpoint `GET /inventory/stats` that returns real aggregated counts, or compute from the already-fetched equipment data in `LabTrackContext`:
```javascript
getStats: async () => {
  const [models, units] = await Promise.all([
    apiClient.get('/inventory/models'),
    apiClient.get('/inventory/units')
  ]);
  const available = units.data.filter(u => u.status === 'AVAILABLE').length;
  const issued = units.data.filter(u => u.status === 'ISSUED').length;
  const maintenance = units.data.filter(u => u.status === 'MAINTENANCE').length;
  return { totalEquipment: units.data.length, available, borrowed: issued, maintenance };
}
```

### Task 3.5: Fix Request Status Casing (FE-6)

**Problem:** `"EXTENSION_PENDING"` → `"Extension_pending"` (broken).

**Fix in** [requestService.js L16](file:///d:/PROJECTS/LABTRACK/src/services/requestService.js#L16):
```diff
- status: req.status.charAt(0).toUpperCase() + req.status.slice(1).toLowerCase(),
+ status: req.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
```

### Task 3.6: Fix Default Login Credentials (FE-1)

**File:** [LoginPage.jsx L17](file:///d:/PROJECTS/LABTRACK/src/pages/auth/LoginPage.jsx#L17)

```diff
- await login(emailOrId || 'admin@university.edu', password || 'password', selectedRole);
+ if (!emailOrId || !password) {
+   setLoginError('Please enter your University ID/Email and Password.');
+   return;
+ }
+ const result = await login(emailOrId, password, selectedRole);
```

### Task 3.7: Fix `require_role` Async Correctness (BE-4)

**File:** [deps.py L41](file:///d:/PROJECTS/LABTRACK/backend/app/api/deps.py#L41)

```diff
- def role_dependency(current_user: User = Depends(get_current_user)) -> User:
+ async def role_dependency(current_user: User = Depends(get_current_user)) -> User:
```

---

## Phase 4 — QR Print Role Restriction (NR-1)
**Priority: 🟡 MEDIUM | Estimated: 1–2 hours**

### Task 4.1: Hide QR Print Buttons from Students on Equipment Detail Page

**File:** [EquipmentDetailPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/EquipmentDetailPage.jsx)

```jsx
const { user } = useAuth();
const canPrintQR = user?.role === 'admin' || user?.role === 'assistant';
```

Then wrap all print buttons and QR display with `{canPrintQR && (...)}`:
- [Line 58](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/EquipmentDetailPage.jsx#L58): "Print All QR Stickers" header button
- [Line 89-106](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/EquipmentDetailPage.jsx#L89-L106): Entire "Primary Asset QR Tag" card
- [Line 146-151](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/EquipmentDetailPage.jsx#L146-L151): Per-unit "Print QR" button in table
- [Line 125](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/EquipmentDetailPage.jsx#L125): "Actions" column header (hide for students)

### Task 4.2: Remove QR Details Link from Student Browse Page

**File:** [BrowseEquipmentPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/BrowseEquipmentPage.jsx)

The "Details" link at [line 32](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/BrowseEquipmentPage.jsx#L32) navigates students to the EquipmentDetailPage where they can see asset IDs. For students, either:
- Hide the "Details" link entirely, OR
- Keep it but the Phase 4.1 changes will hide QR content

### Task 4.3: Ensure Add/Bulk Pages Are Already Role-Protected

**Verified:** [App.jsx L96](file:///d:/PROJECTS/LABTRACK/src/App.jsx#L96) and [L104](file:///d:/PROJECTS/LABTRACK/src/App.jsx#L104) already restrict `/equipment/add` and `/bulk-import` to `['admin', 'assistant']`. ✅ No change needed.

---

## Phase 5 — Quick-Borrow / Daily Small Equipment (NR-2)
**Priority: 🟡 MEDIUM | Estimated: 6–8 hours**

> **Problem:** Many small items (multimeters, breadboards, jumper wires, USB cables) are borrowed and returned within the same lab session (1–3 hours). The current flow (submit request → wait for approval → physical counter handover) is too heavy for these items.

### Task 5.1: Add Equipment Type Classification

**Backend:**
| File | Action |
|:---|:---|
| [models.py](file:///d:/PROJECTS/LABTRACK/backend/app/db/models.py) | Add `equipment_type` column to `EquipmentModel`: `STANDARD` (default, current flow) or `QUICK_BORROW` (fast-track) |
| [inventory.py schema](file:///d:/PROJECTS/LABTRACK/backend/app/schemas/inventory.py) | Add `equipment_type` to `EquipmentModelCreate` and `EquipmentModelResponse` |
| Alembic migration | `alembic revision --autogenerate -m "add_equipment_type"` |

```python
class EquipmentTypeEnum(str, enum.Enum):
    STANDARD = "STANDARD"        # Full request → approve → scan → issue flow
    QUICK_BORROW = "QUICK_BORROW" # Same-day, auto-approve, simplified flow
```

### Task 5.2: Quick-Borrow API Endpoint

**File:** [borrowing.py](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/borrowing.py)

New endpoint:
```python
@router.post("/quick-borrow", response_model=TransactionResponse)
async def quick_borrow(
    quick_req: QuickBorrowRequest,  # asset_id + borrower_id
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ASSISTANT))
):
    # 1. Verify unit exists and is QUICK_BORROW type
    # 2. Auto-create Request with status=ISSUED (skip PENDING/APPROVED)
    # 3. Auto-create Transaction with due_date = end_of_today
    # 4. Mark unit as ISSUED
    # Return transaction
```

### Task 5.3: Quick-Return Flow

Add `POST /borrowing/quick-return` — same as regular return but optimized:
- Assistant scans the asset QR only (no borrower lookup needed)
- Auto-locates the active transaction for that unit
- Marks returned

### Task 5.4: Auto-Return Policy for Quick-Borrow Items

Add a scheduled check or middleware:
- Quick-borrow items not returned by end of day → flag as **OVERDUE** with notification to assistant
- Configurable return window (default: same day, 4 hours max)

### Task 5.5: Frontend — Quick-Borrow Counter Page

New page: `src/pages/operations/QuickBorrowPage.jsx`

Simple 2-step flow:
1. **Scan student ID** (text input simulating barcode scanner)
2. **Scan equipment QR** — auto-issues if it's a QUICK_BORROW type item

No approval queue. Shows live list of quick-borrow items currently out.

### Task 5.6: Frontend — Mark Equipment as Quick-Borrow in Add Equipment

**File:** [AddEquipmentPage.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/equipment/AddEquipmentPage.jsx)

Add a toggle/checkbox:
```
☐ Quick-Borrow Item (daily-use, auto-approve, same-day return)
```

When checked, sets `equipment_type: "QUICK_BORROW"` in the creation payload.

### Task 5.7: Dashboard Quick-Borrow Stats

Add a "Quick-Borrow Counter" stat card on [AssistantDashboard.jsx](file:///d:/PROJECTS/LABTRACK/src/pages/dashboards/AssistantDashboard.jsx):
- Items currently out (quick-borrow)
- Items returned today
- Overdue quick items

### Task 5.8: Route and Navigation

| File | Action |
|:---|:---|
| [App.jsx](file:///d:/PROJECTS/LABTRACK/src/App.jsx) | Add route `/quick-borrow` with `allowedRoles={['assistant']}` |
| Sidebar/navigation | Add "Quick Borrow Counter" link for assistants |

---

## Phase 6 — Frontend Mock Services Migration
**Priority: 🟡 MEDIUM | Estimated: 4–5 hours**

### Task 6.1: Notifications Backend

Create `backend/app/api/endpoints/notifications.py`:
- DB model: `Notification(id, user_id, title, message, type, category, read, created_at)`
- `GET /notifications/` — returns notifications for current user
- `PATCH /notifications/{id}/read` — mark as read
- `POST /notifications/mark-all-read`
- Server-side notification creation (triggered by request/checkout/return actions)

Migrate [notificationService.js](file:///d:/PROJECTS/LABTRACK/src/services/notificationService.js) from localStorage to API calls.

### Task 6.2: Settings Backend

Create `backend/app/api/endpoints/settings.py`:
- DB model or config table: `SystemSetting(key, value)`
- `GET /settings/` — admin only
- `PUT /settings/` — admin only

Migrate [settingsService.js](file:///d:/PROJECTS/LABTRACK/src/services/settingsService.js) from localStorage to API calls.

### Task 6.3: Reports Backend

Create `backend/app/api/endpoints/reports.py`:
- `GET /reports/summary` — aggregate real stats from transactions/requests/units
- `GET /reports/monthly-trends` — group transactions by month
- `GET /reports/lab-utilization` — compute from unit status history
- `GET /reports/most-used-equipment` — rank by transaction count

Migrate [reportService.js](file:///d:/PROJECTS/LABTRACK/src/services/reportService.js) from mock data to API calls.

### Task 6.4: Smart Procurement Backend

Create `backend/app/api/endpoints/procurement.py`:
- Analyze equipment with high demand (frequent requests) vs low stock
- `GET /procurement/recommendations` — returns items needing restocking

Migrate [procurementService.js](file:///d:/PROJECTS/LABTRACK/src/services/procurementService.js) from mock data to API calls.

### Task 6.5: Inter-Lab Transfers Backend

Create `backend/app/api/endpoints/transfers.py`:
- DB model: `Transfer(id, equipment_model_id, from_lab_id, to_lab_id, requester_id, status, created_at)`
- `POST /transfers/` — create transfer request
- `PATCH /transfers/{id}/approve` — admin/assistant approves, moves equipment
- `GET /transfers/` — list transfers

Migrate stubs in [requestService.js L88-L101](file:///d:/PROJECTS/LABTRACK/src/services/requestService.js#L88-L101).

### Task 6.6: Remove Mock Data File Dependency

**File:** `src/data/mockData.js` (or similar)

Once all services are migrated, remove `INITIAL_NOTIFICATIONS`, `REPORT_ANALYTICS_DATA`, `SMART_PROCUREMENT_DATA` imports and the mock data file itself.

---

## Phase 7 — Data Integrity & Robustness
**Priority: 🟢 NORMAL | Estimated: 2–3 hours**

### Task 7.1: Fix Asset ID Race Condition (BE-7)

**File:** [inventory.py L63-L75](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/inventory.py#L63-L75)

Use `SELECT ... FOR UPDATE` or a separate sequence table:
```python
# Option A: Use SQLAlchemy with_for_update()
stmt = (
    select(func.max(EquipmentUnit.asset_id))
    .where(EquipmentUnit.asset_id.like(f"{prefix}%"))
    .with_for_update()
)
```

### Task 7.2: Fix Lab Code Collision (BE-6)

**File:** [inventory.py L58](file:///d:/PROJECTS/LABTRACK/backend/app/api/endpoints/inventory.py#L58)

Add a `code` column to the `Lab` model (e.g., `IOT`, `VLSI`, `ECE`) and use it directly in asset IDs instead of parsing the lab name.

### Task 7.3: Add Cascade/Restrict Rules to Foreign Keys

**File:** [models.py](file:///d:/PROJECTS/LABTRACK/backend/app/db/models.py)

Add `ondelete` rules:
```python
department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"))
lab_id = Column(Integer, ForeignKey("labs.id", ondelete="RESTRICT"))
model_id = Column(Integer, ForeignKey("equipment_models.id", ondelete="CASCADE"))
```

### Task 7.4: Fix Deprecated `datetime.utcnow` (BE-5)

**File:** [models.py L92](file:///d:/PROJECTS/LABTRACK/backend/app/db/models.py#L92)

```diff
- issue_date = Column(DateTime, default=datetime.utcnow)
+ issue_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

### Task 7.5: Migrate Database to PostgreSQL (NR-5)

**Files:** [.env](file:///d:/PROJECTS/LABTRACK/backend/.env), [config.py](file:///d:/PROJECTS/LABTRACK/backend/app/core/config.py)

The system currently uses SQLite. We need to completely migrate the database to PostgreSQL.
- Update `SQLALCHEMY_DATABASE_URI` in configuration to use PostgreSQL.
- Add PostgreSQL connection variables to `.env` (e.g., `DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/labtrack`).
- Ensure the `asyncpg` or `psycopg` driver is installed in `requirements.txt`.

---

## Phase 8 — Testing & Validation
**Priority: 🟢 NORMAL | Estimated: 3–4 hours**

### Task 8.1: Automated API Test Suite

Expand [test_workflow.py](file:///d:/PROJECTS/LABTRACK/backend/test_workflow.py) to cover:
- All 41 test cases from the audit report
- New reject/extension/quick-borrow endpoints
- Role-based access control verification
- Edge cases (duplicate registrations, expired tokens, concurrent requests)

### Task 8.2: Frontend Integration Tests

Test each service method against the live backend:
- Login → fetch data → create request → approve → checkout → return
- Lab assignment workflow
- Equipment creation with QR generation
- Quick-borrow counter flow

### Task 8.3: Browser End-to-End Tests

Use the browser subagent to verify:
- Login page error display
- QR print buttons hidden for students
- Assistant dropdown populates correctly
- Dashboard stats match real data

### Task 8.4: Seed Data Reset Script

Create `backend/reset_and_seed.py`:
- Drops all tables
- Recreates schema
- Seeds the 5 demo users + departments + labs + equipment
- Assigns assistants to labs

### Task 8.5: Delete Test Artifacts

Clean up test accounts created during audit (e.g., `hacker@test.com`).

---

## Execution Order & Dependencies

```mermaid
graph TD
    P1[Phase 1: Security Fixes] --> P2[Phase 2: Backend Endpoints]
    P1 --> P3[Phase 3: Frontend Data Fixes]
    P2 --> P5[Phase 5: Quick-Borrow]
    P2 --> P6[Phase 6: Mock Migration]
    P3 --> P4[Phase 4: QR Restrictions]
    P5 --> P8[Phase 8: Testing]
    P6 --> P8
    P4 --> P8
    P2 --> P7[Phase 7: Data Integrity]
    P7 --> P8
```

| Phase | Est. Hours | Dependencies |
|:---|:---:|:---|
| **Phase 1** — Security | 2–3h | None (start immediately) |
| **Phase 2** — Backend Endpoints | 4–5h | Phase 1 |
| **Phase 3** — Frontend Fixes | 3–4h | Phase 1 |
| **Phase 4** — QR Restrictions | 1–2h | Phase 3 |
| **Phase 5** — Quick-Borrow | 6–8h | Phase 2 |
| **Phase 6** — Mock Migration | 4–5h | Phase 2 |
| **Phase 7** — Data Integrity | 2–3h | Phase 2 |
| **Phase 8** — Testing | 3–4h | All previous |
| **Total** | **25–34h** | |

---

> [!IMPORTANT]
> **Phases 1 + 3 are the most impactful immediate wins** — they fix the security holes, make login work properly, and fix the broken assistant dropdown. Recommend starting there.

> [!TIP]
> Phase 5 (Quick-Borrow) is the largest new feature. Consider splitting it into Phase 5a (backend + basic UI) and Phase 5b (auto-return, dashboard stats) if you want incremental delivery.
