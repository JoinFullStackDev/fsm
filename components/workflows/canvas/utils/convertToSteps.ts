import type { Node, Edge } from '@xyflow/react';
import type { WorkflowStepInput } from '@/types/workflows';

/**
 * Convert React Flow nodes and edges back to workflow steps for API
 * Note: Trigger nodes are handled separately and not included in steps
 */
export function convertToSteps(nodes: Node[], edges: Edge[]): WorkflowStepInput[] {
  console.log('[convertToSteps] ========== CONVERT DEBUG ==========');
  console.log('[convertToSteps] Input nodes count:', nodes.length);
  console.log('[convertToSteps] Input edges count:', edges.length);
  
  nodes.forEach((n, i) => {
    const data = n.data as Record<string, unknown>;
    console.log(`[convertToSteps] Node ${i}:`, {
      id: n.id,
      type: n.type,
      hasActionType: !!data.actionType,
      hasStepData: !!data.stepData,
      stepDataActionType: (data.stepData as any)?.action_type,
    });
  });
  
  // Sort nodes by their visual flow order
  const sortedNodes = topologicalSort(nodes, edges);
  
  console.log('[convertToSteps] After topologicalSort:', sortedNodes.length, 'nodes');

  const steps: WorkflowStepInput[] = [];

  sortedNodes.forEach((node, index) => {
    const data = node.data as Record<string, unknown>;
    const stepData = data.stepData as Record<string, unknown> | undefined;

    console.log(`[convertToSteps] Processing node ${index}:`, {
      nodeId: node.id,
      nodeType: node.type,
      dataActionType: data.actionType,
      stepDataActionType: (stepData as any)?.action_type,
      stepDataStepType: (stepData as any)?.step_type,
    });

    // Skip trigger nodes - they're not workflow steps, they're workflow metadata
    if (node.type === 'trigger') {
      // Store trigger config in a special step that will be extracted later
      console.log(`[convertToSteps] -> Creating trigger pseudo-step`);
      steps.push({
        step_type: 'action',
        config: {
          trigger_type: data.triggerType || 'event',
          trigger_config: data.triggerConfig || {},
        },
      });
      return;
    }

    // Determine step type
    let stepType: 'action' | 'condition' | 'delay' = 'action';
    if (node.type === 'condition') {
      stepType = 'condition';
    } else if (node.type === 'delay') {
      stepType = 'delay';
    } else if (node.type === 'action') {
      stepType = 'action';
    }

    const step: WorkflowStepInput = {
      step_type: stepType,
      config: stepData?.config as Record<string, unknown> || {},
    };

    // Add action type for action steps
    // Check data.actionType first (from node config), then fall back to stepData.action_type (from original step)
    if (stepType === 'action') {
      const actionType = data.actionType || (stepData as any)?.action_type;
      if (actionType) {
        step.action_type = actionType as any;
      }
      console.log(`[convertToSteps] -> Action step, actionType:`, actionType);
    }

    // Handle condition else_goto_step
    if (stepType === 'condition') {
      // Find false edge
      const falseEdge = edges.find(
        (e) => e.source === node.id && e.sourceHandle === 'false'
      );

      if (falseEdge) {
        // Count non-trigger nodes before target to get correct index
        const nonTriggerNodes = sortedNodes.filter(n => n.type !== 'trigger');
        const targetIndex = nonTriggerNodes.findIndex((n) => n.id === falseEdge.target);
        if (targetIndex !== -1) {
          step.else_goto_step = targetIndex;
        }
      }
    }

    steps.push(step);
  });

  console.log('[convertToSteps] Final steps:', JSON.stringify(steps, null, 2));
  return steps;
}

/**
 * Sort nodes in topological order based on edges
 */
function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  // Build adjacency list
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((node) => {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    const neighbors = adjList.get(edge.source) || [];
    neighbors.push(edge.target);
    adjList.set(edge.source, neighbors);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Find start nodes (in-degree 0)
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  // If no start node found, use nodes in order
  if (queue.length === 0 && nodes.length > 0) {
    return nodes;
  }

  // Kahn's algorithm for topological sort
  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjList.get(current) || [];
    neighbors.forEach((neighbor) => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Map sorted IDs back to nodes
  return sorted.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}

