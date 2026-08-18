# LabTrack - Enterprise Laboratory & Equipment Management System

LabTrack is an enterprise-grade, multi-department web platform built to handle university-wide laboratory inventory tracking, equipment checkout/return workflows, QR code asset tagging, inter-lab transfers, and procurement analytics.

---

## 🚀 Tech Stack & System Architecture

* **Frontend**: React 19, TypeScript / JSX, Vite 8, React Router v7, Lucide Icons, Recharts, `qrcode.react`
* **Styling & Design System**: Vanilla CSS Design Tokens (Institutional Academic Portal Theme)
* **Data Layer**:
  * **Phase 1 (Active)**: In-Memory Client Store + `localStorage` persistence
  * **Phase 2 (Roadmap Target)**: Decoupled Python FastAPI Backend + Relational Database (PostgreSQL) + Redis Caching
* **Linting & Code Quality**: Oxlint

---

## 🏢 Multi-Department & Multi-Lab Hierarchy

To reflect authentic university structures:

1. **Departments & Laboratories Structure**:
   * A single university department (e.g. Electrical Engineering) contains **multiple specialized laboratories** (e.g. IoT Lab, VLSI Lab, Power Electronics Lab).
   * **Super Admin**: Manages departments, creates laboratories, and assigns Lab Assistants to oversee specific laboratories. A single Lab Assistant can be assigned to manage multiple laboratories within a department.
2. **Strict Role-Based Access Control (RBAC)**:
   * **Admin**: System configuration, department/lab creation, assistant assignments, user directory management, and global analytics. *Admin cannot approve equipment requests or perform counter checkout.*
   * **Lab Assistant**: Exclusive authority to review and approve/reject equipment borrowing requests for their assigned laboratories, operate the physical counter desk (scan borrower ID + scan equipment QR), and process returns.
   * **Faculty**: Browse equipment across all campus labs, submit borrowing requests (max 30 days period), submit digital extensions, and request inter-lab transfers.
   * **Student**: Self-service equipment availability browsing, submit reservation requests (max 14 days period), view checkout history, and request online re-issues / extensions.

---

## 🔄 Redesigned Equipment Checkout & Return Lifecycle

LabTrack enforces a structured, audit-proof workflow with precise QR code scanning timing:

```
[Student / Faculty]
   │
   ├─► 1. Browse Lab Inventory
   ├─► 2. Submit Reservation Request (Max 14 days for students / Max 30 days for faculty)
   │
[Lab Assistant]
   │
   ├─► 3. Review Request in Queue ──► [Approve / Reject]
   │        (Status: APPROVED — Ready for Physical Pickup)
   │
[Physical Counter Desk Handover]
   │
   ├─► 4. Borrower arrives at Lab Counter
   ├─► 5. Assistant scans Borrower University ID Card (Step 1)
   ├─► 6. System loads verified APPROVED requests for borrower
   ├─► 7. Assistant selects request & scans Equipment Asset QR Tag (Step 2)
   ├─► 8. System validates unit matches model & is AVAILABLE
   ├─► 9. Confirm Handover (Step 3) ──► (Status: ISSUED, Transaction Created)
   │
[During Borrowing Period — Extension / Re-Issue]
   │
   ├─► 10. Borrower requests extension online from portal (No QR re-scan needed)
   ├─► 11. Assistant approves extension digitally ──► Due date extended
   │
[Physical Return Counter]
   │
   └─► 12. Borrower returns equipment to lab
       13. Assistant scans Equipment Asset QR Tag
       14. Assistant inspects physical condition & enters remarks
       15. Confirm Return ──► Unit restored to AVAILABLE stock (Status: RETURNED)
```

---

## 🏷️ Unique QR Code Tagging & Bulk Import Standard

### 1. Unique Asset ID Format
Every physical unit receives a unique Asset ID:
```
LT-[LAB_CODE]-[CATEGORY_CODE]-[SEQUENCE]
```
* Examples:
  * `LT-IOT-MC-00001` (Arduino Uno R3 #1 in IoT Lab)
  * `LT-IOT-MC-00002` (Arduino Uno R3 #2 in IoT Lab)
  * `LT-ECE-TM-00001` (Tektronix Oscilloscope #1 in Electronics Lab)

### 2. Multi-Unit & Same-Type Equipment Handling
* When 10 units of an equipment model are added, 10 distinct physical unit records are created with sequential Asset IDs.
* When additional units of the same type are added or imported later, the sequence counter automatically continues without duplicate IDs.

### 3. Bulk CSV / Excel Import
* Upload a CSV spreadsheet containing equipment models and unit quantities.
* The system automatically generates all individual unit records with sequential Asset IDs.
* **Instant QR Sticker Sheet**: Displays an A4 Avery 3×8 printable sticker sheet with live QR codes powered by `qrcode.react` (`@media print` supported).

---

## ⏳ Borrowing Duration & Extension Policies

| Role | Maximum Borrowing Limit | Extension Mechanism |
| :--- | :---: | :--- |
| **Student** | **14 Days** | Submit online extension request on active transaction $\rightarrow$ Assistant approves $\rightarrow$ No QR re-scan required |
| **Faculty** | **30 Days** | Submit online extension request on active transaction $\rightarrow$ Assistant approves $\rightarrow$ No QR re-scan required |

---

## 🗄️ Relational Database Schema Blueprint (PostgreSQL Phase 2 Target)

For production deployment with Python FastAPI, LabTrack targets a normalized PostgreSQL relational database:

* **`departments`**: `id`, `name`, `code`, `hod_name`.
* **`labs`**: `id`, `department_id`, `name`, `location`, `incharge_user_id`.
* **`equipment_models`**: `id`, `lab_id`, `name`, `category`, `total_quantity`, `description`.
* **`equipment_units`**: `asset_id` (PK, e.g. `LT-IOT-MC-00001`), `model_id`, `serial_number`, `status` (`AVAILABLE | ISSUED | MAINTENANCE`), `condition`, `qr_code_url`.
* **`users`**: `id`, `email`, `name`, `role` (`ADMIN | ASSISTANT | FACULTY | STUDENT`), `department_id`, `assigned_labs` (JSON/Array).
* **`requests`**: `id`, `requester_id`, `equipment_id`, `lab_id`, `required_from`, `required_until`, `status` (`PENDING | APPROVED | ISSUED | RETURNED | REJECTED | EXTENSION_PENDING | EXTENDED`).
* **`transactions`**: `id`, `request_id`, `unit_asset_id`, `equipment_id`, `borrower_id`, `lab_id`, `issue_date`, `due_date`, `return_date`, `status`, `reissued_count`.

---

## 🏃 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```
