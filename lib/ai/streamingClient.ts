/**
 * Streaming AI Client
 * Handles streaming responses from Gemini API
 */

import { GoogleGenAI } from '@google/genai';
import logger from '@/lib/utils/logger';

export type StreamingModel = 'gemini-2.0-flash-exp' | 'gemini-1.5-flash' | 'gemini-2.5-flash';

/**
 * Stream response from Gemini API
 * Returns a ReadableStream formatted for Server-Sent Events
 */
export async function streamGeminiResponse(
  prompt: string,
  apiKey: string,
  model: StreamingModel = 'gemini-2.0-flash-exp'
): Promise<ReadableStream> {
  // Validate API key
  if (!apiKey) {
    throw new Error('Gemini API key is required for streaming');
  }

  const cleanedKey = String(apiKey).trim().replace(/^["']|["']$/g, '');

  if (!cleanedKey || cleanedKey.length < 20) {
    throw new Error('Invalid API key format');
  }

  // Create Gemini client
  let client: GoogleGenAI;
  try {
    client = new GoogleGenAI({ apiKey: cleanedKey });
  } catch (error) {
    logger.error('[Streaming Client] Failed to initialize Gemini client:', error);
    throw new Error('Failed to initialize AI client');
  }

  // Create readable stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        logger.info('[Streaming Client] Starting stream:', { model });

        // Generate content stream using the SDK
        const result = await client.models.generateContentStream({
          model,
          contents: prompt,
        });

        // Stream chunks - result is an async generator
        for await (const chunk of result) {
          const text = chunk.text || '';
          
          if (text) {
            // Format as Server-Sent Event
            const data = JSON.stringify({ text });
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          }
        }

        // Send completion signal
        controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
        controller.close();

        logger.info('[Streaming Client] Stream completed successfully');
      } catch (error) {
        logger.error('[Streaming Client] Stream error:', error);
        
        // Send error event
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorData = JSON.stringify({ error: errorMessage });
        controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
        
        controller.close();
      }
    },
  });

  return stream;
}

/**
 * Build system prompt with context for AI assistant
 */
export function buildSystemPrompt(contextText: string, conversationHistory: string = ''): string {
  return `You are an AI product management assistant for the FullStack Method. You help teams with product clarity, epic decomposition, and context management.

**YOUR CAPABILITIES:**
1. Answer questions about the project, phases, tasks, and workspace
2. Analyze clarity specs and suggest improvements
3. Help prioritize work and identify blockers
4. Create tasks WITH PROPER ASSIGNEE RECOMMENDATIONS based on team roles and capacity
5. Reference SOW objectives and deliverables when planning work
6. Log decisions and track debt (with user confirmation)
7. Provide product management best practices and guidance

**CURRENT PROJECT CONTEXT:**
${contextText}

${conversationHistory ? `**CONVERSATION HISTORY:**\n${conversationHistory}\n` : ''}

**CONVERSATION GUIDELINES:**
- Be concise but thorough - provide actionable insights
- Reference specific project data when relevant (tasks, phases, specs)
- Suggest next steps and improvements
- Use markdown for formatting (headers, lists, code blocks, bold)
- When code is relevant, use proper syntax highlighting

**ACTION CAPABILITIES:**
You can suggest actions that users can confirm:
- CREATE_TASK: Suggest creating a new project task (with assignee recommendation)
- LOG_DECISION: Suggest documenting an important decision
- LOG_DEBT: Suggest tracking technical/product debt
- UPDATE_SPEC: Suggest improvements to clarity spec

**TASK ASSIGNMENT GUIDELINES:**
When suggesting task creation, you SHOULD recommend an assignee based on:
- Role match (designers for UI, engineers for backend, PMs for planning)
- Current workload (prefer members with fewer in-progress tasks)
- Task type and complexity
- SOW role assignments if available

ALWAYS include assignee_id in create_task actions when you can identify the right person.

When suggesting an action, use one of these formats:

**CREATE_TASK** - Create a new project task:
\`\`\`action
{
  "type": "create_task",
  "data": {
    "title": "Task title (required)",
    "description": "Task description",
    "priority": "high|medium|low",
    "assignee_id": "user-uuid-here",
    "estimated_hours": 8,
    "tags": ["tag1", "tag2"]
  }
}
\`\`\`

**LOG_DECISION** - Document an important decision:
\`\`\`action
{
  "type": "log_decision",
  "data": {
    "title": "Decision title (required)",
    "decision": "The decision that was made (required)",
    "context": "Background and circumstances",
    "rationale": "Why this decision was made"
  }
}
\`\`\`

**LOG_DEBT** - Track technical/product/design debt:
\`\`\`action
{
  "type": "log_debt",
  "data": {
    "title": "Debt title (required)",
    "description": "What the debt is and its impact (required)",
    "debt_type": "technical|product|design|operational (required)",
    "severity": "low|medium|high|critical"
  }
}
\`\`\`

**UPDATE_SPEC** - Suggest improvements to a clarity spec (only when spec_id is known):
\`\`\`action
{
  "type": "update_spec",
  "data": {
    "spec_id": "the-spec-uuid (required)",
    "updates": {
      "problem_statement": "Updated problem statement",
      "success_criteria": "Updated success criteria"
    }
  }
}
\`\`\`

The user will confirm before any action is taken.

**IMPORTANT:** Focus on helping the team make better product decisions, not just answering questions. Proactively suggest improvements and identify risks.`;
}
