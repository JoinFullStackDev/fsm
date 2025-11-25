# FullStack Method™ App

A production-grade web application that encodes the 6 phases of the FullStack Method into a guided, structured system. This app generates structured JSON, Markdown, text files, ERDs, API contracts, user stories, and blueprint bundles that can be consumed by AI coding tools like Cursor, Lovable, Replit, Base44, etc.

## Tech Stack

- **Next.js** (App Router)
- **React** + **TypeScript**
- **Material UI (MUI)** - Component library
- **Supabase** - Auth, Database (PostgreSQL), Server-side operations
- **Node.js** 18+ runtime

## Prerequisites

- Node.js 18 or higher
- A Supabase project with the database schema set up

## Setup Instructions

1. **Clone the repository**
   ```bash
   cd FSM
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create a `.env.local` file in the root directory:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Set up the database schema**
   Run the following SQL in your Supabase SQL editor:

   ```sql
   -- Users table
   create table users (
     id uuid primary key default uuid_generate_v4(),
     auth_id uuid not null,
     email text not null unique,
     name text,
     role text check (role in ('admin', 'pm', 'designer', 'engineer')) default 'pm',
     created_at timestamptz default now()
   );

   -- Projects table
   create table projects (
     id uuid primary key default uuid_generate_v4(),
     owner_id uuid references users(id),
     name text not null,
     description text,
     status text check (status in ('idea', 'in_progress', 'blueprint_ready', 'archived')) default 'idea',
     primary_tool text,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   -- Project members table
   create table project_members (
     id uuid primary key default uuid_generate_v4(),
     project_id uuid references projects(id) on delete cascade,
     user_id uuid references users(id) on delete cascade,
     role text check (role in ('admin', 'pm', 'designer', 'engineer')) default 'pm',
     created_at timestamptz default now()
   );

   -- Project phases table
   create table project_phases (
     id uuid primary key default uuid_generate_v4(),
     project_id uuid references projects(id) on delete cascade,
     phase_number int check (phase_number between 1 and 6),
     data jsonb default '{}'::jsonb,
     completed boolean default false,
     updated_at timestamptz default now(),
     unique (project_id, phase_number)
   );

   -- Exports table
   create table exports (
     id uuid primary key default uuid_generate_v4(),
     project_id uuid references projects(id) on delete cascade,
     export_type text,
     storage_path text,
     created_at timestamptz default now()
   );
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/app
  /auth              # Authentication pages
  /dashboard         # Dashboard page
  /project           # Project pages
    /[id]            # Project detail page
      /phase         # Phase pages
        /[phaseNumber]
      /settings      # Project settings
  /api               # API routes
    /projects        # Project CRUD
      /[id]
        /phases
        /export
/components
  /phases            # Phase form components
  /layout            # Layout components
/lib
  /ai                # AI integration (Gemini client, project analyzer)
  /exportHandlers    # Export logic
  /hooks             # Custom React hooks (useRole, useDebounce, useFocusManagement, etc.)
  /rbac              # Role-based access control
  /templates         # Template system (validation, conditional logic, field registry)
  /utils              # Utility functions (logger, apiErrors, validation, session)
  /constants          # Application constants (roles, statuses, priorities, etc.)
  supabaseClient.ts  # Supabase client
  supabaseServer.ts  # Server-side Supabase client
  supabaseAdmin.ts   # Admin Supabase client
/types               # TypeScript types
/components
  /ui                # Reusable UI components (ErrorBoundary, LoadingSkeleton, etc.)
  /templates         # Template builder components
  /phases            # Phase form components
  /notifications     # Notification components
/styles              # Global styles and theme
```

## Features

### Authentication
- User sign-in / sign-up with Supabase Auth
- Basic profile (name, role)
- Session handling across pages
- Protected routes

### Dashboard
- List of all projects the user has access to
- "Create Project" button
- Displays: name, status, description, last updated

### Project Workspace
- Project metadata
- Phases 1–6 with completion status
- Export Blueprint Bundle
- Export Cursor Bundle
- Edit Project Settings

### Six Phase Modules
Each phase exists at `/project/[id]/phase/[phaseNumber]`:

1. **Concept Framing** - Problem statement, target users, value hypothesis, constraints, risks
2. **Product Strategy** - Personas, JTBD, business outcomes, KPIs, features, tech stack
3. **Rapid Prototype Definition** - Screens, flows, components, design tokens, navigation
4. **Analysis & User Stories** - Entities, ERD, API specs, user stories, acceptance criteria, RBAC
5. **Build Accelerator** - Folder structure, architecture instructions, coding standards, env setup
6. **QA & Hardening** - Test plan, test cases, security checklist, performance requirements

### Export System
- **Blueprint Bundle**: Complete structured JSON export of all phases
- **Cursor Bundle**: Master prompt text file optimized for Cursor AI

### Code Quality & Infrastructure
- **Centralized Logging**: Environment-aware logging utility (`lib/utils/logger.ts`)
- **Standardized API Errors**: Consistent error response format (`lib/utils/apiErrors.ts`)
- **Form Validation**: Reusable validation utilities (`lib/utils/validation.ts`)
- **Constants Management**: Centralized constants for roles, statuses, priorities (`lib/constants`)
- **Error Boundaries**: React error boundaries for graceful error handling
- **Focus Management**: Accessibility utilities for modal dialogs and forms
- **Performance Optimizations**: React.memo, useMemo, useCallback, debouncing
- **Keyboard Navigation**: Full keyboard support for improved accessibility

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## License

Copyright © JoinFullStack, LLC. All rights reserved.

