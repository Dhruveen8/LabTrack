# LabTrack - Laboratory & Equipment Management System

LabTrack is a web platform designed to streamline laboratory inventory tracking, equipment issue & return operations, inter-lab transfers, and procurement analytics.

---

## 🚀 Tech Stack

* **Core**: React 19, Vite 8, React Router v7
* **Styling & UI**: Vanilla CSS, Lucide Icons
* **Data & Charts**: Recharts
* **Linting**: Oxlint

---

## 🌿 Git Branching Strategy (3-Member Team)

We follow a **Feature Branch Workflow** branching off `dev`:

* **`main`**: Production-ready, stable code only.
* **`dev`**: Integration branch for active development.

### 👥 Team Work Division

| Member | Focus Area | Functional Modules | Branch Prefix |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Equipment & Operations** | Equipment inventory, Add/Detail, Issue & Return, Event Issue, Bulk Import | `feature/equipment-*`, `feature/operations-*` |
| **Member 2** | **Requests & Dashboards** | Equipment requests, Inter-lab transfers, Transactions, Faculty/Student dashboards | `feature/requests-*`, `feature/dashboards-*` |
| **Member 3** | **Admin & Analytics** | Reports & Analytics, Smart Procurement, User Management, Contexts & Services | `feature/analytics-*`, `feature/admin-*` |

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

