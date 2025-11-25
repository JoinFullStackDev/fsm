import type {
  Phase1Data,
  Phase2Data,
  Phase3Data,
  Phase4Data,
  Phase5Data,
  Phase6Data,
} from '@/types/phases';
import type { Project } from '@/types/project';
import { generateAIResponse } from '@/lib/ai/geminiClient';

export interface BlueprintBundle {
  project: {
    name: string;
    description: string;
    status: string;
    primary_tool: string | null;
  };
  concept: {
    concept_summary: string;
    rac_summary: string;
    high_level_feasibility: string;
  };
  strategy: {
    personas: any[];
    outcomes_and_kpis: string;
    feature_backlog: any[];
    outcome_roadmap: string;
  };
  prototype: {
    screens: any[];
    flows: any[];
    components: any[];
    design_tokens: any;
    navigation_map: string;
  };
  analysis: {
    erd: any;
    apis: any[];
    user_stories: any[];
    acceptance_criteria: any[];
    rbac_matrix: any;
    non_functional_requirements: string;
  };
  build: {
    folder_structure: string;
    architecture_instructions: string;
    coding_standards: string;
    env_setup: string;
  };
  qa: {
    test_plan: string;
    test_cases: any[];
    security_checklist: string[];
    performance_requirements: string;
    launch_readiness: string[];
  };
}

export async function generateBlueprintBundle(
  project: Project,
  phases: {
    phase1?: Phase1Data;
    phase2?: Phase2Data;
    phase3?: Phase3Data;
    phase4?: Phase4Data;
    phase5?: Phase5Data;
    phase6?: Phase6Data;
  },
  apiKey?: string
): Promise<BlueprintBundle> {
  const phase1 = phases.phase1 || ({} as Phase1Data);
  const phase2 = phases.phase2 || ({} as Phase2Data);
  const phase3 = phases.phase3 || ({} as Phase3Data);
  const phase4 = phases.phase4 || ({} as Phase4Data);
  const phase5 = phases.phase5 || ({} as Phase5Data);
  const phase6 = phases.phase6 || ({} as Phase6Data);

  // Use AI to generate comprehensive blueprint documents if API key is available
  const useAI = !!apiKey;

  // Generate concept summary with AI
  let conceptSummary: string;
  if (useAI) {
    try {
      conceptSummary = await generateAIResponse(
        `Create a comprehensive, professional Concept Summary document for the project "${project.name}". 

Use all the following information to create a well-structured, detailed summary:

Problem Statement: ${phase1.problem_statement || 'Not defined'}
Target Users: ${phase1.target_users?.join(', ') || 'Not defined'}
Why Now: ${phase1.why_now || 'Not defined'}
Value Hypothesis: ${phase1.value_hypothesis || 'Not defined'}
Initial Features: ${phase1.initial_features?.join(', ') || 'Not defined'}
Constraints: ${phase1.constraints?.join(', ') || 'None'}
Risks: ${phase1.risks?.join(', ') || 'None'}
Assumptions: ${phase1.assumptions?.join(', ') || 'None'}
Feasibility Notes: ${phase1.feasibility_notes || 'Not defined'}
Timeline: ${phase1.high_level_timeline || 'Not defined'}

Create a professional markdown document with clear sections, proper formatting, and comprehensive analysis. Make it client-ready and actionable.`,
        { projectData: project, phaseData: phase1 },
        apiKey,
        project.name
      );
    } catch (error) {
      console.error('AI generation failed for concept summary, using fallback:', error);
      conceptSummary = `# Concept Summary\n\n## Problem Statement\n${phase1.problem_statement || 'Not defined'}\n\n## Target Users\n${phase1.target_users?.join('\n- ') || 'Not defined'}\n\n## Why Now / Market Timing\n${phase1.why_now || 'Not defined'}\n\n## Value Hypothesis\n${phase1.value_hypothesis || 'Not defined'}\n\n## Initial Features\n${phase1.initial_features?.join('\n- ') || 'Not defined'}`;
    }
  } else {
    conceptSummary = `# Concept Summary\n\n## Problem Statement\n${phase1.problem_statement || 'Not defined'}\n\n## Target Users\n${phase1.target_users?.join('\n- ') || 'Not defined'}\n\n## Why Now / Market Timing\n${phase1.why_now || 'Not defined'}\n\n## Value Hypothesis\n${phase1.value_hypothesis || 'Not defined'}\n\n## Initial Features\n${phase1.initial_features?.join('\n- ') || 'Not defined'}`;
  }

  // Generate RAC summary with AI
  let racSummary: string;
  if (useAI) {
    try {
      racSummary = await generateAIResponse(
        `Create a comprehensive Risks, Assumptions, and Constraints (RAC) analysis document for the project "${project.name}".

Constraints: ${phase1.constraints?.join(', ') || 'None defined'}
Risks: ${phase1.risks?.join(', ') || 'None defined'}
Assumptions: ${phase1.assumptions?.join(', ') || 'None defined'}

Create a professional markdown document that analyzes each constraint, risk, and assumption in detail. Provide mitigation strategies for risks and validation plans for assumptions.`,
        { projectData: project, phaseData: phase1 },
        apiKey,
        project.name
      );
    } catch (error) {
      console.error('AI generation failed for RAC summary, using fallback:', error);
      racSummary = `# Risks, Assumptions, Constraints\n\n## Constraints\n${phase1.constraints?.join('\n- ') || 'None defined'}\n\n## Risks\n${phase1.risks?.join('\n- ') || 'None defined'}\n\n## Assumptions\n${phase1.assumptions?.join('\n- ') || 'None defined'}`;
    }
  } else {
    racSummary = `# Risks, Assumptions, Constraints\n\n## Constraints\n${phase1.constraints?.join('\n- ') || 'None defined'}\n\n## Risks\n${phase1.risks?.join('\n- ') || 'None defined'}\n\n## Assumptions\n${phase1.assumptions?.join('\n- ') || 'None defined'}`;
  }

  // Generate feasibility notes with AI
  let highLevelFeasibility: string;
  if (useAI) {
    try {
      highLevelFeasibility = await generateAIResponse(
        `Create a comprehensive High-Level Feasibility Analysis document for the project "${project.name}".

Feasibility Notes: ${phase1.feasibility_notes || 'Not defined'}
Timeline: ${phase1.high_level_timeline || 'Not defined'}
Tech Stack: ${phase2.tech_stack_preferences || 'Not specified'}

Create a professional markdown document that analyzes technical feasibility, resource requirements, timeline considerations, and potential challenges.`,
        { projectData: project, phaseData: { ...phase1, tech_stack: phase2.tech_stack_preferences } },
        apiKey,
        project.name
      );
    } catch (error) {
      console.error('AI generation failed for feasibility, using fallback:', error);
      highLevelFeasibility = `# High-Level Feasibility\n\n${phase1.feasibility_notes || 'Not defined'}\n\n## Timeline\n${phase1.high_level_timeline || 'Not defined'}`;
    }
  } else {
    highLevelFeasibility = `# High-Level Feasibility\n\n${phase1.feasibility_notes || 'Not defined'}\n\n## Timeline\n${phase1.high_level_timeline || 'Not defined'}`;
  }

  // Generate outcomes and KPIs with AI
  let outcomesAndKPIs: string;
  if (useAI) {
    try {
      outcomesAndKPIs = await generateAIResponse(
        `Create a comprehensive Business Outcomes & KPIs document for the project "${project.name}".

Business Outcomes: ${phase2.business_outcomes?.join(', ') || 'None defined'}
KPIs: ${phase2.kpis?.join(', ') || 'None defined'}
Personas: ${JSON.stringify(phase2.personas || [], null, 2)}

Create a professional markdown document that defines measurable business outcomes, establishes clear KPIs with targets, and explains how success will be measured.`,
        { projectData: project, phaseData: phase2 },
        apiKey,
        project.name
      );
    } catch (error) {
      console.error('AI generation failed for outcomes/KPIs, using fallback:', error);
      outcomesAndKPIs = `# Business Outcomes & KPIs\n\n## Business Outcomes\n${phase2.business_outcomes?.join('\n- ') || 'None defined'}\n\n## KPIs\n${phase2.kpis?.join('\n- ') || 'None defined'}`;
    }
  } else {
    outcomesAndKPIs = `# Business Outcomes & KPIs\n\n## Business Outcomes\n${phase2.business_outcomes?.join('\n- ') || 'None defined'}\n\n## KPIs\n${phase2.kpis?.join('\n- ') || 'None defined'}`;
  }

  // Generate outcome roadmap with AI
  let outcomeRoadmap: string;
  if (useAI) {
    try {
      outcomeRoadmap = await generateAIResponse(
        `Create a comprehensive Outcome Roadmap document for the project "${project.name}".

MVP Features: ${phase2.scored_features?.filter(f => f.mvp_group === 'mvp').map(f => f.title).join(', ') || 'None'}
V2 Features: ${phase2.scored_features?.filter(f => f.mvp_group === 'v2').map(f => f.title).join(', ') || 'None'}
V3 Features: ${phase2.scored_features?.filter(f => f.mvp_group === 'v3').map(f => f.title).join(', ') || 'None'}

Full Feature Details: ${JSON.stringify(phase2.scored_features || [], null, 2)}

Create a professional markdown document that organizes features by release phase (MVP, V2, V3), explains the rationale for prioritization, and provides a clear roadmap timeline.`,
        { projectData: project, phaseData: phase2 },
        apiKey,
        project.name
      );
    } catch (error) {
      console.error('AI generation failed for roadmap, using fallback:', error);
      outcomeRoadmap = `# Outcome Roadmap\n\n## MVP Features\n${phase2.scored_features?.filter(f => f.mvp_group === 'mvp').map(f => `- ${f.title}`).join('\n') || 'None defined'}\n\n## V2 Features\n${phase2.scored_features?.filter(f => f.mvp_group === 'v2').map(f => `- ${f.title}`).join('\n') || 'None defined'}\n\n## V3 Features\n${phase2.scored_features?.filter(f => f.mvp_group === 'v3').map(f => `- ${f.title}`).join('\n') || 'None defined'}`;
    }
  } else {
    outcomeRoadmap = `# Outcome Roadmap\n\n## MVP Features\n${phase2.scored_features?.filter(f => f.mvp_group === 'mvp').map(f => `- ${f.title}`).join('\n') || 'None defined'}\n\n## V2 Features\n${phase2.scored_features?.filter(f => f.mvp_group === 'v2').map(f => `- ${f.title}`).join('\n') || 'None defined'}\n\n## V3 Features\n${phase2.scored_features?.filter(f => f.mvp_group === 'v3').map(f => `- ${f.title}`).join('\n') || 'None defined'}`;
  }

  // Generate navigation map
  const navigationMap = `# Navigation Map

## Primary Navigation
${phase3.navigation?.primary_nav?.join('\n- ') || 'Not defined'}

## Secondary Navigation
${phase3.navigation?.secondary_nav?.join('\n- ') || 'Not defined'}

## Route Map
${JSON.stringify(phase3.navigation?.route_map || {}, null, 2)}
`;

  return {
    project: {
      name: project.name,
      description: project.description || '',
      status: project.status,
      primary_tool: project.primary_tool,
    },
    concept: {
      concept_summary: conceptSummary,
      rac_summary: racSummary,
      high_level_feasibility: highLevelFeasibility,
    },
    strategy: {
      personas: phase2.personas || [],
      outcomes_and_kpis: outcomesAndKPIs,
      feature_backlog: phase2.scored_features || [],
      outcome_roadmap: outcomeRoadmap,
    },
    prototype: {
      screens: phase3.screens || [],
      flows: phase3.flows || [],
      components: phase3.components || [],
      design_tokens: phase3.design_tokens || {},
      navigation_map: navigationMap,
    },
    analysis: {
      erd: phase4.erd || {},
      apis: phase4.api_spec || [],
      user_stories: phase4.user_stories || [],
      acceptance_criteria: phase4.acceptance_criteria || [],
      rbac_matrix: phase4.rbac || {},
      non_functional_requirements: phase4.non_functional_requirements || '',
    },
    build: {
      folder_structure: phase5.folder_structure || '',
      architecture_instructions: phase5.architecture_instructions || '',
      coding_standards: phase5.coding_standards || '',
      env_setup: phase5.env_setup || '',
    },
    qa: {
      test_plan: phase6.test_plan || '',
      test_cases: phase6.test_cases || [],
      security_checklist: phase6.security_checklist || [],
      performance_requirements: phase6.performance_requirements || '',
      launch_readiness: phase6.launch_readiness || [],
    },
  };
}

