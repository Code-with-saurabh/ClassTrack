# ClassTrack — User Instructions & Daily Workflows

> **ClassTrack** is a role-based academic management system (MERN).  
> Three roles: **Admin**, **Faculty**, **Student**. Each role sees only its own portal after login.

---

## 1. Login (all users)

| Step | Action |
|------|--------|
| 1 | Open `http://localhost:5173` |
| 2 | Enter **Email** + **Password** (or click a demo card to auto-fill) |
| 3 | Click **Sign in** |
| 4 | You land on your role’s Dashboard |

### Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@classtrack.com` | `admin123` |
| Faculty | `hem@classtrack.com` | `faculty123` |
| Student | `student1@classtrack.com` | `student123` |

More faculty: `sanchi@`, `ankita@`, `priyanka@`, `siba@classtrack.com` — password `faculty123`.  
Students: `student1@` … `student75@classtrack.com` — password `student123`.

---

## 2. What each user can do

### 2.1 Admin

**Can do**

| Area | Actions |
|------|---------|
| Dashboard | View totals (students, faculty, subjects), attendance stats, recent activity |
| Students | Add, edit, deactivate, search/filter students; pagination |
| Faculty | Add, edit, assign subjects; pagination |
| Subjects | Create subjects, assign faculty, edit codes/credits |
| Timetable | Build weekly lecture grid (division, day, period, subject, faculty, room) |
| Daily Register | Open any date → per-lecture Present/Absent/Unmarked list |
| Attendance Report | Class report, threshold filters, **Print / PDF** export |
| Notifications | View bell (unread count); system auto-creates low-attendance alerts |
| Logout | Sidebar or topbar **Logout** |

**Cannot**

- Take attendance (faculty only)
- Enter marks (faculty only)
- See “My Marks” / student personal portal

### 2.2 Faculty

**Can do**

| Area | Actions |
|------|---------|
| Dashboard | Today’s lectures, quick stats |
| Take Attendance | Pick date + lecture → mark **Present / Absent** (or Present-all / Absent-all) → **Save** |
| Analytics | Subject-wise attendance %, pie/bar/line charts, filter by subject/category |
| Daily Register | Your lectures for a date → P / A / U per student |
| Enter Marks | Select subject + exam type → enter marks for whole class (range-validated) → Save |
| Report & PDF | Attendance report + print |
| Notifications | Bell + mark read |

**Cannot**

- Manage students/faculty/subjects/timetable (admin only)
- Mark attendance for lectures not assigned to them

### 2.3 Student

**Can do**

| Area | Actions |
|------|---------|
| Dashboard | Overall attendance %, subject breakdown, low-attendance warnings (below 75%) |
| Timetable | Weekly schedule for your division |
| My Marks | Exam marks per subject (e.g. Mid-term `/30`) |
| Notifications | New marks / low-attendance alerts |
| Logout | Sidebar / topbar |

**Cannot**

- Edit attendance or marks
- See other students’ personal marks list
- Access admin/faculty routes

---

## 3. Daily tasks by role

### Faculty — every working day

1. **Login** before first lecture.
2. **Take Attendance** for each of your lectures (usually 3–5/day):
   - Confirm date + period (defaults to today / next slot).
   - Tap **Present** or **Absent** per student (or bulk buttons).
   - **Save** — re-saving same day updates, never duplicates.
3. During exam weeks: **Enter Marks** once results are ready (students get a notification).
4. Occasionally: check **Analytics** for weak students; open **Daily Register** if admin asks.
5. **Logout** on shared PCs.

### Student — daily / weekly habit

1. **Login** (or keep session — JWT lasts 7 days).
2. Open **Dashboard**:
   - Overall % — stay **above 75%**.
   - Fix any subject marked **Low** (red/warning).
3. Check **Timetable** for today’s lectures.
4. After exams, open **My Marks** for new scores.
5. Check **notification bell** for alerts.

### Admin — weekly / as needed

1. **Students / Faculty / Subjects**: add or update when new semester starts.
2. **Timetable**: publish slots before the week starts.
3. Scan **Daily Register** and **Attendance Report** for compliance.
4. Watch low-attendance notification volume (auto-generated).
5. **Print PDF** reports for HOD when required.

---

## 4. Attendance rules (important)

| Rule | Detail |
|------|--------|
| Unit | One **lecture slot** (subject + period + division) |
| Threshold | **75%** overall — below this student sees a warning |
| Calculation | Server-side from raw Present/Absent rows (not client math) |
| Re-submit | Same student + subject + date + slot → **update**, not duplicate |
| Future dates | Rejected |
| Unmarked | Shown as **U** in register until faculty saves |

---

## 5. Marks rules

| Rule | Detail |
|------|--------|
| Scope | Whole class for one subject + exam type |
| Example | Mid-term out of **30** |
| Validation | 0 ≤ marks ≤ max; empty = not entered |
| Upsert | Same student + subject + exam + year → update |
| Notify | Student receives a notification when faculty saves |

---

## 6. Navigation cheat-sheet

```
Sidebar (left)
├── Main → Dashboard
├── Academics / Manage → Timetable, Marks, Students, Faculty, Subjects
├── Attendance → Take Attendance, Analytics, Daily Register
├── Reports → Report & PDF
└── (topbar) Bell 🔔 → Notifications → Logout
```

**List pages**: search box, filter pills, **pagination** (10 rows/page; lectures 5/page).  
**Print**: on Report pages use browser **Print → Save as PDF**.

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails | Check email/password; demo passwords above |
| Empty marks as student | Faculty may not have uploaded yet — wait for notification |
| Attendance not saving | Ensure a lecture is selected; date must be today or past |
| Port already in use | Backend `:5000`, frontend `:5173` — stop other Node processes |
| Fresh demo data | Backend: `npm run seed` (drops DB, re-imports CSV + attendance + marks) |

---

## 8. Tech stack (quick)

| Layer | Stack |
|-------|--------|
| Frontend | React 19, Vite, React Router, Axios, Recharts, react-hot-toast |
| Backend | Node.js, Express 5, Mongoose, JWT, bcrypt |
| Database | MongoDB (`classtrack_v2`) |
| Theme | LEDGER — IBM Plex, Slate Blue `#1F4E8C` + Teal `#0F7F86` |

---

*Project root: `ClassTrack/` · Frontend `http://localhost:5173` · API `http://localhost:5000`*
