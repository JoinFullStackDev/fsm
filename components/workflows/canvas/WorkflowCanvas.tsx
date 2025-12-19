'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, IconButton, Tooltip, Collapse } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Dashboard as DashboardIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import { nodeTypes } from './utils/nodeTypes';
import NodePalette from './NodePalette';
import NodeConfigDrawer from './NodeConfigDrawer';
import type { WorkflowStep } from '@/types/workflows';
import { convertToNodes } from './utils/convertToNodes';
import { convertToSteps } from './utils/convertToSteps';

interface WorkflowCanvasProps {
  initialSteps?: WorkflowStep[];
  onChange?: (steps: any[]) => void;
}

export default function WorkflowCanvas({ initialSteps = [], onChange }: WorkflowCanvasProps) {
  const theme = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<Record<string, unknown>>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<Record<string, unknown>>>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Initialize nodes and edges from initial steps (only once)
  useEffect(() => {
    console.log('[WorkflowCanvas] useEffect - initialized:', initialized, 'initialSteps.length:', initialSteps.length);
    console.log('[WorkflowCanvas] initialSteps:', JSON.stringify(initialSteps, null, 2));
    
    if (!initialized) {
      if (initialSteps.length > 0) {
        console.log('[WorkflowCanvas] Converting initialSteps to nodes...');
        const { nodes: initialNodes, edges: initialEdges } = convertToNodes(initialSteps);
        console.log('[WorkflowCanvas] Created nodes:', initialNodes.length, 'edges:', initialEdges.length);
        console.log('[WorkflowCanvas] Nodes:', JSON.stringify(initialNodes, null, 2));
        setNodes(initialNodes);
        setEdges(initialEdges);
      } else {
        // Add a default trigger node if no steps exist
        const triggerNode: Node = {
          id: 'trigger-0',
          type: 'trigger',
          position: { x: 250, y: 50 },
          data: {
            label: 'Start Workflow',
            triggerType: 'event',
            triggerConfig: {},
            stepData: {
              step_type: 'action',
              config: {},
            },
          },
        };
        setNodes([triggerNode]);
      }
      setInitialized(true);
    }
  }, [initialized, initialSteps, setNodes, setEdges]);

  // Notify parent of changes (debounced to avoid loops)
  useEffect(() => {
    if (!initialized || nodes.length === 0) return;

    const timer = setTimeout(() => {
      if (onChange) {
        console.log('[WorkflowCanvas] Converting nodes to steps:', {
          nodesCount: nodes.length,
          edgesCount: edges.length,
          nodeTypes: nodes.map(n => ({ id: n.id, type: n.type })),
        });
        const steps = convertToSteps(nodes, edges);
        console.log('[WorkflowCanvas] Converted steps:', JSON.stringify(steps, null, 2));
        onChange(steps);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [nodes, edges, onChange, initialized]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setDrawerOpen(false);
  }, []);

  const handleNodeUpdate = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...newData },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setDrawerOpen(false);
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const handleAddNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const newNodeId = `node-${Date.now()}`;
      
      // Calculate position - place below existing nodes
      let yPosition = 50;
      if (nodes.length > 0) {
        const maxY = Math.max(...nodes.map(n => n.position?.y || 0));
        yPosition = maxY + 150;
      }
      
      const newPosition = position || { x: 250, y: yPosition };

      const newNode: Node<Record<string, unknown>> = {
        id: newNodeId,
        type,
        position: newPosition,
        data: {
          label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          stepData: {
            step_type: type === 'trigger' ? 'action' : type,
            config: {},
          },
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Auto-connect from last node if it exists and new node is not a trigger
      if (nodes.length > 0 && type !== 'trigger') {
        const lastNode = nodes[nodes.length - 1];
        const newEdge: Edge<Record<string, unknown>> = {
          id: `edge-${lastNode.id}-${newNodeId}`,
          source: lastNode.id,
          target: newNodeId,
          type: 'smoothstep',
        };
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [nodes, setNodes, setEdges]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
      }}
    >
      {/* Collapsible Node Palette */}
      <Box sx={{ display: 'flex', height: '100%' }}>
        <Collapse in={paletteOpen} orientation="horizontal" timeout={200}>
          <Box sx={{ display: 'flex', height: '100%' }}>
            <NodePalette onAddNode={handleAddNode} />
          </Box>
        </Collapse>
        
        {/* Toggle Button */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 1,
            px: 0.5,
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Tooltip title={paletteOpen ? 'Hide Node Palette' : 'Show Node Palette'} placement="right">
            <IconButton
              size="small"
              onClick={() => setPaletteOpen(!paletteOpen)}
              sx={{
                backgroundColor: paletteOpen ? theme.palette.action.selected : 'transparent',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              {paletteOpen ? (
                <ChevronLeftIcon fontSize="small" />
              ) : (
                <DashboardIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main canvas */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange}
          onEdgesChange={onEdgesChange as OnEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background
            color={theme.palette.mode === 'dark' ? '#555' : '#aaa'}
            gap={16}
          />
          <Controls />
          <MiniMap
            style={{
              backgroundColor: theme.palette.background.paper,
            }}
            maskColor={theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)'}
          />
        </ReactFlow>
      </Box>

      {/* Right drawer - Node configuration */}
      <NodeConfigDrawer
        open={drawerOpen}
        node={selectedNode}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedNode(null);
        }}
        onUpdate={handleNodeUpdate}
        onDelete={handleNodeDelete}
      />
    </Box>
  );
}

