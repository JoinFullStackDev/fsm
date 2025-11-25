import { generateAIResponse } from '@/lib/ai/geminiClient';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';
import type { WeeklyReportData, MonthlyReportData, ForecastReportData } from './dataAggregator';
import { format, parseISO } from 'date-fns';

export interface ReportContent {
  executiveSummary: string;
  keyInsights: string[];
  risks: string[];
  recommendations: string[];
  teamWorkload: string;
}

/**
 * Generate AI-powered report content for weekly report
 */
export async function generateWeeklyReportContent(
  data: WeeklyReportData,
  projectName: string,
  projectMembers: Array<{ id: string; name: string | null }>,
  apiKey?: string
): Promise<ReportContent> {
  const lastWeekRange = `${format(data.lastWeek.start, 'MMM d')} - ${format(data.lastWeek.end, 'MMM d, yyyy')}`;
  const thisWeekRange = `${format(data.thisWeek.start, 'MMM d')} - ${format(data.thisWeek.end, 'MMM d, yyyy')}`;

  const completedTasksList = data.lastWeek.completed.slice(0, 10).map((t) => `- ${t.title}${t.due_date ? ` (due: ${format(parseISO(t.due_date), 'MMM d')})` : ''}`).join('\n');
  const upcomingTasksList = data.thisWeek.upcoming.slice(0, 10).map((t) => `- ${t.title}${t.due_date ? ` (due: ${format(parseISO(t.due_date), 'MMM d')})` : ''}`).join('\n');

  const prompt = `You are a project management analyst. Generate a comprehensive weekly report for the project "${projectName}".

**Last Week (${lastWeekRange}):**
- Total tasks: ${data.lastWeek.tasks.length}
- Completed: ${data.lastWeek.completed.length}
${completedTasksList || '- No tasks completed'}

**This Week (${thisWeekRange}):**
- Total tasks: ${data.thisWeek.tasks.length}
- Upcoming tasks: ${data.thisWeek.upcoming.length}
${upcomingTasksList || '- No upcoming tasks'}

**Overall Metrics:**
- Total tasks: ${data.metrics.total}
- Completed: ${data.metrics.completed}
- In Progress: ${data.metrics.inProgress}
- Todo: ${data.metrics.todo}
- Overdue: ${data.metrics.overdue}
- Upcoming deadlines (next 7 days): ${data.metrics.upcomingDeadlines}

**Tasks by Priority:**
${Object.entries(data.metrics.byPriority)
  .map(([priority, count]) => `- ${priority}: ${count}`)
  .join('\n')}

**Team Members:** ${projectMembers.map((m) => m.name || 'Unknown').join(', ')}

Generate a professional weekly report with:
1. Executive Summary (4-5 sentences that MUST include specific task names. Start by listing 3-5 key completed tasks from last week by name, then list 3-5 key upcoming tasks for this week by name. Include their priorities and due dates when available. Example: "Last week we completed 'Design User Interface Mockups' (high priority) and 'Set Up Development Environment' (medium priority). This week, we're focusing on 'Implement Authentication System' (due Dec 15, high priority) and 'Create Database Schema' (due Dec 18, medium priority).")
2. Key Insights (3-5 bullet points highlighting important observations)
3. Risks (identify any blockers, overdue tasks, or potential issues)
4. Recommendations (actionable next steps)
5. Team Workload Analysis (analyze workload distribution and identify any team members who may be overloaded)

IMPORTANT: The executive summary MUST include actual task names from the lists above. Do not use generic phrases like "12 tasks" - instead name specific tasks.

Format your response as JSON with this structure:
{
  "executiveSummary": "...",
  "keyInsights": ["...", "..."],
  "risks": ["...", "..."],
  "recommendations": ["...", "..."],
  "teamWorkload": "..."
}`;

  try {
    const response = await generateAIResponse(prompt, {
      projectData: { name: projectName },
    }, apiKey, projectName);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let reportContent: ReportContent;
    if (jsonMatch) {
      reportContent = JSON.parse(jsonMatch[0]) as ReportContent;
    } else {
      // Fallback: try to extract structured content
      reportContent = parseStructuredContent(response);
    }

    // Enhance executive summary with actual task names if they're missing
    if (!reportContent.executiveSummary.includes('"') && !reportContent.executiveSummary.match(/['"](.+?)['"]/)) {
      const completedTasks = data.lastWeek.completed.slice(0, 3).map(t => 
        `"${t.title}"${t.priority ? ` (${t.priority} priority)` : ''}${t.due_date ? `, completed ${format(parseISO(t.due_date), 'MMM d')}` : ''}`
      ).join(', ');
      const upcomingTasks = data.thisWeek.upcoming.slice(0, 3).map(t => 
        `"${t.title}"${t.priority ? ` (${t.priority} priority)` : ''}${t.due_date ? `, due ${format(parseISO(t.due_date), 'MMM d')}` : ''}`
      ).join(', ');
      
      const enhancedSummary = `Last week, we completed ${data.lastWeek.completed.length} tasks including: ${completedTasks || 'none'}. This week, we have ${data.thisWeek.upcoming.length} upcoming tasks including: ${upcomingTasks || 'none'}. ${reportContent.executiveSummary}`;
      reportContent.executiveSummary = enhancedSummary;
    }

    return reportContent;
  } catch (error) {
    // Fallback to basic report if AI fails
    return generateFallbackWeeklyContent(data, projectName);
  }
}

/**
 * Generate AI-powered report content for monthly report
 */
export async function generateMonthlyReportContent(
  data: MonthlyReportData,
  projectName: string,
  projectMembers: Array<{ id: string; name: string | null }>,
  apiKey?: string
): Promise<ReportContent> {
  const monthRange = `${format(data.month.start, 'MMMM yyyy')}`;

  const completedTasksList = data.month.completed.slice(0, 15).map((t) => `- ${t.title}${t.due_date ? ` (due: ${format(parseISO(t.due_date), 'MMM d')})` : ''}`).join('\n');
  const activeTasksList = data.month.tasks.filter(t => t.status !== 'done').slice(0, 15).map((t) => `- ${t.title}${t.due_date ? ` (due: ${format(parseISO(t.due_date), 'MMM d')})` : ''}`).join('\n');

  const prompt = `You are a project management analyst. Generate a comprehensive monthly report for the project "${projectName}" for ${monthRange}.

**Month Summary:**
- Total tasks: ${data.month.tasks.length}
- Completed: ${data.month.completed.length}
- Completion rate: ${data.metrics.total > 0 ? Math.round((data.metrics.completed / data.metrics.total) * 100) : 0}%

**Key Completed Tasks:**
${completedTasksList || '- No tasks completed'}

**Active Tasks:**
${activeTasksList || '- No active tasks'}

**Metrics:**
- Completed: ${data.metrics.completed}
- In Progress: ${data.metrics.inProgress}
- Todo: ${data.metrics.todo}
- Overdue: ${data.metrics.overdue}

**Tasks by Priority:**
${Object.entries(data.metrics.byPriority)
  .map(([priority, count]) => `- ${priority}: ${count}`)
  .join('\n')}

**Tasks by Phase:**
${Object.entries(data.metrics.byPhase)
  .map(([phase, count]) => `- Phase ${phase}: ${count}`)
  .join('\n')}

**Team Members:** ${projectMembers.map((m) => m.name || 'Unknown').join(', ')}

Generate a professional monthly report with:
1. Executive Summary (5-6 sentences that MUST include specific task names. Start by listing 4-6 key completed tasks from this month by name with their priorities, then list 4-6 key active tasks by name with their priorities and due dates. Example: "This month we completed 'Build User Authentication' (high priority), 'Design Dashboard UI' (medium priority), and 'Set Up CI/CD Pipeline' (high priority). Currently active tasks include 'Implement Payment Processing' (due Dec 20, high priority) and 'Create Admin Panel' (due Dec 25, medium priority).")
2. Key Insights (4-6 bullet points highlighting achievements and challenges)
3. Risks (identify blockers, trends, or concerns)
4. Recommendations (strategic next steps for the coming month)
5. Team Workload Analysis (analyze team performance and workload distribution)

IMPORTANT: The executive summary MUST include actual task names from the lists above. Do not use generic phrases like "15 tasks" - instead name specific tasks.

Format your response as JSON with this structure:
{
  "executiveSummary": "...",
  "keyInsights": ["...", "..."],
  "risks": ["...", "..."],
  "recommendations": ["...", "..."],
  "teamWorkload": "..."
}`;

  try {
    const response = await generateAIResponse(prompt, {
      projectData: { name: projectName },
    }, apiKey, projectName);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let reportContent: ReportContent;
    if (jsonMatch) {
      reportContent = JSON.parse(jsonMatch[0]) as ReportContent;
    } else {
      reportContent = parseStructuredContent(response);
    }

    // Enhance executive summary with actual task names if they're missing
    if (!reportContent.executiveSummary.includes('"') && !reportContent.executiveSummary.match(/['"](.+?)['"]/)) {
      const completedTasks = data.month.completed.slice(0, 4).map(t => 
        `"${t.title}"${t.priority ? ` (${t.priority} priority)` : ''}${t.due_date ? `, completed ${format(parseISO(t.due_date), 'MMM d')}` : ''}`
      ).join(', ');
      const activeTasks = data.month.tasks.filter(t => t.status !== 'done').slice(0, 4).map(t => 
        `"${t.title}"${t.priority ? ` (${t.priority} priority)` : ''}${t.due_date ? `, due ${format(parseISO(t.due_date), 'MMM d')}` : ''}`
      ).join(', ');
      
      const enhancedSummary = `This month, we completed ${data.month.completed.length} tasks including: ${completedTasks || 'none'}. Currently active tasks include: ${activeTasks || 'none'}. ${reportContent.executiveSummary}`;
      reportContent.executiveSummary = enhancedSummary;
    }

    return reportContent;
  } catch (error) {
    return generateFallbackMonthlyContent(data, projectName);
  }
}

/**
 * Generate AI-powered report content for forecast report
 */
export async function generateForecastReportContent(
  data: ForecastReportData,
  projectName: string,
  projectMembers: Array<{ id: string; name: string | null }>,
  apiKey?: string
): Promise<ReportContent> {
  const periodRange = `${format(data.period.start, 'MMM d')} - ${format(data.period.end, 'MMM d, yyyy')}`;

  const keyTasksList = data.tasks.slice(0, 15).map((t) => `- ${t.title} (${t.priority}${t.due_date ? `, due: ${format(parseISO(t.due_date), 'MMM d')}` : ''})`).join('\n');

  const prompt = `You are a project management analyst. Generate a comprehensive forecast report for the project "${projectName}" for the next ${data.period.days} days (${periodRange}).

**Forecast Period:**
- Days: ${data.period.days}
- Total upcoming tasks: ${data.tasks.length}

**Key Upcoming Tasks:**
${keyTasksList || '- No upcoming tasks'}

**Tasks by Priority:**
${Object.entries(data.byPriority)
  .map(([priority, tasks]) => `- ${priority}: ${tasks.length} tasks`)
  .join('\n')}

**Tasks by Phase:**
${Object.entries(data.byPhase)
  .map(([phase, tasks]) => `- Phase ${phase}: ${tasks.length} tasks`)
  .join('\n')}

**Team Workload Distribution:**
${Object.entries(data.byAssignee)
  .map(([assigneeId, tasks]) => {
    const member = projectMembers.find((m) => m.id === assigneeId);
    const name = member?.name || 'Unassigned';
    return `- ${name}: ${tasks.length} tasks`;
  })
  .join('\n')}

Generate a professional forecast report with:
1. Executive Summary (5-6 sentences that MUST include specific task names. List 5-7 key upcoming tasks by name with their priorities and due dates. Example: "Over the next ${data.period.days} days, we're focusing on 'Implement User Dashboard' (due Dec 20, high priority), 'Build API Endpoints' (due Dec 22, high priority), 'Create Database Migrations' (due Dec 18, medium priority), 'Design Mobile UI' (due Dec 25, medium priority), and 'Set Up Testing Framework' (due Dec 19, low priority).")
2. Key Insights (4-6 bullet points about workload, priorities, and timeline)
3. Risks (identify potential blockers, resource constraints, or timeline risks)
4. Recommendations (actionable steps to ensure successful delivery)
5. Team Workload Analysis (analyze if team members are overloaded and suggest rebalancing if needed)

IMPORTANT: The executive summary MUST include actual task names from the list above. Do not use generic phrases like "12 tasks" - instead name specific tasks with their priorities and due dates.

Format your response as JSON with this structure:
{
  "executiveSummary": "...",
  "keyInsights": ["...", "..."],
  "risks": ["...", "..."],
  "recommendations": ["...", "..."],
  "teamWorkload": "..."
}`;

  try {
    const response = await generateAIResponse(prompt, {
      projectData: { name: projectName },
    }, apiKey, projectName);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let reportContent: ReportContent;
    if (jsonMatch) {
      reportContent = JSON.parse(jsonMatch[0]) as ReportContent;
    } else {
      reportContent = parseStructuredContent(response);
    }

    // Enhance executive summary with actual task names if they're missing
    if (!reportContent.executiveSummary.includes('"') && !reportContent.executiveSummary.match(/['"](.+?)['"]/)) {
      const keyTasks = data.tasks.slice(0, 5).map(t => 
        `"${t.title}"${t.priority ? ` (${t.priority} priority)` : ''}${t.due_date ? `, due ${format(parseISO(t.due_date), 'MMM d')}` : ''}`
      ).join(', ');
      
      const enhancedSummary = `Over the next ${data.period.days} days, we have ${data.tasks.length} tasks scheduled. Key upcoming tasks include: ${keyTasks || 'none'}. ${reportContent.executiveSummary}`;
      reportContent.executiveSummary = enhancedSummary;
    }

    return reportContent;
  } catch (error) {
    return generateFallbackForecastContent(data, projectName);
  }
}

/**
 * Parse structured content from AI response (fallback)
 */
function parseStructuredContent(response: string): ReportContent {
  const content: ReportContent = {
    executiveSummary: '',
    keyInsights: [],
    risks: [],
    recommendations: [],
    teamWorkload: '',
  };

  // Try to extract sections (using case-insensitive flag without 's' flag for compatibility)
  const summaryMatch = response.match(new RegExp('executive summary[:\\-]?\\s*(.+?)(?=\\n\\n|\\n\\*\\*|$)', 'i'));
  if (summaryMatch) {
    content.executiveSummary = summaryMatch[1].trim();
  }

  const insightsMatch = response.match(new RegExp('key insights?[:\\-]?\\s*(.+?)(?=\\n\\n|\\n\\*\\*|risks|recommendations|$)', 'i'));
  if (insightsMatch) {
    content.keyInsights = insightsMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-') || /^\d+\./.test(line.trim()))
      .map((line) => line.replace(/^[-•\d.]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  const risksMatch = response.match(new RegExp('risks?[:\\-]?\\s*(.+?)(?=\\n\\n|\\n\\*\\*|recommendations|$)', 'i'));
  if (risksMatch) {
    content.risks = risksMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-') || /^\d+\./.test(line.trim()))
      .map((line) => line.replace(/^[-•\d.]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  const recommendationsMatch = response.match(new RegExp('recommendations?[:\\-]?\\s*(.+?)(?=\\n\\n|\\n\\*\\*|team workload|$)', 'i'));
  if (recommendationsMatch) {
    content.recommendations = recommendationsMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-') || /^\d+\./.test(line.trim()))
      .map((line) => line.replace(/^[-•\d.]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  const workloadMatch = response.match(new RegExp('team workload[:\\-]?\\s*(.+?)(?=\\n\\n|\\n\\*\\*|$)', 'i'));
  if (workloadMatch) {
    content.teamWorkload = workloadMatch[1].trim();
  }

  return content;
}

/**
 * Generate fallback content if AI fails
 */
function generateFallbackWeeklyContent(data: WeeklyReportData, projectName: string): ReportContent {
  const completedTasks = data.lastWeek.completed.slice(0, 5).map(t => t.title).join(', ');
  const upcomingTasks = data.thisWeek.upcoming.slice(0, 5).map(t => t.title).join(', ');
  
  return {
    executiveSummary: `Last week, we completed ${data.lastWeek.completed.length} tasks including: ${completedTasks || 'none'}. This week, we have ${data.thisWeek.upcoming.length} upcoming tasks including: ${upcomingTasks || 'none'}. Overall, ${data.metrics.completed} tasks are completed, ${data.metrics.inProgress} are in progress, and ${data.metrics.todo} remain in the backlog.`,
    keyInsights: [
      `${data.metrics.completed} tasks completed out of ${data.metrics.total} total tasks`,
      `${data.metrics.overdue} overdue tasks need attention`,
      `${data.metrics.upcomingDeadlines} deadlines approaching in the next 7 days`,
    ],
    risks: data.metrics.overdue > 0 ? [`${data.metrics.overdue} overdue tasks may impact project timeline`] : [],
    recommendations: [
      'Review and prioritize overdue tasks',
      'Ensure upcoming deadlines are on track',
      'Monitor team workload distribution',
    ],
    teamWorkload: `Team is working on ${data.metrics.total} tasks across ${Object.keys(data.metrics.byAssignee).length} assignees.`,
  };
}

function generateFallbackMonthlyContent(data: MonthlyReportData, projectName: string): ReportContent {
  const completionRate = data.metrics.total > 0 ? Math.round((data.metrics.completed / data.metrics.total) * 100) : 0;
  const completedTasks = data.month.completed.slice(0, 5).map(t => t.title).join(', ');
  const activeTasks = data.month.tasks.filter(t => t.status !== 'done').slice(0, 5).map(t => t.title).join(', ');
  
  return {
    executiveSummary: `Monthly report for ${projectName}: This month, we completed ${data.month.completed.length} tasks including: ${completedTasks || 'none'}. Currently, ${data.metrics.inProgress} tasks are in progress and ${data.metrics.todo} remain in the backlog. Key active tasks include: ${activeTasks || 'none'}. Overall completion rate is ${completionRate}%.`,
    keyInsights: [
      `Completion rate: ${completionRate}%`,
      `${data.metrics.inProgress} tasks currently in progress`,
      `${data.metrics.todo} tasks remaining in backlog`,
    ],
    risks: data.metrics.overdue > 0 ? [`${data.metrics.overdue} overdue tasks`] : [],
    recommendations: [
      'Continue focus on completing in-progress tasks',
      'Review and prioritize backlog items',
      'Plan for upcoming month priorities',
    ],
    teamWorkload: `Team completed ${data.metrics.completed} tasks this month.`,
  };
}

function generateFallbackForecastContent(data: ForecastReportData, projectName: string): ReportContent {
  const keyTasks = data.tasks.slice(0, 5).map(t => `${t.title} (${t.priority}${t.due_date ? `, due ${format(parseISO(t.due_date), 'MMM d')}` : ''})`).join(', ');
  
  return {
    executiveSummary: `Forecast for the next ${data.period.days} days: ${data.tasks.length} tasks are scheduled across ${Object.keys(data.byAssignee).length} team members. Key upcoming tasks include: ${keyTasks || 'none'}. Tasks are distributed across ${Object.keys(data.byPhase).length} phases, with ${data.metrics.inProgress} currently in progress and ${data.metrics.todo} in the backlog.`,
    keyInsights: [
      `${data.tasks.length} tasks scheduled for the next ${data.period.days} days`,
      `Tasks distributed across ${Object.keys(data.byPhase).length} phases`,
      `${Object.keys(data.byAssignee).length} team members have assigned tasks`,
    ],
    risks: [],
    recommendations: [
      'Monitor task progress closely',
      'Ensure team members have capacity for assigned tasks',
      'Review priorities and adjust if needed',
    ],
    teamWorkload: `Workload distributed across ${Object.keys(data.byAssignee).length} assignees.`,
  };
}

