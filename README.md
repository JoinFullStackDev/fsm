# FullStack Method™ App

[![Tests](https://github.com/JoinFullStackDev/fsm/actions/workflows/test.yml/badge.svg)](https://github.com/JoinFullStackDev/fsm/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com)

**✅ Build Status: Passing** | **✅ Unit Tests: 180 passing (20 test suites)**

Internal project management platform that encodes the 6 phases of the FullStack Method™ into a guided, structured system. Generates structured JSON, Markdown, text files, ERDs, API contracts, user stories, and blueprint bundles for consumption by AI coding tools.

## 🎯 Overview

Internal AI-accelerated project management platform for structured product development. Provides a guided workflow through six distinct phases to ensure clarity, documentation, and engineering-ready deliverables before code is written.

### Key Capabilities

- **Structured Information Collection**: Guided forms for all 6 phases of the FullStack Method
- **AI-Powered Acceleration**: Intelligent suggestions and content generation using Google Gemini
- **Template System**: Reusable project templates with customizable field configurations
- **Export System**: Generate Blueprint Bundles, Cursor Bundles, and various document formats
- **Role-Based Access Control**: Admin, PM, Designer, and Engineer roles with granular permissions
- **Real-Time Collaboration**: Team members can collaborate on projects with role-based editing
- **Analytics & Reporting**: Track project progress, phase completion, and team productivity

## 🏗️ Software Architecture

### Frontend Architecture

- **Framework**: Next.js 14.2 with App Router
- **UI Library**: Material-UI (MUI) v5 with custom theme
- **Language**: TypeScript 5.4
- **State Management**: React Hooks (useState, useEffect, useMemo, useCallback)
- **Routing**: Next.js App Router with dynamic routes
- **Styling**: Emotion (CSS-in-JS) with MUI's sx prop system

### Backend Architecture

- **API Layer**: Next.js API Routes (`/app/api`)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (email/password + magic links)
- **Storage**: Supabase Storage for file exports
- **Server-Side Rendering**: Next.js SSR/SSG for optimized performance

### Database Schema

- **Users**: Authentication, roles, and profile data
- **Projects**: Project metadata, status, and template associations
- **Project Phases**: Phase data stored as JSONB for flexibility
- **Project Members**: Team collaboration and role assignments
- **Project Templates**: Reusable template definitions
- **Template Field Configs**: Dynamic form field configurations
- **Exports**: Export history and file tracking
- **Notifications**: Real-time user notifications
- **Waitlist**: Early access signups

### Key Design Patterns

- **Component Composition**: Reusable UI components with clear separation of concerns
- **Custom Hooks**: Encapsulated logic (useRole, useDebounce, useKeyboardShortcuts)
- **Error Boundaries**: Graceful error handling at component boundaries
- **Centralized Utilities**: Logger, API errors, validation, and constants
- **Template System**: Dynamic form generation based on database configurations
- **RBAC**: Role-based access control with permission checking

## 🚀 Build & Deployment

### Current Status

| Status | Details |
|--------|--------|
| ✅ **Build** | Compiling successfully |
| ✅ **Tests** | 180 tests passing (20 test suites) |
| ✅ **TypeScript** | No type errors |
| ⚠️ **Linting** | Minor warnings (non-blocking) |

### Build Status

The project uses GitHub Actions for continuous integration:

- **Unit Tests**: Jest + React Testing Library (✅ 180 tests passing)
- **E2E Tests**: Playwright
- **Code Coverage**: Codecov integration
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript compiler (✅ No errors)

### Build Commands

```bash
# Development
npm run dev          # Start development server (localhost:3000)

# Production Build
npm run build        # Create optimized production build
npm start            # Start production server

# Testing
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run test:e2e     # Run end-to-end tests

# Code Quality
npm run lint         # Run ESLint
```

### Environment Variables

Required environment variables (see team documentation for actual values):

```env
NEXT_PUBLIC_SUPABASE_URL=<internal_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<internal_supabase_key>
GOOGLE_GENAI_API_KEY=<internal_genai_key>  # Optional, for AI features
API_KEY_ENCRYPTION_KEY=<64-character-hex-string>  # Required for API Key Management
```

**Generating API Key Encryption Key:**
```bash
node scripts/generate-api-key-encryption-key.js
```
This generates a secure 64-character hex string for encrypting API keys. Keep this key secure and never commit it to version control.

### Deployment

Deployment is handled internally via Vercel:
- Automatic deployment on push to `main` branch
- Environment variables configured in Vercel dashboard
- Contact DevOps team for deployment access

## 📋 Development Requirements

- **Node.js**: 18 or higher
- **npm**: 9 or higher
- **Internal Supabase Access**: Database and authentication credentials
- **Google Cloud Access**: (Optional) For AI features - contact team lead

## 🛠️ Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/JoinFullStackDev/fsm.git
   cd fsm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env.local` (if exists) or create `.env.local`
   - Add required environment variables (see team documentation for values):
     ```
     NEXT_PUBLIC_SUPABASE_URL=<internal_supabase_url>
     NEXT_PUBLIC_SUPABASE_ANON_KEY=<internal_supabase_key>
     GOOGLE_GENAI_API_KEY=<internal_genai_key>  # Optional, for AI features
     ```

4. **Database setup**
   - Database migrations are managed internally
   - Contact the team lead for database access and migration instructions
   - Migration files are located in `migrations/` directory

5. **Start development server**
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
/app
  /auth              # Authentication pages (signin, signup)
  /dashboard         # Main dashboard
  /project           # Project pages
    /[id]            # Project detail page
      /phase         # Phase pages
        /[phaseNumber]
      /members       # Team member management
      /settings      # Project settings
  /admin             # Admin-only pages
    /templates       # Template management
    /users           # User management
  /api               # API routes
    /projects        # Project CRUD operations
    /ai              # AI generation endpoints
    /admin           # Admin operations
/components
  /phases            # Phase form components
  /layout            # Layout components (Sidebar, TopBar)
  /templates         # Template builder components
  /ui                # Reusable UI components
  /notifications     # Notification system
/lib
  /ai                # AI integration (Gemini client)
  /exportHandlers    # Export logic (Blueprint, Cursor bundles)
  /hooks             # Custom React hooks
  /rbac              # Role-based access control
  /templates         # Template system
  /utils             # Utility functions
  /constants         # Application constants
  supabaseClient.ts  # Supabase client configuration
/types               # TypeScript type definitions
/styles              # Global styles and theme
/migrations          # Database migration scripts
```

## 📚 Documentation

- **[Dashboard Cron Setup](./DASHBOARD_CRON_SETUP.md)** - Configure scheduled dashboard reports

## ✨ Features

### Authentication & User Management
- Email/password authentication via Supabase Auth
- Magic link authentication
- Role-based user management (Admin, PM, Designer, Engineer)
- User profile management
- Password reset functionality

### Dashboard
- Project overview with status indicators
- Quick access to recent projects
- Project creation wizard
- Search and filter capabilities
- Sortable project tables

### Project Workspace
- Project metadata management
- Phase completion tracking
- Team member collaboration
- Export functionality (Blueprint Bundle, Cursor Bundle)
- Project settings and configuration

### Six Phase Modules

Each phase exists at `/project/[id]/phase/[phaseNumber]`:

1. **Concept Framing** - Problem statement, target users, value hypothesis, constraints, risks, assumptions
2. **Product Strategy** - Personas, JTBD, business outcomes, KPIs, features, tech stack
3. **Rapid Prototype Definition** - Screens, flows, components, design tokens, navigation
4. **Analysis & User Stories** - Entities, ERD, API specs, user stories, acceptance criteria, RBAC
5. **Build Accelerator** - Folder structure, architecture instructions, coding standards, env setup
6. **QA & Hardening** - Test plan, test cases, security checklist, performance requirements

### Template System
- Create reusable project templates
- Custom field configurations per phase
- Field grouping and conditional logic
- Template preview and builder
- Public/private template visibility
- Template usage tracking

### Export System
- **Blueprint Bundle**: Complete structured JSON export of all phases
- **Cursor Bundle**: Master prompt text file optimized for Cursor AI
- **Individual Phase Exports**: Export specific phases as JSON/Markdown
- **Export History**: Track all exports with metadata

### AI-Powered Features
- AI-generated problem statements
- Persona and JTBD generation
- Risk and constraint identification
- Screen and flow suggestions
- User story generation
- Document generation with custom prompts

### Code Quality & Infrastructure
- **Centralized Logging**: Environment-aware logging utility
- **Standardized API Errors**: Consistent error response format
- **Form Validation**: Reusable validation utilities
- **Constants Management**: Centralized constants for roles, statuses, priorities
- **Error Boundaries**: React error boundaries for graceful error handling
- **Focus Management**: Accessibility utilities for modal dialogs and forms
- **Performance Optimizations**: React.memo, useMemo, useCallback, debouncing
- **Keyboard Navigation**: Full keyboard support for improved accessibility
- **Unit Testing**: Comprehensive Jest test suite
- **E2E Testing**: Playwright end-to-end tests

## 🧪 Testing

### Test Status
✅ **All tests passing**: 180 tests across 20 test suites

### Unit Tests
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
```

**Current Status:**
- ✅ 180 tests passing
- ✅ 20 test suites passing
- ✅ Components, hooks, utilities, and API routes tested
- ✅ Build successful with no errors

### E2E Tests
```bash
npm run test:e2e         # Run Playwright tests
```

### Test Coverage
- Unit tests cover components, hooks, utilities, and API routes
- E2E tests cover critical user flows
- Coverage threshold: 70% minimum
- Current coverage: Core functionality well-tested with focus on critical paths

## 📚 Internal Documentation

- [migrations/](./migrations/) - Database migration scripts
- Contact team lead for additional internal documentation and architecture decisions

## 📄 License

Copyright © JoinFullStack, LLC. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited.

## 🔗 Reference Links

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Material-UI Documentation](https://mui.com)
