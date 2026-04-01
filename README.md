<div align="center">

<h1>🏫 HostelSync</h1>

<p><strong>A Web-Based Hostel Management System for Academic Institutions</strong></p>

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-hostelsync.me-2E75B6?style=for-the-badge)](https://hostelsync.me)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

<br/>

> **HostelSync** digitizes hostel operations — replacing paper registers with a secure, real-time, role-based platform for managing outing approvals, attendance, student movement, and more.

<br/>

</div>

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/Kadhiravan2002/Hostelsync/main/screenshots/login.png" alt="Login Page" width="400"/>
      <br/><sub><b>🔐 Login Page — Student / Staff / Admin</b></sub>
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/Kadhiravan2002/Hostelsync/main/screenshots/principal-dashboard.png" alt="Principal Dashboard" width="400"/>
      <br/><sub><b>📊 Principal Dashboard — System-wide Overview</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/Kadhiravan2002/Hostelsync/main/screenshots/student-database.png" alt="Student Database" width="400"/>
      <br/><sub><b>🎓 Student Database — 47 Students with Filters</b></sub>
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/Kadhiravan2002/Hostelsync/main/screenshots/attendance-overview.png" alt="Attendance Overview" width="400"/>
      <br/><sub><b>📅 Attendance Overview — Boys & Girls Hostel</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://raw.githubusercontent.com/Kadhiravan2002/Hostelsync/main/screenshots/approval-history.png" alt="Approval History" width="820"/>
      <br/><sub><b>📋 System-wide Approval History — Full Audit Trail</b></sub>
    </td>
  </tr>
</table>

> 💡 **To display screenshots:** Create a `screenshots/` folder in your repo root and upload the 5 images with these filenames:
> `login.png`, `principal-dashboard.png`, `student-database.png`, `attendance-overview.png`, `approval-history.png`

---

## 📌 Overview

HostelSync is a **production-ready**, full-stack hostel management system built for **St. Peter's College of Engineering and Technology**. It eliminates paper-based hostel workflows by providing a centralized platform where students, staff, and administrators can manage hostel operations digitally — with real-time data, role-specific dashboards, and automated notifications.

### 🔑 Key Highlights
- ✅ **Live & Production Deployed** at [hostelsync.me](https://hostelsync.me)
- 🔐 **5-Role RBAC** with database-level Row-Level Security (RLS)
- 🔄 **Multi-Stage Outing Approval** — Student → Advisor → HOD → Warden
- 📍 **Real-Time Movement Tracking** — Inside / Outside / Overdue
- 📊 **Attendance Analytics** — Daily, Weekly, Monthly views
- 📧 **Guardian Notifications** via Email & SMS on outing decisions
- 📥 **Excel Export** for approval history and reports

---

## ✨ Features

### 👥 Role-Based Dashboards

| Role | Access & Capabilities |
|------|----------------------|
| 🎓 **Student** | Submit outing requests, track status, view profile & attendance |
| 🧑‍🏫 **Advisor** | Stage 1 approval/rejection, filter students by dept/year |
| 🏛️ **HOD** | Stage 2 approval/rejection, download Excel reports |
| 🏠 **Warden** | Final approval, attendance marking, room management, movement monitoring (hostel-scoped) |
| 🎖️ **Principal** | System-wide monitoring, analytics, full approval chain, all reports |

---

### 🧾 Multi-Stage Outing Approval Workflow

```
 Student ──► Advisor ──► HOD ──► Warden ──► ✅ Approved
               │           │        │
               └── ❌ Reject (with comments at any stage)
```

- Two outing types: **Local Outing** and **Hometown Visit**
- Each stage independently approves or rejects with comments
- Full **audit trail** stored — approver name, role, action, timestamp
- Guardian notified via **Email/SMS** on final decision

---

### 🚶 Real-Time Student Movement Tracking

| Status | Indicator | Condition |
|--------|-----------|-----------|
| Inside | 🟢 Green | No active approved outing |
| Outside | 🔴 Red | Within approved outing window |
| Overdue | ⚠️ Orange | Past return time, not yet back |

Filter by Department, Year, or Status — summary cards show live counts.

---

### 📅 Attendance Management

- Wardens mark daily attendance per student
- Three states: **Present**, **Absent**, **Not Marked**
- **Daily / Weekly / Monthly** analytics views
- Boys & Girls hostel split with system-wide totals for Principal
- Date-range filtering and export support

---

### 🏠 Room Management

- Assign and manage room allocations per hostel
- Composite key `(room_number + hostel_type)` — identical room numbers can exist in Boys and Girls hostels without conflict
- Warden-scoped: each warden only sees their hostel's rooms

---

### 🧑‍🎓 Student Management

- Centralized student database with avatar, hostel badge (Boys/Girls), and profile tooltips
- Advanced filters: **Name**, **Register No.**, **Department**, **Year**, **Hostel Type**, **Room**
- Role-scoped: Advisors see their dept, Wardens see their hostel, Principal sees all

---

### 📥 Data Export & Notifications

- Export approval history to **Excel (.xlsx)** — respects active filters
- **Email & SMS** alerts to guardians via Supabase Edge Functions
- Triggered automatically on final outing approval or rejection

---

### 🧾 Complaint Management

- Students submit complaints with optional **file attachments**
- Role-based visibility — Warden sees hostel complaints, Principal sees all
- Structured, trackable grievance handling

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React.js + Vite | Component-based UI, fast HMR |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **UI Components** | ShadCN UI | Accessible, consistent component library |
| **Backend** | Supabase (BaaS) | Auth, real-time queries, RLS, storage |
| **Database** | PostgreSQL | Relational data with RLS policies |
| **Serverless** | Supabase Edge Functions | Guardian notifications, background logic |
| **Export** | SheetJS (xlsx) | Excel report generation |
| **Hosting** | Vercel + Supabase Cloud | Global CDN, managed DB |

---

## 🏗️ Project Structure

```
Hostelsync/
├── public/                     # Static assets
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # ShadCN base components
│   │   ├── dashboards/         # Role-specific dashboard views
│   │   ├── outing/             # Outing request components
│   │   ├── attendance/         # Attendance management
│   │   ├── movement/           # Student movement tracking
│   │   ├── rooms/              # Room management
│   │   └── complaints/         # Complaint system
│   ├── pages/                  # Route-level pages
│   │   ├── Login.jsx
│   │   ├── StudentDashboard.jsx
│   │   ├── AdvisorDashboard.jsx
│   │   ├── HODDashboard.jsx
│   │   ├── WardenDashboard.jsx
│   │   └── PrincipalDashboard.jsx
│   ├── lib/
│   │   └── supabaseClient.js   # Supabase client initialization
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Helper functions & export logic
│   ├── App.jsx                 # Root component & routing
│   └── main.jsx                # Entry point
├── .env.example                # Environment variable template
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone the Repository

```bash
git clone https://github.com/Kadhiravan2002/Hostelsync.git
cd Hostelsync
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> 🔑 Find these in your Supabase project under **Settings → API**

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production

```bash
npm run build
```

---

## 🗄️ Database Setup

This project uses **Supabase PostgreSQL** with Row-Level Security. The core tables are:

```sql
-- Core Tables
students          -- Student profiles, dept, year, room, hostel type, guardian
outing_requests   -- Request details, type (local/hometown), dates, status
approval_history  -- Audit log: approver, role, action, comments, timestamp
attendance        -- Daily records: Present / Absent / Not Marked
rooms             -- Room allocation with hostel isolation
complaints        -- Student grievances with attachment support
```

> 📌 SQL migration files are located in `supabase/migrations/` (if included) or set up tables manually via the Supabase dashboard.

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| **Row-Level Security** | PostgreSQL RLS policies on all tables |
| **Hostel Isolation** | Wardens can only access their own hostel's data |
| **Role-Based Auth** | Role claims validated server-side per API request |
| **Admin Control** | Role assignment managed by administrators only |
| **Data Separation** | Boys/Girls hostel data isolated via `hostel_type` column |

---

## 🌐 Deployment

The live application is deployed at **[hostelsync.me](https://hostelsync.me)**

- **Frontend** → Deployed on [Vercel](https://vercel.com) with global CDN
- **Backend/DB** → Hosted on [Supabase Cloud](https://supabase.com) (managed PostgreSQL)
- **Edge Functions** → Deployed via Supabase for guardian notifications

To deploy your own instance:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

### Steps

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit** your changes with a clear message
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. **Push** to your branch
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** against the `main` branch

### Commit Message Convention

Use conventional commits for clarity:

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Formatting, no logic change |
| `refactor:` | Code restructuring |
| `chore:` | Build/config changes |

### Guidelines

- Keep PRs focused — one feature or fix per PR
- Test your changes locally before submitting
- Update documentation if adding new features
- Follow the existing code style (ESLint + Prettier)

---

## 👨‍💻 Authors

<table>
  <tr>
    <td align="center">
      <b>A. Kadhiravan</b><br/>
      <a href="https://github.com/Kadhiravan2002">@Kadhiravan2002</a>
    </td>
    <td align="center">
      <b>Y. Sanjay</b><br/>
      Developer
    </td>
  </tr>
</table>

**Project Guide:** Ms. D. Jayanthi, Assistant Professor — Dept. of Information Technology
**Institution:** St. Peter's College of Engineering and Technology, Avadi, Chennai
**Academic Year:** 2025 – 2026 | Final Year B.Tech (Information Technology)

---

## 📄 License

This project is developed as a **Final Year B.Tech Project** at St. Peter's College of Engineering and Technology.

© 2026 **A. Kadhiravan & Y. Sanjay** — All Rights Reserved.

---

<div align="center">

**⭐ If you found HostelSync useful, please star the repository!**

[![GitHub stars](https://img.shields.io/github/stars/Kadhiravan2002/Hostelsync?style=social)](https://github.com/Kadhiravan2002/Hostelsync/stargazers)

*Built with ❤️ at St. Peter's College of Engineering and Technology*

</div>
