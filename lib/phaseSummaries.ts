import type {
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data,
  Phase6Data,
} from '@/types/phases';

export function generatePhase1Summary(data: Phase1Data): string {
  return `# Phase 1: Concept Framing Summary

## Problem Statement
${data.problem_statement || 'Not defined'}

## Target Users
${data.target_users?.map(u => `- ${u}`).join('\n') || 'Not defined'}

## Why Now / Market Timing
${data.why_now || 'Not defined'}

## Value Hypothesis
${data.value_hypothesis || 'Not defined'}

## Constraints
${data.constraints?.map(c => `- ${c}`).join('\n') || 'None defined'}

## Risks
${data.risks?.map(r => `- ${r}`).join('\n') || 'None defined'}

## Assumptions
${data.assumptions?.map(a => `- ${a}`).join('\n') || 'None defined'}

## Initial Features
${data.initial_features?.map(f => `- ${f}`).join('\n') || 'None defined'}

## Feasibility Notes
${data.feasibility_notes || 'Not defined'}

## High-Level Timeline
${data.high_level_timeline || 'Not defined'}
`;
}

export function generatePhase2Summary(data: Phase2Data): string {
  return `# Phase 2: Product Strategy Summary

## Personas
${data.personas?.map(p => `
### ${p.name}
${p.description}

**Goals:**
${p.goals?.map(g => `- ${g}`).join('\n') || 'None'}

**Pains:**
${p.pains?.map(pa => `- ${pa}`).join('\n') || 'None'}
`).join('\n') || 'No personas defined'}

## Jobs To Be Done
${data.jtbd?.map(j => `
- **${j.persona}**: ${j.statement} → ${j.outcome}
`).join('\n') || 'No JTBD defined'}

## Business Outcomes
${data.business_outcomes?.map(o => `- ${o}`).join('\n') || 'None defined'}

## KPIs
${data.kpis?.map(k => `- ${k}`).join('\n') || 'None defined'}

## Features
${data.scored_features?.map(f => `
### ${f.title}
${f.description}
- Impact: ${f.impact}/10
- Effort: ${f.effort}/10
- Confidence: ${f.confidence}/10
- MVP Group: ${f.mvp_group.toUpperCase()}
`).join('\n') || 'No features defined'}

## Tech Stack Preferences
${data.tech_stack_preferences || 'Not defined'}
`;
}

export function generatePhase3Summary(data: Phase3Data): string {
  return `# Phase 3: Rapid Prototype Definition Summary

## Screens
${data.screens?.map(s => `
### ${s.title} (${s.screen_key})
${s.description}
- Roles: ${s.roles.join(', ')}
- Core Screen: ${s.is_core ? 'Yes' : 'No'}
`).join('\n') || 'No screens defined'}

## User Flows
${data.flows?.map(f => `
### ${f.name}
- Start: ${f.start_screen}
- End: ${f.end_screen}
- Steps:
${f.steps?.map((step, i) => `  ${i + 1}. ${step}`).join('\n') || 'None'}
- Notes: ${f.notes || 'None'}
`).join('\n') || 'No flows defined'}

## Components
${data.components?.map(c => `
### ${c.name}
${c.description}
- Props: ${JSON.stringify(c.props, null, 2)}
- State Behavior: ${c.state_behavior}
- Used On: ${c.used_on.join(', ')}
`).join('\n') || 'No components defined'}

## Design Tokens
${JSON.stringify(data.design_tokens || {}, null, 2)}

## Navigation
- Primary: ${data.navigation?.primary_nav?.join(', ') || 'Not defined'}
- Secondary: ${data.navigation?.secondary_nav?.join(', ') || 'Not defined'}
- Route Map: ${JSON.stringify(data.navigation?.route_map || {}, null, 2)}
`;
}

export function generatePhase4Summary(data: Phase4Data): string {
  return `# Phase 4: Analysis & User Stories Summary

## Entities
${data.entities?.map(e => `
### ${e.name}
${e.description}
- Key Fields: ${e.key_fields.join(', ')}
- Relationships: ${e.relationships.join(', ')}
`).join('\n') || 'No entities defined'}

## ERD
${JSON.stringify(data.erd || {}, null, 2)}

## API Specifications
${data.api_spec?.map(api => `
### ${api.method} ${api.endpoint}
${api.description}
- Path: ${api.path}
- Request Params: ${JSON.stringify(api.request_params, null, 2)}
- Body Schema: ${JSON.stringify(api.body_schema, null, 2)}
- Response Schema: ${JSON.stringify(api.response_schema, null, 2)}
- Error Codes: ${api.error_codes.join(', ')}
`).join('\n') || 'No API specs defined'}

## User Stories
${data.user_stories?.map(s => `
- **${s.user_role}**: ${s.statement}
`).join('\n') || 'No user stories defined'}

## Acceptance Criteria
${data.acceptance_criteria?.map(c => `
- Story ID: ${c.story_id}
  - Given: ${c.given}
  - When: ${c.when}
  - Then: ${c.then}
`).join('\n') || 'No acceptance criteria defined'}

## RBAC Matrix
${JSON.stringify(data.rbac || {}, null, 2)}

## Non-Functional Requirements
${data.non_functional_requirements || 'Not defined'}
`;
}

export function generatePhase5Summary(data: Phase5Data): string {
  return `# Phase 5: Build Accelerator Summary

## Folder Structure
\`\`\`
${data.folder_structure || 'Not defined'}
\`\`\`

## Architecture Instructions
${data.architecture_instructions || 'Not defined'}

## Coding Standards
${data.coding_standards || 'Not defined'}

## Environment Setup
${data.env_setup || 'Not defined'}
`;
}

export function generatePhase6Summary(data: Phase6Data): string {
  return `# Phase 6: QA & Hardening Summary

## Test Plan
${data.test_plan || 'Not defined'}

## Test Cases
${data.test_cases?.map(tc => `
### ${tc.name}
- Type: ${tc.type}
- Description: ${tc.description}
- Steps:
${tc.steps?.map((step, i) => `  ${i + 1}. ${step}`).join('\n') || 'None'}
- Expected Result: ${tc.expected_result}
`).join('\n') || 'No test cases defined'}

## Security Checklist
${data.security_checklist?.map(item => `- [ ] ${item}`).join('\n') || 'No items defined'}

## Performance Requirements
${data.performance_requirements || 'Not defined'}

## Launch Readiness
${data.launch_readiness?.map(item => `- [ ] ${item}`).join('\n') || 'No items defined'}
`;
}

