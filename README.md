# PanicMode - Smart Study Planner

PanicMode is an automated study planner designed for students balancing academic deadlines against fixed personal routines (classes, work, personal commitments). It bridges flexible task management with fixed calendar scheduling.

---

## Core Features & Architecture

| Feature | Description | Technical Implementation |
| :--- | :--- | :--- |
| **Routine Management** | Captures non-negotiable daily activities (sleep, classes, work) including overnight spans | Saved to `routines` table (`activities` JSONB column) |
| **Task Management** | Accepts both flexible auto-scheduled tasks and fixed pinned reminders | Saved to `tasks` table with deadline & priority tracking |
| **Conflict-Free Scheduling** | Auto-places flexible tasks exclusively inside free windows outside routine blocks | Custom 24-hour minute-mask algorithm in `ScheduleGenerator` |
| **Smart Rescheduling** | Shift missed or unavailable tasks dynamically to subsequent free days | State-synced to `schedules` table (`schedule_data` JSONB) |
| **Authentication & Sync** | User registration, session persistence, and secure data access | Supabase Auth with Row Level Security (RLS) |

---

## Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | React 18, TypeScript, Vite |
| **UI & Styling** | Tailwind CSS, shadcn/ui, Lucide Icons |
| **Backend & Auth** | Supabase (PostgreSQL, Supabase Auth, Row Level Security) |
| **State & Router** | React Router DOM v6 |

---

## Database Schema Overview

| Table | Key Columns | Purpose |
| :--- | :--- | :--- |
| `routines` | `user_id`, `activities` (jsonb), `updated_at` | Stores non-overlapping fixed daily routine blocks |
| `tasks` | `user_id`, `title`, `task_type`, `deadline`, `priority`, `time_mode`, `hours_required`, `pinned_datetime` | Stores both auto-scheduled and pinned user tasks |
| `schedules` | `user_id`, `schedule_data` (jsonb), `updated_at` | Persists generated and rescheduled weekly timelines |

---

## Environment Configuration

Configure your Supabase environment variables in your project host or `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
