# LabTrack - Enterprise Laboratory & Equipment Management System

LabTrack is an enterprise-grade, multi-department web platform built to handle university-wide laboratory inventory tracking, equipment issue & return operations, damage detection via ML, inter-lab transfers, QR code asset tagging, and procurement analytics.

---

## 🚀 Tech Stack & Enterprise Architecture

* **Frontend**: React 19, Vite 8, React Router v7, Lucide Icons, Recharts, `qrcode.react`
* **Styling & Design System**: Vanilla CSS Design Tokens
* **ML Microservice**: Python FastAPI, PyTorch, YOLOv8, OpenCV, PaddleOCR
* **Data Storage**: Object Storage (S3/R2 for photos) + Relational DB (PostgreSQL) + Redis Caching
* **Linting**: Oxlint

---

## 🏢 University-Wide Scalability Standards

To ensure LabTrack scales seamlessly across multiple departments, thousands of students, and thousands of equipment items:

1. **Multi-Department Data Hierarchy**:
   `University` ➔ `Departments` (CS, EEE, Mech, Bio) ➔ `Labs` (Robotics Lab, VLSI Lab) ➔ `Equipment`
2. **Role-Based Access Control (RBAC)**:
   Strict permission boundaries for `Super Admin`, `Dept Admin`, `Lab Assistant`, `Faculty`, and `Student`.
3. **Asynchronous ML Processing**:
   Heavy AI processing (Damage Detection & Bulk OCR Scanning) is offloaded to async message queues (Redis/Celery) to keep HTTP requests fast and resilient.
4. **Cloud Media Storage**:
   Equipment images and Before/After scan photos are stored in Cloud Object Storage (S3/R2) with CDN delivery.

---

## 🤖 Advanced ML & Core Features

### 1. 🏢 Admin Lab Management
* Create, edit, and assign labs to departments and lab assistants in [`src/pages/labs/LabsListPage.jsx`](file:///d:/PROJECTS/LABTRACK/src/pages/labs/LabsListPage.jsx).
* Managed via `addLab()` in [`LabTrackContext.jsx`](file:///d:/PROJECTS/LABTRACK/src/context/LabTrackContext.jsx).

### 2. 🔍 Image Damage Detection Model (Before vs. After)
* **Workflow**: Compares equipment photo taken at **Issue Time** with photo taken at **Return Time** on [`src/pages/operations/ReturnEquipmentPage.jsx`](file:///d:/PROJECTS/LABTRACK/src/pages/operations/ReturnEquipmentPage.jsx).
* **ML Engine**: OpenCV (image registration) + YOLOv8 (defect detection).
* **Output**: Returns damage flag (`hasDamage: true`), confidence score, and annotated image with red defect highlights.

### 3. 📦 Smart Bulk Equipment Import
* **CSV / Excel Import**: Parse spreadsheet files into inventory objects.
* **Photo OCR Import**: Upload a batch photo of equipment asset tags/labels $\rightarrow$ PaddleOCR extracts serial numbers, models, and quantities into a staging table in [`src/pages/operations/BulkImportPage.jsx`](file:///d:/PROJECTS/LABTRACK/src/pages/operations/BulkImportPage.jsx).

### 4. 🏷️ Keyword-Based Smart Categorization
* Automatic category suggestion (e.g., typing *"Rigol DS1054Z"* auto-assigns *"Oscilloscopes & Electronics"*).
* Powered by fuzzy matching (`fuse.js`) and rule-based dictionary mapping in [`src/utils/categoryMatcher.js`](file:///d:/PROJECTS/LABTRACK/src/utils/categoryMatcher.js).

---

## 🏷️ Barcode & QR Code Tagging Architecture

### 1. Unique Asset ID Standard
Format: `LT-[DEPT]-[CATEGORY]-[SEQUENCE]` (e.g., `LT-CS-EQ-00492` or `LT-EE-KIT-00104`).

### 2. QR Code Payload
Stores a direct web URL: `https://labtrack.univ.edu/equipment/LT-CS-EQ-00492`. Scanning with any phone camera or scanner opens the item page instantly.

### 3. Cables, Wires & Accessory Tagging
* **High-Value Cables & Probes**: Use **Self-Laminating Cable Flag Stickers** or **Zip-Tie Tag Plates**.
* **Standard Cables (HDMI, Power Cords)**: Managed via **Kit / Bundle Tagging** in software under the parent device.

### 4. Bulk QR Code Printing
* Built with `qrcode.react` (`QRCodeCanvas` with High Error Correction `level="H"`).
* Bulk print layout formatted with CSS `@media print` onto standard A4 sticker sheets (3x8 Avery grid).

---

## 🌿 Git Branching Strategy (3-Member Team)

We follow a **Feature Branch Workflow** branching off `dev`:

* **`main`**: Production-ready, stable code only.
* **`dev`**: Integration branch for active development.

### 👥 Team Work Division

| Member | Focus Area | Functional Modules | Branch Prefix |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Equipment, Operations & Bulk** | Equipment inventory, Issue & Return UI, Bulk Import & QR printing | `feature/equipment-*`, `feature/operations-*` |
| **Member 2** | **Requests, Labs & Dashboards** | Admin Lab Management, Equipment requests, Inter-lab transfers, Role dashboards | `feature/requests-*`, `feature/labs-*` |
| **Member 3** | **Admin, Analytics & ML Microservice** | Reports & Analytics, Smart Procurement, Damage Detection API, Keyword Categorization | `feature/analytics-*`, `feature/ml-*` |

---

## 🛠️ Git Workflow Rules

1. **Always branch off `dev`**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```
2. **Commit with descriptive messages**:
   ```bash
   git commit -m "feat(equipment): add search and filter options"
   ```
3. **Submit a Pull Request (PR)** targeting `dev`. Require **at least 1 peer approval** before merging.

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



