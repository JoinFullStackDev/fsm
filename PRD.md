THE FULLSTACK METHOD™ APP

Product Requirements Document (PRD)
Version: 1.1
Owner: FullStack (JoinFullStack, LLC)
Primary Tools: Cursor + Supabase
Goal: Build ASAP (no phased “90-day” plan needed)

⸻

1. Product Overview

1.1 Purpose

The FullStack Method™ App is an internal + external platform that encodes the FullStack Method (0 → 1 and 2 → 100) into a guided, structured system.

It:
	•	Collects structured information for all 6 phases of the FullStack Method
	•	Transforms that info into architecture-first, engineering-ready deliverables
	•	Exports clean “Blueprint Bundles” optimized for AI coding tools like Cursor, Replit, Lovable, Base44, etc.

The app does not generate code.
It generates clarity, documents, schemas, and instructions that other tools use to write code.

⸻

2. Tech Stack
	•	Frontend:
	•	Next.js (App Router)
	•	React
	•	Material UI (MUI) for components & layout
	•	TypeScript
	•	Backend:
	•	Next.js API routes (app/api)
	•	Supabase client for all DB & Auth
	•	Database / Infra:
	•	Supabase PostgreSQL
	•	Supabase Auth (email/password + magic link)
	•	Supabase Storage for exported files (optional)
	•	Export Formats:
	•	Markdown (.md)
	•	JSON (.json)
	•	Plaintext (.txt)
	•	Optional: PDF via server-side render (nice-to-have, not mandatory MVP)

⸻

3. Users & Roles

3.1 Roles
	1.	Admin
	•	Manage users, roles, and global templates
	•	View all projects
	2.	Product Manager (PM)
	•	Create projects
	•	Drive phases 1–4 (concept → analysis)
	•	Trigger exports
	3.	Designer
	•	Contribute to Phase 3 (Prototype definition, components, UI notes)
	•	Edit design system + component definitions
	4.	Architect / Engineer
	•	Contribute to Phase 4–6 (ERDs, APIs, build structure, QA expectations)
	•	Trigger engineering-focused exports (Cursor Bundle, ERD, APIs, etc.)

MVP simplification: You can technically start with one “Member” role with full project access and add role-based UI gating later. But the data model should support roles.

⸻

4. Core Concept: Phased Blueprint Engine

The app mirrors the 6 phases of The FullStack Method™:
	1.	Concept Framing
	2.	Product Strategy
	3.	Rapid Prototype (Definition, not figma-level UI)
3.5 (implicitly) Prototyping instructions for AI tools
	4.	Analysis & User Stories
	5.	Build Accelerator
	6.	QA & Hardening

Each phase:
	•	Has a dedicated screen
	•	Uses structured forms/sections
	•	Writes to a JSON “phase_data” field in Supabase
	•	Can generate partial exports and contributes to the full Blueprint Bundle

⸻

5. High-Level Feature Set (MVP)

5.1 Authentication & Workspace
	•	Email/password + Supabase Auth
	•	Basic onboarding (name, role selection)
	•	Dashboard: List of projects with status and links

5.2 Project Management
	•	Create / edit project
	•	Project fields (MVP):
	•	name
	•	description
	•	status (idea, in-progress, blueprint-ready, archived)
	•	primary_tool (enum: cursor, replit, lovable, base44, other)
	•	created_at / updated_at

⸻

5.3 Phase Modules

Each phase = one page under /project/[id]/phase/[phaseNumber].

Phase 1 — Concept Framing Engine
Goal: Capture why this product deserves to exist and establish feasibility.

Key sections:
	•	Problem Statement
	•	Target Users / Segments
	•	Why now / market timing
	•	Business value hypotheses
	•	Constraints (budget, time, tech, legal)
	•	Risks, Assumptions, Constraints (RAC)
	•	Very high-level feature list (bullet points)
	•	Very rough technical feasibility notes
	•	Very rough timeline expectations

Outputs (generated/compiled):
	•	concept_summary.md
	•	rac_summary.md
	•	high_level_feasibility.md
	•	Combined into PRD later

⸻

Phase 2 — Product Strategy Engine
Goal: Translate concept into outcome-based roadmap.

Key sections:
	•	Personas (name, description, goals, pains)
	•	Jobs To Be Done (JTBD statements)
	•	Business outcomes & KPIs
	•	Feature idea capture (title, description, target persona, target outcome)
	•	Impact/Effort/Confidence scoring
	•	MVP vs V2 vs V3 grouping
	•	Tech stack preferences/constraints (ex: “React + Supabase”, “must be HIPAA-friendly”)

Outputs:
	•	personas.json
	•	outcomes_and_kpis.md
	•	feature_backlog.json (with impact/effort scoring)
	•	outcome_roadmap.md

⸻

Phase 3 — Rapid Prototype Definition Engine
Goal: Define screens, flows, components, and interactions in a way that AI tools can immediately implement.

Key sections:
	•	Screen inventory
	•	screen_key, title, description, role(s), “is_core” flag
	•	User flows
	•	flow name, start screen, end screen, steps, notes
	•	Component inventory
	•	name, description, props, state behavior, used-on (which screens)
	•	Navigation model
	•	primary nav, secondary nav, route map
	•	Design system choice
	•	For now: “FullStackDS + Material UI” as default
	•	Color tokens / typography scale / spacing notes
	•	States & edge cases
	•	Loading, empty, error, success patterns

Outputs:
	•	screens.json
	•	flows.json
	•	components.json
	•	design_tokens.json (MVP can be simple, but structured)
	•	navigation_map.md

⸻

Phase 4 — Analysis & User Stories Engine
Goal: Turn Phase 1–3 into a full engineering blueprint.

Key sections:
	•	Entities & Data Models
	•	Name, description, key fields, relationships
	•	ERD structure (text/JSON)
	•	API specifications
	•	Endpoints, method, path, description, request params, body schema, response schema, error codes
	•	User Story mapping
	•	user_role, “As a… I want… so that…”
	•	Acceptance criteria per story
	•	Given / When / Then style
	•	RBAC matrix
	•	roles x actions matrix (view/create/edit/delete per entity)
	•	Non-functional requirements
	•	security, performance, compliance, logging, auditability

Outputs:
	•	erd.json (plus optional schema.sql)
	•	apis.json (OpenAPI-ish structure)
	•	user_stories.json
	•	acceptance_criteria.json
	•	rbac_matrix.json
	•	non_functional_requirements.md

⸻

Phase 5 — Build Accelerator
Goal: Provide clear instructions to AI coding tools on how to scaffold and structure the repo.

Key sections:
	•	Preferred architecture pattern (e.g., Next.js App Router, file-based routing)
	•	Folder structure definition (frontend/backend/shared)
	•	Tech choices (React, MUI, Supabase, etc.) as explicit instructions
	•	Coding standards & patterns
	•	TypeScript, hooks, separation of concerns
	•	Environments & config notes
	•	env vars required, basic secrets (described, not actual secrets)

Outputs:
	•	folder_structure.txt
	•	architecture_instructions.md
	•	coding_standards.md
	•	env_setup.md

⸻

Phase 6 — QA & Hardening Engine
Goal: Define QA strategy & expectations upfront so generated code can align.

Key sections:
	•	Test strategy (unit, integration, e2e)
	•	Core test cases (at least for key flows)
	•	Regression expectations
	•	Security & hardening checklist
	•	Performance expectations (e.g., response times)
	•	Launch readiness checklist

Outputs:
	•	test_plan.md
	•	test_cases.json
	•	security_checklist.md
	•	performance_requirements.md
	•	launch_readiness_checklist.md

⸻

6. Export: Blueprint Bundle & Cursor Bundle

6.1 Blueprint Bundle (General)

For each project, the app can generate a Blueprint Bundle (Zip or logical collection), with this structure:

/project-blueprint/
  README.md
  concept/
    concept_summary.md
    rac_summary.md
    high_level_feasibility.md
  strategy/
    personas.json
    outcomes_and_kpis.md
    feature_backlog.json
    outcome_roadmap.md
  prototype/
    screens.json
    flows.json
    components.json
    design_tokens.json
    navigation_map.md
  analysis/
    erd.json
    schema.sql        (optional, derived)
    apis.json
    user_stories.json
    acceptance_criteria.json
    rbac_matrix.json
    non_functional_requirements.md
  build/
    folder_structure.txt
    architecture_instructions.md
    coding_standards.md
    env_setup.md
  qa/
    test_plan.md
    test_cases.json
    security_checklist.md
    performance_requirements.md
    launch_readiness_checklist.md

6.2 Cursor-Specific Master Prompt

The app also generates a Cursor Master Prompt:

cursor_master_prompt.txt

This file includes:
	•	Short project summary
	•	Clear instructions:
	•	“Use Next.js + TypeScript + Material UI + Supabase”
	•	“Use this folder structure: … (paste folder_structure.txt content)”
	•	“Use these entities and APIs from erd.json and apis.json”
	•	“Implement components as described in components.json and screens.json”
	•	“Honor acceptance criteria in acceptance_criteria.json”
	•	“Follow coding standards described in coding_standards.md”

⸻

7. Data Model (Supabase Schema)

You can refine names as you like, but here’s a solid baseline.

7.1 users

create table users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid not null, -- supabase auth user id
  email text not null unique,
  name text,
  role text check (role in ('admin', 'pm', 'designer', 'engineer')) default 'pm',
  created_at timestamptz default now()
);

7.2 projects

create table projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references users(id),
  name text not null,
  description text,
  status text check (status in ('idea', 'in_progress', 'blueprint_ready', 'archived')) default 'idea',
  primary_tool text, -- 'cursor', 'replit', etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

7.3 project_members

create table project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text check (role in ('admin', 'pm', 'designer', 'engineer')) default 'pm',
  created_at timestamptz default now()
);

7.4 project_phases

One row per (project, phase_number) storing JSON for each phase.

create table project_phases (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  phase_number int check (phase_number between 1 and 6),
  data jsonb default '{}'::jsonb,
  completed boolean default false,
  updated_at timestamptz default now(),
  unique (project_id, phase_number)
);

data will hold structured objects per phase, e.g. screens, flows, entities, etc.

7.5 exports

create table exports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  export_type text, -- 'blueprint_bundle', 'cursor_prompt', 'prd', etc.
  storage_path text, -- Supabase storage path, or null if generated on the fly
  created_at timestamptz default now()
);

You can also generate exports on the fly and not persist them as files initially.

⸻

8. API Requirements (Next.js App Router)

You don’t have to build a super heavy API layer; a few key routes are enough:
	•	GET /api/projects → list projects for current user
	•	POST /api/projects → create project
	•	GET /api/projects/[id] → project details + summary of phases
	•	PUT /api/projects/[id] → update metadata
	•	GET /api/projects/[id]/phases/[phaseNumber] → get phase data
	•	PUT /api/projects/[id]/phases/[phaseNumber] → update phase JSON + completion flag
	•	POST /api/projects/[id]/exports/blueprint → generate bundle (return JSON or zip)
	•	POST /api/projects/[id]/exports/cursor → generate Cursor master prompt text

⸻

9. Basic User Stories (MVP)

Just the essentials to guide Cursor and keep scope clear.

Project & Phases
	•	As a user, I can create a project so I can start applying The FullStack Method.
	•	As a user, I can see all my projects on a dashboard.
	•	As a user, I can open a project and see all 6 phases with a status for each.
	•	As a user, I can fill out structured forms for each phase and save progress.
	•	As a user, I can mark a phase as “complete” when I’m satisfied.

Blueprint & Cursor Export
	•	As a user, I can export a full Blueprint Bundle of all my project data as structured files.
	•	As a user, I can generate a Cursor Master Prompt that tells Cursor exactly how to scaffold my app.
	•	As a user, I can copy the Cursor Master Prompt with one click.

⸻

10. Acceptance Criteria (Key Checks)
	•	I can sign in, create a project, and see it on the dashboard.
	•	I can open a project and navigate to each phase.
	•	Each phase form saves structured data to Supabase and reloads correctly.
	•	I can trigger “Export Blueprint” and receive a structured JSON object representing the bundle (even if you don’t zip or store it yet).
	•	I can trigger “Generate Cursor Prompt” and see a consolidated plaintext prompt that includes:
	•	project summary
	•	tech stack instructions (Next.js, React, Material UI, Supabase)
	•	ERD & API references
	•	folder structure
	•	component and screen instructions
	•	acceptance criteria directive