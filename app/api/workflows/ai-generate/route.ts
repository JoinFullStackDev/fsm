/**
 * AI Workflow Generator API
 * POST /api/workflows/ai-generate
 * 
 * Streams AI-generated workflow configurations based on natural language descriptions.
 */

import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getGeminiApiKey } from '@/lib/utils/geminiConfig';
import logger from '@/lib/utils/logger';

const WORKFLOW_SYSTEM_PROMPT = `You are an AI workflow builder assistant. Your job is to help users create automation workflows by converting their natural language descriptions into structured workflow configurations.

**AVAILABLE WORKFLOW COMPONENTS:**

1. **TRIGGERS** (what starts the workflow):
   - \`event\`: Triggered by system events. Available event types:
     - task_created, task_updated, task_completed, task_deleted
     - contact_created, contact_updated
     - opportunity_created, opportunity_status_changed, opportunity_won, opportunity_lost
     - project_created, project_status_changed, project_completed
     - comment_added, file_uploaded
   - \`schedule\`: Runs on a schedule
     - schedule_type: 'daily' | 'weekly' | 'monthly'
     - time: HH:MM format (e.g., "09:00")
     - day_of_week: 0-6 for weekly (0 = Sunday)
     - day_of_month: 1-31 for monthly
     - timezone: e.g., "America/New_York"
   - \`webhook\`: Triggered by external webhook calls
   - \`manual\`: Manually triggered by users

2. **ACTIONS** (what the workflow does):
   - \`send_email\`: Send an email
     - to: recipient email or {{contact.email}}
     - subject: email subject
     - body_html: HTML email body
     - cc, bcc: optional
   - \`send_notification\`: Send in-app notification
     - user_field: field path to user ID (e.g., "task.assignee_id")
     - title: notification title
     - message: notification body
     - link: optional URL
   - \`send_slack\`: Send Slack message
     - channel: channel name (#general) or ID
     - message: message text
     - notify_channel: boolean to @channel
     - use_blocks: boolean for rich formatting
   - \`create_slack_channel\`: Create a new Slack channel
     - channel_name: name for the channel (supports {{variables}}, will be auto-formatted)
     - is_private: boolean (default: false for public channel)
     - description: optional channel topic/description
     - initial_message: optional message to post after creation
   - \`create_task\`: Create a new task
     - project_field: field path to project ID
     - title: task title
     - description: task description
     - assignee_field: field path to assignee user ID
     - priority: 'low' | 'medium' | 'high' | 'critical'
     - status: 'todo' | 'in_progress' | 'done'
   - \`update_task\`: Update existing task
     - task_field: field path to task ID
     - updates: { status, priority, assignee_id, etc. }
   - \`create_project\`: Create a new project
     - name: project name
     - description: project description
     - company_field: field path to company ID
     - template_id: optional template ID
   - \`webhook_call\`: Call external webhook
     - url: webhook URL
     - method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
     - headers: optional headers object
     - body_template: JSON body template
   - \`ai_generate\`: Generate AI content
     - prompt_template: prompt with {{variables}}
     - output_field: field name to store result

3. **CONDITIONS** (branch logic):
   - field: The field path to check (e.g., "task.priority", "contact.status")
   - operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_empty' | 'is_not_empty'
   - value: The value to compare against

4. **DELAYS** (wait before continuing):
   - delay_type: 'minutes' | 'hours' | 'days'
   - delay_value: number (e.g., 2 for 2 hours)

**TEMPLATE VARIABLES:**
Use {{variable.path}} syntax for dynamic values:
- {{contact.email}}, {{contact.name}}, {{contact.first_name}}, {{contact.last_name}}
- {{task.title}}, {{task.description}}, {{task.priority}}, {{task.assignee_id}}
- {{opportunity.name}}, {{opportunity.value}}, {{opportunity.status}}
- {{project.name}}, {{project.id}}, {{project.status}}
- {{trigger.entity_id}}, {{trigger.event_type}}

**RESPONSE FORMAT:**
Always respond conversationally first, explaining what you understood and what workflow you're creating.
Then include a JSON workflow configuration in a code block tagged with \`\`\`workflow

Example response:
"I'll create a workflow that sends an email notification when a task is completed. This workflow will:
1. Trigger when any task is marked as completed
2. Send an email to the task assignee with details about the completed task

\`\`\`workflow
{
  "name": "Task Completion Notification",
  "description": "Sends email when tasks are completed",
  "trigger_type": "event",
  "trigger_config": {
    "event_types": ["task_completed"]
  },
  "steps": [
    {
      "step_type": "action",
      "action_type": "send_email",
      "config": {
        "to": "{{task.assignee_email}}",
        "subject": "Task Completed: {{task.title}}",
        "body_html": "<p>The task <strong>{{task.title}}</strong> has been completed.</p><p>Description: {{task.description}}</p>"
      }
    }
  ]
}
\`\`\`"

**GUIDELINES:**
- Be helpful and ask clarifying questions if the request is ambiguous
- Always provide valid workflow JSON that matches the schema
- Explain what each step does in plain language
- If modifying an existing workflow, explain the changes
- Use meaningful names for workflows
- Include appropriate descriptions`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { prompt, conversationHistory = [], currentWorkflow } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key using the shared helper (checks env vars first, then admin_settings)
    const apiKey = await getGeminiApiKey(supabase);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI API key not configured. Please configure Gemini API key in environment variables or admin settings.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info('[Workflow AI] API key found, length:', apiKey.length);

    // Build conversation context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\n**CONVERSATION HISTORY:**\n' +
        conversationHistory.map((m: { role: string; content: string }) =>
          `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n\n');
    }

    let currentWorkflowContext = '';
    if (currentWorkflow) {
      currentWorkflowContext = '\n\n**CURRENT WORKFLOW (user is editing this):**\n' +
        JSON.stringify(currentWorkflow, null, 2);
    }

    const fullPrompt = `${WORKFLOW_SYSTEM_PROMPT}${conversationContext}${currentWorkflowContext}\n\nUser: ${prompt}`;

    // Clean and validate API key
    const cleanedKey = String(apiKey).trim().replace(/^["']|["']$/g, '');

    // Create Gemini client
    let client: GoogleGenAI;
    try {
      client = new GoogleGenAI({ apiKey: cleanedKey });
    } catch (error) {
      logger.error('[Workflow AI] Failed to initialize Gemini client:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize AI client' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          logger.info('[Workflow AI] Starting stream generation');

          const result = await client.models.generateContentStream({
            model: 'gemini-2.0-flash-exp',
            contents: fullPrompt,
          });

          let fullContent = '';

          for await (const chunk of result) {
            const text = chunk.text || '';
            if (text) {
              fullContent += text;
              const data = JSON.stringify({ text });
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
            }
          }

          // Parse workflow from response
          const workflowMatch = fullContent.match(/```workflow\n([\s\S]*?)\n```/);
          if (workflowMatch) {
            try {
              const workflow = JSON.parse(workflowMatch[1]);
              const workflowData = JSON.stringify({ workflow });
              controller.enqueue(new TextEncoder().encode(`data: ${workflowData}\n\n`));
              logger.info('[Workflow AI] Successfully parsed workflow JSON');
            } catch (parseError) {
              logger.error('[Workflow AI] Failed to parse workflow JSON:', parseError);
              // Don't fail the whole request, just log the error
            }
          }

          controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
          controller.close();

          logger.info('[Workflow AI] Stream completed successfully');
        } catch (error) {
          logger.error('[Workflow AI] Stream error:', error);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorData = JSON.stringify({ error: errorMessage });
          controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
          
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('[Workflow AI] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate workflow' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

