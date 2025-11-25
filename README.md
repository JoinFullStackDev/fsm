# FullStack Method™ App

[![Tests](https://github.com/JoinFullStackDev/fsm/actions/workflows/test.yml/badge.svg)](https://github.com/JoinFullStackDev/fsm/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com)

A production-grade web application that encodes the 6 phases of the FullStack Method™ into a guided, structured system. This platform generates structured JSON, Markdown, text files, ERDs, API contracts, user stories, and blueprint bundles that can be consumed by AI coding tools like Cursor, Lovable, Replit, Base44, and others.

## 🎯 Platform Overview

The FullStack Method™ App is an AI-accelerated project management platform designed to transform how teams build software. It provides a structured approach to product development through six distinct phases, ensuring clarity, documentation, and engineering-ready deliverables before code is written.

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

### Build Status

The project uses GitHub Actions for continuous integration:

- **Unit Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright
- **Code Coverage**: Codecov integration
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript compiler

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

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GENAI_API_KEY=your_google_genai_api_key  # Optional, for AI features
```

### Deployment

The application is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## 📋 Prerequisites

- **Node.js**: 18 or higher
- **npm**: 9 or higher
- **Supabase Account**: For database and authentication
- **Google Cloud Account**: (Optional) For AI features

## 🛠️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/JoinFullStackDev/fsm.git
   cd fsm
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
   - Run the SQL migrations in the `migrations/` directory
   - Start with `add_project_templates.sql` and follow the migration order
   - Enable Row Level Security (RLS) policies as needed

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
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

### Unit Tests
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
```

### E2E Tests
```bash
npm run test:e2e         # Run Playwright tests
```

### Test Coverage
- Unit tests cover components, hooks, utilities, and API routes
- E2E tests cover critical user flows
- Coverage threshold: 70% minimum

## 📚 Documentation

- [PRD.md](./PRD.md) - Product Requirements Document
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - Feature implementation status
- [migrations/](./migrations/) - Database migration scripts

## 🤝 Contributing

This is a proprietary project. For contributions, please contact the maintainers.

## 📄 License

Copyright © JoinFullStack, LLC. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited.

## 🔗 Links

- [FullStack Method™](https://joinfullstack.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Material-UI Documentation](https://mui.com)
