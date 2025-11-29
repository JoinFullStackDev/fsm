# Product Requirements Document (PRD)
## FullStack Method™ Application
**Version:** 1.0  
**Date:** November 28, 2024  
**Status:** Current Production State

---

## Executive Summary

The FullStack Method™ (FSM) Application is an AI-accelerated project management platform that encodes the 6 phases of the FullStack Method™ into a guided, structured system. The platform generates structured JSON, Markdown, text files, ERDs, API contracts, user stories, and blueprint bundles optimized for consumption by AI coding tools like Cursor, Replit, Lovable, and Base44.

### Key Value Propositions
- **Structured Development Workflow**: Enforces a 6-phase methodology ensuring clarity and documentation before code
- **AI-Powered Acceleration**: Intelligent content generation using Google Gemini AI
- **Export to AI Tools**: Generates Blueprint Bundles and Cursor Bundles for seamless AI-assisted development
- **Multi-Tenant Architecture**: Organization-based access control with subscription management
- **Comprehensive Project Management**: Task management, team collaboration, and progress tracking

---

## Product Overview

### Target Users
- **Product Managers**: Lead projects through structured phases
- **Designers**: Define prototypes, screens, and design systems
- **Engineers**: Access technical specifications and build instructions
- **Administrators**: Manage organizations, users, and subscriptions
- **Business Operations**: Manage companies, contacts, and opportunities (Ops Tool)

### Core Use Cases
1. **Project Creation & Management**: Create projects from templates, manage team members, track progress
2. **Phase-Based Development**: Complete 6 structured phases with guided forms
3. **AI-Assisted Content Generation**: Generate personas, user stories, ERDs, and documentation
4. **Export for Development**: Generate Blueprint and Cursor bundles for AI coding tools
5. **Task Management**: Create, assign, and track tasks across project phases
6. **Team Collaboration**: Real-time collaboration with role-based permissions
7. **Operations Management**: Manage companies, contacts, and opportunities (Ops Tool)
8. **Analytics & Reporting**: Track project progress, phase completion, and team productivity

---

## System Architecture

### Technology Stack

#### Frontend
- **Framework**: Next.js 14.2 with App Router
- **UI Library**: Material-UI (MUI) v5 with custom theme
- **Language**: TypeScript 5.4
- **State Management**: React Hooks (useState, useEffect, useMemo, useCallback)
- **Styling**: Emotion (CSS-in-JS) with MUI's sx prop system
- **Rich Text Editing**: React Quill
- **Code Editor**: Monaco Editor (for code snippets)
- **Charts**: Mermaid (for ERD generation)
- **Animations**: Framer Motion

#### Backend
- **API Layer**: Next.js API Routes (`/app/api`)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (email/password + magic links)
- **Storage**: Supabase Storage for file exports
- **Server-Side Rendering**: Next.js SSR/SSG for optimized performance

#### External Services
- **AI Service**: Google Gemini API (via @google/genai)
- **Payment Processing**: Stripe (subscriptions, checkout, webhooks)
- **Email Service**: SendGrid (email notifications)
- **Push Notifications**: Web Push API (browser notifications)

### Database Schema

#### Core Tables
- **users**: User accounts with roles, preferences, and organization association
- **organizations**: Multi-tenant organization management
- **projects**: Project metadata, status, and template associations
- **project_phases**: Phase data stored as JSONB for flexibility
- **project_members**: Team collaboration and role assignments
- **project_tasks**: Task management with assignments, priorities, and dependencies
- **project_templates**: Reusable template definitions
- **template_field_configs**: Dynamic form field configurations
- **exports**: Export history and file tracking
- **notifications**: Real-time user notifications
- **subscriptions**: Stripe subscription management
- **packages**: Subscription package definitions with features
- **api_keys**: API key management for REST API access

#### Ops Tool Tables
- **companies**: Company/account management
- **contacts**: Contact management with interactions
- **opportunities**: Sales opportunity tracking
- **ops_tasks**: Operations-specific task management
- **activity_logs**: Activity feed for companies, contacts, and opportunities

#### Security
- **Row Level Security (RLS)**: Enabled on all tables
- **Role-Based Access Control (RBAC)**: Granular permissions per role
- **Organization Isolation**: All data scoped to organizations
- **API Key Encryption**: Encrypted API keys with rotation support

---

## Core Features

### 1. Authentication & User Management

#### Authentication Methods
- Email/password authentication via Supabase Auth
- Magic link authentication
- Password reset functionality
- Email confirmation flow

#### User Roles
- **Admin**: Full system access, user management, organization settings
- **PM (Product Manager)**: Project creation, phase editing, team management
- **Designer**: Phase editing (especially Phase 3 - Prototype)
- **Engineer**: Phase editing, export access

#### User Features
- User profile management
- Avatar uploads
- Notification preferences (in-app, email, push)
- API key management (for REST API access)
- Personal task dashboard ("My Tasks")

### 2. Organization & Subscription Management

#### Organization Features
- Multi-tenant organization support
- Custom branding (logo, icon, colors)
- Organization settings and configuration
- User management within organization
- Package-based feature access

#### Subscription System
- **Payment-First Flow**: Users pay via Stripe BEFORE account creation
- **Packages**: Predefined subscription packages with feature sets
- **Subscription Status**: `trialing`, `active`, `past_due`, `canceled`, `incomplete`
- **Stripe Integration**: Checkout sessions, subscription management, webhooks
- **Package Features**: Configurable feature flags per package
- **Module Overrides**: Organization-level feature overrides

#### Available Modules/Features
- `ops_tool_enabled`: Companies, Opportunities, and Contacts management
- `ai_features_enabled`: AI-powered template generation and content assistance
- `ai_task_generator_enabled`: AI-powered task generation from prompts
- `export_features_enabled`: Export projects as Blueprint and Cursor bundles
- `analytics_enabled`: Advanced analytics and reporting features
- `api_access_enabled`: REST API access with API keys

### 3. Dashboard

#### Dashboard Features
- Project overview with status indicators
- Quick access to recent projects
- Project creation wizard
- Search and filter capabilities
- Sortable project tables
- Project status visualization
- Phase completion tracking
- Activity feed

### 4. Project Workspace

#### Project Management
- Project metadata management (name, description, status, primary tool)
- Project status: `idea`, `in_progress`, `blueprint_ready`, `archived`
- Primary tool selection: Cursor, Replit, Lovable, Base44, Other
- Project settings and configuration
- Project archiving

#### Team Collaboration
- Add/remove project members
- Role assignment per project (admin, pm, designer, engineer)
- Real-time collaboration on phases
- Activity logging
- Member permissions management

#### Phase Management
- Phase completion tracking
- Phase data stored as JSONB for flexibility
- Phase-specific forms and validation
- Phase dependencies and prerequisites
- Phase progress visualization

### 5. Six Phase Modules

Each phase exists at `/project/[id]/phase/[phaseNumber]`:

#### Phase 1: Concept Framing
- Problem statement
- Target users
- Value hypothesis
- Why now
- Initial features
- Constraints
- Risks
- Assumptions
- Feasibility notes
- High-level timeline

#### Phase 2: Product Strategy
- Personas (with demographics, goals, pain points)
- Jobs-to-be-Done (JTBD)
- Business outcomes and KPIs
- Feature backlog with scoring
- Outcome roadmap
- Tech stack selection

#### Phase 3: Rapid Prototype Definition
- Screens (with descriptions, wireframes, user flows)
- User flows (with steps and decision points)
- Components (with descriptions and props)
- Design tokens (colors, typography, spacing)
- Navigation map

#### Phase 4: Analysis & User Stories
- Entities (with attributes and relationships)
- ERD (Entity Relationship Diagram) - auto-generated
- API specifications (endpoints, methods, request/response)
- User stories (with acceptance criteria)
- RBAC matrix (role-based access control)
- Non-functional requirements

#### Phase 5: Build Accelerator
- Folder structure
- Architecture instructions
- Coding standards
- Environment setup
- Technology decisions
- Build configuration

#### Phase 6: QA & Hardening
- Test plan
- Test cases (with steps and expected results)
- Security checklist
- Performance requirements
- Launch readiness checklist

### 6. Template System

#### Template Features
- Create reusable project templates
- Custom field configurations per phase
- Field grouping and conditional logic
- Template preview and builder
- Public/private template visibility
- Template duplication
- Default template generation
- Template usage tracking

#### Template Builder
- Visual form builder
- Field type configuration (text, textarea, select, multi-select, etc.)
- Field validation rules
- Conditional field display
- Field grouping and sections
- Template preview mode

### 7. Export System

#### Export Types

##### Blueprint Bundle
Complete structured JSON export containing:
- Project metadata
- Concept summary (AI-generated)
- Strategy (personas, outcomes, features)
- Prototype (screens, flows, components)
- Analysis (ERD, APIs, user stories)
- Build (folder structure, architecture)
- QA (test plan, security checklist)

##### Cursor Bundle
Master prompt text file optimized for Cursor AI:
- Comprehensive project documentation
- All phase data formatted for AI consumption
- Instructions for AI coding assistants
- Context-aware prompts

##### Individual Phase Exports
- Export specific phases as JSON
- Export phases as Markdown
- Custom export formats

#### Export Features
- Export history tracking
- File storage in Supabase Storage
- Download links with expiration
- Export metadata (type, size, timestamp)
- Export filtering and search

### 8. AI-Powered Features

#### AI Content Generation
- **Problem Statement Generation**: AI-generated problem statements from user input
- **Persona Generation**: Create detailed user personas
- **JTBD Generation**: Generate Jobs-to-be-Done statements
- **Risk Identification**: AI-suggested risks and constraints
- **Screen Suggestions**: AI-recommended screens and flows
- **User Story Generation**: Automated user story creation
- **ERD Generation**: Auto-generate Entity Relationship Diagrams
- **Document Generation**: Custom AI prompts for document creation

#### AI Task Generator
- Generate tasks from PRD, spec, or prompt
- Intelligent date extraction (specific dates, relative dates, implied dates)
- Duplicate detection (string similarity + semantic similarity)
- Task merge capabilities
- Preview/audit interface before committing
- Phase-based task distribution
- Timeline-aware date assignment

#### AI Project Analysis
- Project analysis and summary generation
- Task list generation with priorities
- Blocker identification
- Time estimates
- Phase-based task organization

#### AI Integration
- **Provider**: Google Gemini API
- **API Key Management**: Organization-level API keys
- **Usage Tracking**: Track AI usage per organization
- **Rate Limiting**: Configurable rate limits
- **Error Handling**: Graceful fallbacks when AI unavailable

### 9. Task Management

#### Task Features
- **Task Creation**: Manual or AI-generated
- **Task Assignment**: Assign to team members
- **Task Status**: `todo`, `in_progress`, `done`, `archived`
- **Task Priority**: `low`, `medium`, `high`, `critical`
- **Task Dependencies**: Link tasks to other tasks
- **Subtasks**: One-level nesting (parent/child tasks)
- **Task Tags**: Categorize tasks with tags
- **Task Comments**: Threaded comments on tasks
- **Task Mentions**: @mention users in comments
- **Due Dates**: Start date and due date tracking
- **Phase Association**: Link tasks to project phases
- **AI Generation**: AI-generated tasks from project analysis

#### Task Views
- **Project Task Table**: All tasks for a project
- **My Tasks**: Personal task dashboard
- **Phase View**: Tasks grouped by phase
- **Kanban Board**: Status-based task board (future)
- **Calendar View**: Timeline view of tasks (future)

#### Task Notifications
- Task assignment notifications
- Comment notifications
- Mention notifications
- Due date reminders
- Status change notifications

### 10. Notifications System

#### Notification Types
- `task_assigned`: Task assigned to user
- `comment_created`: Comment added to task
- `comment_mention`: User mentioned in comment
- `project_created`: New project created
- `project_member_added`: Added to project team
- `phase_completed`: Phase marked as complete
- `project_updated`: Project metadata updated

#### Notification Channels
- **In-App Notifications**: Notification bell with drawer
- **Email Notifications**: SendGrid email delivery
- **Push Notifications**: Browser push notifications (Web Push API)

#### Notification Preferences
- User-configurable preferences
- Per-channel enable/disable
- Notification grouping
- Mark as read/unread
- Notification filtering

### 11. Ops Tool (Operations Management)

#### Companies Management
- Company/account creation and management
- Company status: `active`, `inactive`, `prospect`, `client`, `archived`
- Company details (name, website, industry, size)
- Company tags and categorization
- Company activity feed
- Company contacts management

#### Contacts Management
- Contact creation and management
- Contact status: `active`, `inactive`, `archived`
- Contact details (name, email, phone, title, company)
- Contact interactions (calls, emails, meetings, notes)
- Contact attachments
- Contact tags
- Lead source tracking
- Lifecycle stage tracking

#### Opportunities Management
- Opportunity creation and management
- Opportunity status: `new`, `working`, `negotiation`, `pending`, `converted`, `lost`
- Opportunity source: `Manual`, `Contact`, `Imported`
- Opportunity value and probability
- Opportunity-to-project conversion
- Opportunity pipeline tracking

#### Ops Tasks
- Operations-specific task management
- Task assignment to contacts/companies
- Task due dates and priorities
- Task completion tracking

#### Activity Logs
- Activity feed for companies, contacts, opportunities
- Activity types: `created`, `updated`, `deleted`, `contacted`, `meeting`, `note`
- Activity filtering and search
- Activity timeline view

### 12. Analytics & Reporting

#### Analytics Features
- **Organization Analytics**: Organization-scoped analytics dashboard
- **Project Analytics**: Project progress and phase completion
- **User Analytics**: User activity and productivity
- **Export Analytics**: Export usage and types
- **AI Usage Analytics**: AI request tracking and costs
- **Task Analytics**: Task completion rates and trends

#### Report Generation
- **Weekly Reports**: Weekly project progress reports
- **Monthly Reports**: Monthly summary reports
- **Forecast Reports**: Projected completion dates
- **Report Formats**: PDF and slideshow formats
- **AI-Generated Content**: AI-enhanced report content
- **Custom Date Ranges**: Flexible reporting periods

#### Analytics Dashboard
- Charts and visualizations
- Key metrics and KPIs
- Trend analysis
- Export capabilities
- Real-time data updates

### 13. Global Admin Features

#### Super Admin Access
- Cross-organization access
- System-wide user management
- Organization management
- Package management
- System configuration

#### Organization Management
- View all organizations
- Organization details (users, projects, subscriptions)
- Subscription management
- Package assignment
- Feature overrides
- AI usage tracking per organization
- Payment history

#### User Management
- View all users across organizations
- User search and filtering
- User details and activity
- User role management
- User deletion and archival

#### System Connections
- Stripe connection testing
- Email service connection testing
- AI service connection testing
- Storage connection testing
- Connection status monitoring

#### Package Management
- Create and edit packages
- Package feature configuration
- Stripe product/price sync
- Package pricing management

### 14. API Access

#### REST API
- RESTful API endpoints
- API key authentication
- Organization-scoped access
- Read and write permissions
- API key rotation
- API key audit logs

#### API Endpoints
- `/api/v1/projects`: Project CRUD operations
- `/api/v1/companies`: Companies management (Ops Tool)
- `/api/v1/contacts`: Contacts management (Ops Tool)
- `/api/v1/opportunities`: Opportunities management (Ops Tool)

#### API Key Management
- Create API keys with scopes
- Revoke and rotate API keys
- API key usage tracking
- API key permissions (read/write)
- API key expiration

### 15. Email Notifications

#### Email Features
- SendGrid integration
- Email template system
- Task assignment emails
- Project update emails
- Notification emails
- Email delivery tracking
- Email service configuration

### 16. Push Notifications

#### Push Notification Features
- Web Push API integration
- Browser notification support
- Service worker implementation
- Notification subscription management
- Notification delivery tracking
- Notification preferences

---

## User Roles & Permissions

### Role Definitions

#### Admin
- Full system access
- User management
- Organization settings
- Project creation and management
- All phase editing
- Export access
- Team member management

#### PM (Product Manager)
- Project creation and management
- All phase editing
- Export access
- Team member management
- Task management

#### Designer
- Phase editing (especially Phase 3)
- Export access (Blueprint only)
- View projects

#### Engineer
- Phase editing
- Export access (Blueprint and Cursor)
- View projects
- Task management

### Permission Matrix

| Permission | Admin | PM | Designer | Engineer |
|------------|-------|----|----------|----------|
| View All Projects | ✅ | ✅ | ✅ | ✅ |
| Create Projects | ✅ | ✅ | ❌ | ❌ |
| Edit Project | ✅ | ✅ | ❌ | ❌ |
| Delete Project | ✅ | ✅ | ❌ | ❌ |
| Edit Phases | ✅ | ✅ | ✅ | ✅ |
| Export Blueprint | ✅ | ✅ | ✅ | ✅ |
| Export Cursor | ✅ | ✅ | ❌ | ✅ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Manage Project Members | ✅ | ✅ | ❌ | ❌ |

### Project Member Permissions
Project members (owners or added members) get full access to all phases regardless of their organization role.

---

## Data Models

### Core Entities

#### User
- `id`: UUID
- `auth_id`: UUID (Supabase Auth)
- `email`: string
- `name`: string
- `role`: `admin` | `pm` | `designer` | `engineer`
- `organization_id`: UUID (nullable)
- `avatar_url`: string (nullable)
- `preferences`: JSONB
- `is_super_admin`: boolean
- `created_at`: timestamp
- `updated_at`: timestamp

#### Organization
- `id`: UUID
- `name`: string
- `slug`: string (unique)
- `stripe_customer_id`: string (nullable)
- `subscription_status`: `trialing` | `active` | `past_due` | `canceled` | `incomplete`
- `module_overrides`: JSONB (feature overrides)
- `logo_url`: string (nullable)
- `icon_url`: string (nullable)
- `created_at`: timestamp
- `updated_at`: timestamp

#### Project
- `id`: UUID
- `organization_id`: UUID
- `owner_id`: UUID
- `name`: string
- `description`: string (nullable)
- `status`: `idea` | `in_progress` | `blueprint_ready` | `archived`
- `primary_tool`: `cursor` | `replit` | `lovable` | `base44` | `other` | null
- `template_id`: UUID (nullable)
- `created_at`: timestamp
- `updated_at`: timestamp

#### Project Phase
- `id`: UUID
- `project_id`: UUID
- `phase_number`: integer (1-6)
- `data`: JSONB (phase-specific data)
- `completed`: boolean
- `updated_at`: timestamp

#### Project Task
- `id`: UUID
- `project_id`: UUID
- `phase_number`: integer (nullable)
- `title`: string
- `description`: string (nullable)
- `status`: `todo` | `in_progress` | `done` | `archived`
- `priority`: `low` | `medium` | `high` | `critical`
- `assignee_id`: UUID (nullable)
- `start_date`: date (nullable)
- `due_date`: date (nullable)
- `tags`: string[]
- `notes`: string (nullable)
- `dependencies`: string[] (task IDs)
- `parent_task_id`: UUID (nullable)
- `ai_generated`: boolean
- `ai_analysis_id`: UUID (nullable)
- `created_at`: timestamp
- `updated_at`: timestamp

---

## Integration Points

### Stripe Integration
- **Checkout Sessions**: Create checkout for signup and subscription changes
- **Subscription Management**: Create, update, cancel subscriptions
- **Webhooks**: Handle subscription events (created, updated, canceled)
- **Customer Portal**: Stripe customer portal for self-service
- **Product Sync**: Sync Stripe products and prices to packages

### Supabase Integration
- **Authentication**: User authentication and session management
- **Database**: PostgreSQL with RLS
- **Storage**: File storage for exports
- **Real-time**: Real-time subscriptions (future)

### Google Gemini Integration
- **AI Content Generation**: All AI-powered features
- **API Key Management**: Organization-level API keys
- **Usage Tracking**: Track AI usage and costs
- **Rate Limiting**: Configurable rate limits

### SendGrid Integration
- **Email Delivery**: Transactional emails
- **Email Templates**: Custom email templates
- **Delivery Tracking**: Email delivery status

### Web Push API
- **Push Notifications**: Browser push notifications
- **Service Worker**: Background notification handling
- **Subscription Management**: User subscription preferences

---

## Security & Compliance

### Security Features
- **Row Level Security (RLS)**: Database-level access control
- **Role-Based Access Control (RBAC)**: Application-level permissions
- **Organization Isolation**: All data scoped to organizations
- **API Key Encryption**: Encrypted API keys with rotation
- **Password Security**: Secure password hashing via Supabase
- **Session Management**: Secure session handling
- **CSRF Protection**: Built-in Next.js CSRF protection
- **XSS Protection**: Input sanitization and output encoding

### Data Privacy
- **Data Isolation**: Organization-level data isolation
- **User Privacy**: User preferences for notifications
- **Data Retention**: Configurable data retention policies
- **Export Security**: Secure export file generation and storage

---

## Performance & Scalability

### Performance Optimizations
- **Server-Side Rendering (SSR)**: Next.js SSR for initial load
- **Static Generation**: Static pages where possible
- **Code Splitting**: Automatic code splitting
- **Image Optimization**: Next.js image optimization
- **Caching**: API response caching
- **Database Indexing**: Optimized database queries
- **React Optimizations**: React.memo, useMemo, useCallback

### Scalability
- **Multi-Tenant Architecture**: Organization-based scaling
- **Database Scaling**: Supabase PostgreSQL scaling
- **CDN**: Static asset delivery via CDN
- **API Rate Limiting**: Prevent abuse
- **Background Jobs**: Async processing for heavy operations

---

## Testing

### Test Coverage
- **Unit Tests**: 180 tests passing (20 test suites)
- **Component Tests**: React Testing Library
- **API Tests**: API route testing
- **E2E Tests**: Playwright end-to-end tests
- **Test Coverage**: 70% minimum threshold

### Test Suites
- Authentication tests
- Admin functionality tests
- Project management tests
- Export functionality tests
- Notification tests
- Phase completion tests
- Project creation tests

---

## Deployment

### Build Status
- ✅ **Build**: Compiling successfully
- ✅ **Tests**: 180 tests passing
- ✅ **TypeScript**: No type errors
- ⚠️ **Linting**: Minor warnings (non-blocking)

### CI/CD
- **GitHub Actions**: Automated testing on push
- **Automated Deployment**: Vercel deployment on merge to main
- **Environment Variables**: Secure environment variable management

### Environment Requirements
- Node.js 18+
- npm 9+
- Supabase access
- Stripe account
- SendGrid account (optional)
- Google Gemini API key (optional)

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **Email Confirmation**: Users must confirm email before full access (by design)
2. **Race Conditions**: Webhooks and callbacks can fire simultaneously (handled with idempotency)
3. **Package Sync**: Stripe products must be synced manually via admin panel
4. **Module Overrides**: Only boolean features can be overridden (not numeric limits)
5. **Task Nesting**: Only one level of task nesting (parent/child, no grandchildren)

### Future Enhancements
1. **Real-Time Collaboration**: WebSocket-based real-time updates
2. **Advanced Analytics**: More detailed analytics and insights
3. **Kanban Boards**: Visual task board interface
4. **Calendar View**: Timeline and calendar views for tasks
5. **GitHub Integration**: Direct GitHub repository integration
6. **Advanced Reporting**: More report types and customization
7. **Mobile App**: Native mobile applications
8. **Advanced AI Features**: More AI-powered automation
9. **Workflow Automation**: Custom workflow automation
10. **Advanced Permissions**: More granular permission system

---

## Support & Documentation

### Documentation
- **README.md**: Main project documentation
- **CONTEXT.md**: Development context and recent changes
- **AI_PROMPTS_REFERENCE.md**: AI prompt documentation
- **Migration Files**: Database migration scripts

### Support Levels
- **Community**: Community support (forums, documentation)
- **Email**: Email support
- **Priority**: Priority email support
- **Dedicated**: Dedicated support channel

---

## Appendix

### API Endpoints Summary

#### Authentication
- `POST /api/auth/create-organization`
- `POST /api/auth/create-user-with-org`
- `POST /api/auth/create-user-record`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

#### Projects
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/[id]`
- `PUT /api/projects/[id]`
- `DELETE /api/projects/[id]`
- `GET /api/projects/[id]/phases`
- `POST /api/projects/[id]/phases/[phaseNumber]`
- `GET /api/projects/[id]/tasks`
- `POST /api/projects/[id]/tasks`
- `GET /api/projects/[id]/export/blueprint`
- `GET /api/projects/[id]/export/cursor`

#### Admin
- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/templates`
- `POST /api/admin/templates`

#### Global Admin
- `GET /api/global/admin/organizations`
- `GET /api/global/admin/users`
- `GET /api/global/admin/ai-usage/[organizationId]`

#### Ops Tool
- `GET /api/ops/companies`
- `POST /api/ops/companies`
- `GET /api/ops/contacts`
- `POST /api/ops/contacts`
- `GET /api/ops/opportunities`
- `POST /api/ops/opportunities`

#### Notifications
- `GET /api/notifications`
- `POST /api/notifications`
- `PUT /api/notifications/[id]`

#### Stripe
- `POST /api/stripe/create-checkout`
- `POST /api/stripe/create-signup-checkout`
- `POST /api/stripe/webhook`

### Database Tables Summary
- `users`
- `organizations`
- `projects`
- `project_phases`
- `project_members`
- `project_tasks`
- `project_templates`
- `template_field_configs`
- `exports`
- `notifications`
- `subscriptions`
- `packages`
- `api_keys`
- `companies`
- `contacts`
- `opportunities`
- `ops_tasks`
- `activity_logs`

---

**Document Version**: 1.0  
**Last Updated**: November 28, 2024  
**Maintained By**: FullStack Method™ Development Team