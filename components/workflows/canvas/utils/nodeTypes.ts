import type { NodeTypes } from '@xyflow/react';
import TriggerNode from '../nodes/TriggerNode';
import ActionNode from '../nodes/ActionNode';
import ConditionNode from '../nodes/ConditionNode';
import DelayNode from '../nodes/DelayNode';

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};

