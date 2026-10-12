# Student carts and combined equipment requests

Student carts persist in PostgreSQL per registered user. Adding, editing or removing a cart item never reserves a physical unit. Cart responses calculate live available stock in the selected lab. Desired quantities remain present when stock becomes insufficient; students revise or remove them explicitly.

## Setup

Apply the migration before starting this version of the backend:

```powershell
cd backend
./.venv/Scripts/python.exe -m alembic upgrade head
```

Migration `i3d8e0f7a5b6` has already been applied to the current local database. Other installations need it. It adds `cart_items`, `request_items`, `request_allocations`, an optional request submission key, an optional transaction item reference, and the `RESERVED` unit status. Existing request IDs, statuses, roles, transaction records and equipment models remain intact. Old requests keep their original single-model behavior. No dependency or SMTP configuration changes are required.

Restart the backend and frontend. Students can add equipment from Browse Equipment or Equipment Cart (`/cart`, also available from `/request-equipment`). Cart badges count units. The cart refreshes on entry, focus, quantity changes, explicit refresh and every 15 seconds while open. Before submission it presents all quantities, labs, dates and purpose for final review.

## Allocation and availability

Submission creates one existing `Request` plus its item rows. All requested physical units are selected and locked in deterministic order in one transaction. `FOR UPDATE SKIP LOCKED` prevents competing submissions from allocating the same last unit. Units become `RESERVED` only when the complete request is committed. If any item is short or busy, the API returns HTTP 409 and rolls back every allocation. The cart stays intact.

The existing request model/lab columns retain the first item's real model/lab references for legacy compatibility. `request_items` is authoritative for combined item details, lab scope and fulfillment. `requests.quantity` is the total unit count. Each issued unit keeps its existing `Transaction.request_id` and also references its exact request item. The existing unique active-loan index remains a database backstop.

Borrower row locks serialize concurrent submissions for the same student and preserve configured item limits. Submission keys make lost-response retries idempotent; changed payloads cannot reuse the same key. A cart changed in another tab/device must be reviewed again before it can be submitted.

## Assistant issue and return

The assistant dashboard and Requests page show one request with every equipment type and quantity. Each lab assistant approves/rejects only pending items in their assigned labs. A request spanning labs can remain Pending while another lab's approved items are ready for pickup. Item status, issued quantity, returned quantity and reserved asset tags are shown explicitly.

At the counter, scan the registered student ID as before, select the request, then scan an exact reserved asset shown for an approved item. The server validates the unit, its model, owning lab, allocation and assistant scope again under locks. Each scan creates one transaction and uses the existing HTML issuance email. The counter remains open for subsequent scans. Approved deadlines are read from the request; scanning cannot silently change them.

Returns retain barcode scanning, condition handling, maintenance routing, due reminders and emails. Returning an early pickup does not close a request with unissued allocations. Item and parent statuses reflect outstanding pickups and active loans. Extensions of a combined request require an assistant assigned to every lab with an active item; an assistant cannot extend another lab's loan.

Rejected items release only their allocated units. The existing minute-based background worker releases uncollected allocations when the request's return deadline expires, marks those items Cancelled and notifies the borrower. Units already issued remain on loan and continue to get their normal reminders. Keep the backend running for expiry processing. Inventory edits, counter walk-ins, quick borrow, event issue and transfer approval cannot take `RESERVED` units.

## Tests

```powershell
./.venv/Scripts/python.exe -m pytest tests
$env:LABTRACK_CART_DB_TEST="1"
$env:LABTRACK_EMAIL_DB_TEST="1"
$env:LABTRACK_EVENT_DB_TEST="1"
./.venv/Scripts/python.exe -m pytest tests
```

From the repository root:

```powershell
node --test tests/*.test.js
npm run lint
npm run build
```

PostgreSQL API tests roll back their fixtures. Concurrency tests create UUID-scoped fixtures so independent database sessions can compete, then delete only those fixtures in `finally`. SMTP is mocked or disabled. Tests cover multi-type quantities, stale carts, partial stock shortages, borrower limits, simultaneous last-unit submissions, idempotent retries, per-lab approvals, student lookup, exact-unit issue, repeat scans, partial returns, rejection and expiry.

For optional manual browser QA, `tests/cart_browser_server.py` starts a loopback-only backend on 8001 with disposable student/assistant fixtures and email/scheduler workers disabled. Point a separate Vite instance to it with `VITE_API_URL=http://127.0.0.1:8001/api/v1` on `127.0.0.1:5174`. Stop the QA backend with Ctrl+C to clean up its fixtures. Never use the disposable accounts for production.

The migration downgrade refuses to discard active allocations. Release them before downgrading. PostgreSQL retains the additive `RESERVED` enum value on downgrade; it becomes unused.


## Files added or updated

- Database: `app/db/models.py`, `alembic/versions/i3d8e0f7a5b6_cart_request_items.py`.
- Backend APIs/schema: `app/api/api_router.py`, `app/api/endpoints/cart.py`, `app/api/endpoints/borrowing.py`, `app/api/endpoints/inventory.py`, `app/api/endpoints/transfers.py`, `app/schemas/borrowing.py`.
- Backend services: `app/services/cart_requests.py`, `app/services/request_fulfillment.py`, `app/services/loan_reminders.py`.
- Backend tests: `tests/test_cart_validation.py`, `tests/test_cart_integration.py`, `tests/test_quick_borrow_deadline.py`, `tests/cart_browser_server.py`.
- Frontend routing/state: `src/App.jsx`, `src/context/CartContext.jsx`, `src/context/LabTrackContext.jsx`, `src/context/contextDefinitions.js`, `src/context/hooks.js`.
- Frontend layout/views: `src/layouts/MainLayout.jsx`, `src/layouts/MainLayout.css`, `src/pages/requests/CartPage.jsx`, `src/pages/requests/CartPage.css`, `src/pages/requests/RequestEquipmentPage.jsx`, `src/pages/requests/RequestsListPage.jsx`, `src/pages/equipment/BrowseEquipmentPage.jsx`, `src/pages/dashboards/AssistantDashboard.jsx`, `src/pages/operations/IssueEquipmentPage.jsx`, `src/components/common/StatusBadge.jsx`.
- Frontend services/helpers/tests: `src/services/cartService.js`, `src/services/requestService.js`, `src/services/transactionService.js`, `src/services/equipmentService.js`, `src/utils/cart.js`, `src/utils/issueValidation.js`, `tests/cart.test.js`.
- Documentation: root `README.md` and `backend/CART_REQUESTS.md`.
- Browser evidence: `output/cart-qa/unavailable-cart-desktop.png`, `output/cart-qa/unavailable-cart-mobile.png`, `output/cart-qa/assistant-combined-request.png`.

Verification: 80 backend tests passed with all PostgreSQL integration options enabled, 9 frontend tests passed, lint passed, and the production build passed. The build retains its existing large-bundle advisory. Browser QA checked cart persistence, the last-unit scenario, combined review/submission, assistant lab-specific approval, student ID lookup, reserved-unit scanning, handover and the mobile layout. Browser QA email/scheduler workers were disabled and all disposable test records were removed.
