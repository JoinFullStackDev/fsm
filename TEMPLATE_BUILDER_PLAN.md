# Enhanced Template Builder System - Implementation Plan

## Overview

Transform the basic template system into a powerful drag-and-drop form builder that allows admins to customize phase forms with full control over field structure, layout, validation, and AI generation settings.

---

## ✅ Phase 1: Default Template Creation (COMPLETED)

### 1.1 Create Default Template Utility ✅
- **File**: `lib/templates/createDefaultTemplate.ts`
- Extracted current phase structure from `types/phases.ts`
- Generated field definitions for all 6 phases based on existing Phase1Data through Phase6Data
- Mapped each field to its current component type (TextField, array, object, etc.)
- Created "FullStack Method Default" template with all current fields

### 1.2 Migration for Template Field Configurations ✅
- **File**: `migrations/add_template_field_configs.sql`
- Created `template_field_configs` table with all necessary fields
- Created `template_field_groups` table for field grouping
- Added `version` column to `project_templates`
- Added indexes and RLS policies

### 1.3 Admin Script to Generate Default Template ✅
- **File**: `app/api/admin/templates/generate-default/route.ts`
- API endpoint that creates field configs for all phases
- Inserts default template if it doesn't exist
- **File**: `migrations/create_default_template.sql`
- SQL migration to populate default template with all 44 fields across 6 phases

---

## ✅ Phase 2: Template Builder UI Foundation (COMPLETED)

### 2.1 Install Drag-and-Drop Library ✅
- Added `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` to `package.json`

### 2.2 Template Builder Page Structure ✅
- **File**: `app/admin/templates/[id]/builder/page.tsx`
- Main builder interface with:
  - Phase selector (tabs for phases 1-6)
  - Left sidebar: Component palette (draggable field types)
  - Center: Canvas area (drop zone for fields)
  - Right sidebar: Field configuration panel
  - Top toolbar: Save, Preview, Export template

### 2.3 Component Palette ✅
- **File**: `components/templates/ComponentPalette.tsx`
- Draggable components for 10 field types:
  - Text Field, Textarea, Array Field, Select/Dropdown, Checkbox
  - Custom Component (for complex types like Persona, Screen, etc.)

### 2.4 Field Canvas ✅
- **File**: `components/templates/FieldCanvas.tsx`
- Drop zone using `@dnd-kit`
- Visual representation of form layout
- Grid system (12 columns, Material-UI compatible)
- Drag handles for reordering
- Click to select and configure

### 2.5 Field Configuration Panel ✅
- **File**: `components/templates/FieldConfigPanel.tsx`
- Configuration options:
  - **Basic**: Label, Help Text, Placeholder, Required/Optional
  - **Layout**: Grid columns (1-12), Spacing, Alignment
  - **Validation**: Min/Max length, Pattern (regex), Custom rules
  - **AI Settings**: Enable AI assist, Custom prompt, Context fields

---

## ✅ Phase 3: Advanced Template Features (PARTIALLY COMPLETED)

### 3.1 Field Grouping ✅
- **File**: `components/templates/FieldGroup.tsx`
- Visual grouping with collapsible sections
- Group-level configuration (title, description, icon)
- Integrated into `TemplateBasedPhaseForm`

### 3.2 Conditional Field Logic ✅
- **File**: `lib/templates/conditionalLogic.ts`
- Rule evaluation system:
  - Field dependencies (show field X if field Y equals Z)
  - Multiple conditions (AND/OR logic)
  - Operators: equals, notEquals, contains, greaterThan, lessThan
- Runtime evaluation in form renderer

### 3.3 Layout System ⏳ (Basic Complete, Enhancements Needed)
- **Status**: Basic column layout working
- **Needed**: 
  - Responsive breakpoints (xs, sm, md, lg, xl)
  - Visual layout editor with drag-to-resize
  - Advanced spacing controls
  - Alignment options

### 3.4 AI Generation Integration ✅
- **Status**: Fully integrated
- Per-field AI configuration working
- Custom generation prompts
- Context fields support

---

## ✅ Phase 4: Dynamic Form Renderer (COMPLETED)

### 4.1 Template-Based Form Renderer ✅
- **File**: `components/phases/TemplateBasedPhaseForm.tsx`
- Reads template field configs from database
- Dynamically renders fields based on configuration
- Supports all field types and layouts
- Handles conditional logic
- Integrates AI assist buttons where configured
- Template sync indicator with refresh mechanism

### 4.2 Field Type Components ✅
- **Files**: `components/templates/fields/` directory
- All reusable field components created:
  - `TextField.tsx`, `TextareaField.tsx`, `ArrayField.tsx`
  - `SelectField.tsx`, `CheckboxField.tsx`
  - `CustomField.tsx` (router for custom types)
  - **Phase 3 custom fields**: `ScreensField.tsx`, `FlowsField.tsx`, `ComponentsField.tsx`, `DesignTokensField.tsx`, `NavigationField.tsx`
  - **Phase 4 custom fields**: `EntitiesField.tsx`, `ERDField.tsx`, `APISpecField.tsx`, `UserStoriesField.tsx`, `AcceptanceCriteriaField.tsx`, `RBACField.tsx`
  - **Phase 6 custom fields**: `TestCasesField.tsx`
  - **Phase 2 custom fields**: `PersonasField.tsx`, `JTBDField.tsx`, `FeaturesField.tsx`, `ScoredFeaturesField.tsx`

### 4.3 Validation System ✅
- **File**: `lib/templates/validation.ts`
- Runtime validation based on template configs
- Zod schema generation from template configs
- Error message display

### 4.4 Update Phase Forms to Use Templates ✅
- **File**: `app/project/[id]/phase/[phaseNumber]/page.tsx`
- Checks if project has a template
- Uses `TemplateBasedPhaseForm` when template available
- Falls back to existing `Phase1Form`, etc. for backward compatibility
- Gracefully handles missing `template_id` column

---

## 🚧 Phase 5: Template Management (IN PROGRESS - 2/4 Complete)

### 5.1 Template Preview ✅
- **File**: `app/admin/templates/[id]/preview/page.tsx`
- **Status**: Completed
- **Features**:
  - Live preview of template using `TemplateBasedPhaseForm`
  - Switch between phases via tabs
  - Interactive form with actual field rendering
  - Test conditional logic in real-time
  - "Reset Preview" button to clear form data
  - Shows exactly how the form will appear to users

### 5.2 Template Export/Import ⏳
- **Export**: ✅ `app/admin/templates/[id]/export/route.ts` (exists)
- **Import**: ⏳ Not implemented
- **Needed**:
  - Import template from JSON file
  - Validate imported template structure
  - Handle version conflicts
  - Merge/overwrite options
  - Import UI in template builder or templates list page

### 5.3 Template Duplication ✅
- **Status**: Completed
- **File**: `app/api/admin/templates/[id]/duplicate/route.ts`
- **Features**:
  - Clone existing template with all field configs
  - Automatically names duplicate as "{Original Name} (Copy)"
  - Copies all template_phases, template_field_configs, and template_field_groups
  - Duplicates are private by default
  - UI button (ContentCopy icon) in templates list page

### 5.4 Template Versioning ⏳
- **Status**: `version` column exists, but system not implemented
- **Needed**:
  - Auto-increment version on template save
  - Version history tracking
  - Allow projects to specify template version
  - Version comparison UI
  - Rollback to previous versions
  - Migration path for projects using old template versions

---

## ⏳ Phase 6: Integration & Polish (NOT STARTED)

### 6.1 Update Project Creation
- **File**: `app/project/new/page.tsx`
- **Needed**:
  - Show template preview when selected
  - Display template description and field count
  - Visual template cards with thumbnails
  - Template comparison view

### 6.2 Template Application Logic
- **File**: `lib/templates/applyTemplate.ts` (needs to be created)
- **Needed**:
  - When creating project from template:
    - Load template field configs
    - Initialize phase data with defaults
    - Set up conditional logic state
    - Apply validation rules
    - Handle template version selection

### 6.3 Migration Path for Existing Projects
- **Needed**:
  - Script to assign default template to existing projects
  - Ensure backward compatibility
  - Gradual migration strategy
  - Migration UI or admin tool

### 6.4 Documentation & Help
- **Needed**:
  - In-app help tooltips for template builder
  - Template builder tutorial
  - Field type documentation
  - Best practices guide

---

## Implementation Status Summary

### ✅ Completed
- Phase 1: Default Template Creation
- Phase 2: Template Builder UI Foundation
- Phase 4: Dynamic Form Renderer (all custom field components)
- Phase 3: Field Grouping, Conditional Logic, Basic AI Integration

### 🚧 In Progress
- Phase 5: Template Management (Preview enhancement, Import, Duplication, Versioning)

### ⏳ Not Started
- Phase 6: Integration & Polish
- Phase 3: Layout System Enhancements (responsive breakpoints, visual editor)

---

## Next Steps (Priority Order)

1. ✅ **Phase 5.1: Enhance Template Preview** - COMPLETED
2. ✅ **Phase 5.3: Template Duplication** - COMPLETED
3. **Phase 5.2: Template Import** - Complete the export/import cycle
4. **Phase 5.4: Template Versioning** - Full version management system
5. **Phase 6: Integration & Polish** - Project creation enhancements, migration tools

---

## Technical Considerations

### Database Schema
- ✅ `template_field_configs` table stores field definitions
- ✅ `template_field_groups` table for grouping
- ✅ JSONB for flexible configuration storage
- ✅ Indexes on `template_id`, `phase_number`, `display_order`
- ⏳ Version history table needed for full versioning

### Type Safety
- ✅ TypeScript interfaces for template configs (`types/templates.ts`)
- ✅ Validation schemas (Zod) for template structure
- ✅ Runtime type checking

### Performance
- ✅ Lazy load template configs
- ⏳ Cache template definitions (could be enhanced)
- ✅ Optimized drag-and-drop rendering

### Accessibility
- ✅ Keyboard navigation in builder
- ✅ Screen reader support via MUI components
- ✅ ARIA labels for drag handles

---

## Files Created/Modified

### New Files Created
- `lib/templates/createDefaultTemplate.ts`
- `migrations/add_template_field_configs.sql`
- `migrations/create_default_template.sql`
- `app/api/admin/templates/generate-default/route.ts`
- `app/admin/templates/[id]/builder/page.tsx`
- `components/templates/ComponentPalette.tsx`
- `components/templates/FieldCanvas.tsx`
- `components/templates/FieldConfigPanel.tsx`
- `components/templates/FieldGroup.tsx`
- `components/phases/TemplateBasedPhaseForm.tsx`
- `components/templates/fields/*.tsx` (23 field components)
- `lib/templates/conditionalLogic.ts`
- `lib/templates/validation.ts`
- `lib/phases/calculatePhaseProgress.ts`
- `components/phases/TemplateSyncIndicator.tsx`

### Modified Files
- `app/project/new/page.tsx` (template selection UI)
- `app/project/[id]/phase/[phaseNumber]/page.tsx` (use template-based forms)
- `app/admin/templates/page.tsx` (add "Build Template" button)
- `app/admin/templates/[id]/preview/page.tsx` (basic preview exists)
- `app/admin/templates/[id]/export/route.ts` (export exists)
- `package.json` (add drag-and-drop libraries)
- `types/templates.ts` (template type definitions)
- `types/project.ts` (PhaseSummary with data field)

