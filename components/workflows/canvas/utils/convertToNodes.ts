import type { Node, Edge } from '@xyflow/react';
import type { WorkflowStep } from '@/types/workflows';

/**
 * Convert workflow steps from API format to React Flow nodes and edges
 */
export function convertToNodes(steps: WorkflowStep[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const VERTICAL_SPACING = 150;
  const HORIZONTAL_SPACING = 300;

  steps.forEach((step, index) => {
    const baseY = index * VERTICAL_SPACING;

    // Determine node type
    let nodeType = 'action';
    if (step.step_type === 'condition') {
      nodeType = 'condition';
    } else if (step.step_type === 'delay') {
      nodeType = 'delay';
    } else if (index === 0) {
      // First step could be a trigger
      nodeType = 'trigger';
    }

    // Extract data based on step type
    const nodeData: Record<string, unknown> = {
      label: getStepLabel(step),
      stepIndex: index,
      stepData: step,
    };

    // Extract trigger configuration for trigger nodes (index 0)
    if (index === 0 && step.config) {
      const config = step.config as unknown as Record<string, unknown>;
      if (config.trigger_type) {
        nodeData.triggerType = config.trigger_type;
        nodeData.triggerConfig = config.trigger_config || {};
        nodeData.label = 'Start Workflow';
      }
    }

    if (step.step_type === 'action' && step.action_type) {
      nodeData.actionType = step.action_type;
    }

    if (step.step_type === 'condition' && step.config) {
      const config = step.config as unknown as Record<string, unknown>;
      nodeData.field = config.field;
      nodeData.operator = config.operator;
      nodeData.value = config.value;
    }

    if (step.step_type === 'delay' && step.config) {
      const config = step.config as unknown as Record<string, unknown>;
      nodeData.delayValue = config.delay_value;
      nodeData.delayType = config.delay_type;
    }

    // Create node
    nodes.push({
      id: `step-${index}`,
      type: nodeType,
      position: { x: 250, y: baseY },
      data: nodeData,
    });

    // Create edges
    if (index > 0) {
      // Connect from previous step
      edges.push({
        id: `edge-${index - 1}-${index}`,
        source: `step-${index - 1}`,
        target: `step-${index}`,
        type: 'smoothstep',
      });
    }

    // Handle condition branches
    if (step.step_type === 'condition' && step.else_goto_step !== undefined) {
      // True branch (next step)
      if (index + 1 < steps.length) {
        edges.push({
          id: `edge-${index}-${index + 1}-true`,
          source: `step-${index}`,
          sourceHandle: 'true',
          target: `step-${index + 1}`,
          type: 'smoothstep',
          label: 'True',
          style: { stroke: '#4caf50' },
        });
      }

      // False branch (else_goto_step)
      if (step.else_goto_step !== null && step.else_goto_step < steps.length) {
        edges.push({
          id: `edge-${index}-${step.else_goto_step}-false`,
          source: `step-${index}`,
          sourceHandle: 'false',
          target: `step-${step.else_goto_step}`,
          type: 'smoothstep',
          label: 'False',
          style: { stroke: '#f44336' },
        });

        // Adjust false branch node position to the right
        const targetNode = nodes.find((n) => n.id === `step-${step.else_goto_step}`);
        if (targetNode) {
          targetNode.position.x += HORIZONTAL_SPACING;
        }
      }
    }
  });

  return { nodes, edges };
}

function getStepLabel(step: WorkflowStep): string {
  if (step.step_type === 'action' && step.action_type) {
    return formatActionType(step.action_type);
  }
  if (step.step_type === 'condition') {
    return 'Condition';
  }
  if (step.step_type === 'delay') {
    return 'Delay';
  }
  return 'Step';
}

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

