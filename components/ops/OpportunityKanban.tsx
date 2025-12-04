'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Card,
  CardContent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Visibility as VisibilityIcon, Edit as EditIcon } from '@mui/icons-material';
import type { OpportunityWithCompany, OpportunityStatus } from '@/types/ops';

interface OpportunityKanbanProps {
  opportunities: OpportunityWithCompany[];
  onStatusChange: (opportunityId: string, newStatus: OpportunityStatus) => Promise<void>;
  onView: (opportunity: OpportunityWithCompany) => void;
  onEdit: (opportunity: OpportunityWithCompany) => void;
}

const STATUSES = [
  { id: 'new', label: 'New', color: '#00BCD4' },
  { id: 'working', label: 'Working', color: '#2196F3' },
  { id: 'negotiation', label: 'Negotiation', color: '#FF9800' },
  { id: 'pending', label: 'Pending', color: '#9C27B0' },
  { id: 'converted', label: 'Converted', color: '#4CAF50' },
  { id: 'lost', label: 'Lost', color: '#F44336' },
];

interface OpportunityCardProps {
  opportunity: OpportunityWithCompany;
  onView: (opportunity: OpportunityWithCompany) => void;
  onEdit: (opportunity: OpportunityWithCompany) => void;
  isDragging?: boolean;
}

function OpportunityCard({ opportunity, onView, onEdit, isDragging }: OpportunityCardProps) {
  const theme = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: 1.5,
        cursor: 'grab',
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        '&:hover': {
          borderColor: theme.palette.text.secondary,
          boxShadow: `0 4px 12px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`,
        },
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              flex: 1,
              mr: 1,
            }}
          >
            {opportunity.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onView(opportunity);
              }}
              sx={{ 
                color: theme.palette.text.secondary,
                p: 0.5,
                '&:hover': { color: theme.palette.text.primary },
              }}
            >
              <VisibilityIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(opportunity);
              }}
              sx={{ 
                color: theme.palette.text.secondary,
                p: 0.5,
                '&:hover': { color: theme.palette.text.primary },
              }}
            >
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
        
        {opportunity.company?.name && (
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              display: 'block',
              mb: 1,
            }}
          >
            {opportunity.company.name}
          </Typography>
        )}
        
        {opportunity.value && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.primary.main,
            }}
          >
            ${opportunity.value.toLocaleString()}
          </Typography>
        )}
        
        {opportunity.source && (
          <Chip
            label={opportunity.source}
            size="small"
            sx={{
              mt: 1,
              height: 20,
              fontSize: '0.7rem',
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.secondary,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DragOverlayCard({ opportunity, onView, onEdit }: OpportunityCardProps) {
  const theme = useTheme();
  
  return (
    <Card
      sx={{
        cursor: 'grabbing',
        backgroundColor: theme.palette.background.paper,
        border: `2px solid ${theme.palette.primary.main}`,
        boxShadow: `0 8px 24px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.2)'}`,
        transform: 'rotate(3deg)',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 1,
          }}
        >
          {opportunity.name}
        </Typography>
        
        {opportunity.company?.name && (
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              display: 'block',
              mb: 1,
            }}
          >
            {opportunity.company.name}
          </Typography>
        )}
        
        {opportunity.value && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.primary.main,
            }}
          >
            ${opportunity.value.toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  status: { id: string; label: string; color: string };
  opportunities: OpportunityWithCompany[];
  onView: (opportunity: OpportunityWithCompany) => void;
  onEdit: (opportunity: OpportunityWithCompany) => void;
  activeId: string | null;
}

function KanbanColumn({ status, opportunities, onView, onEdit, activeId }: KanbanColumnProps) {
  const theme = useTheme();
  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.value || 0), 0);
  
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        flex: '1 1 0',
        minWidth: 280,
        maxWidth: 350,
        backgroundColor: isOver 
          ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
          : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
        border: `1px solid ${isOver ? status.color : theme.palette.divider}`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 280px)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: status.color + '15',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: status.color,
              }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              {status.label}
            </Typography>
          </Box>
          <Chip
            label={opportunities.length}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.75rem',
              backgroundColor: status.color + '30',
              color: status.color,
              fontWeight: 600,
            }}
          />
        </Box>
        {totalValue > 0 && (
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            ${totalValue.toLocaleString()} total
          </Typography>
        )}
      </Box>

      {/* Column Content */}
      <Box
        sx={{
          p: 1.5,
          flex: 1,
          overflowY: 'auto',
          minHeight: 200,
        }}
      >
        <SortableContext
          items={opportunities.map(o => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              onView={onView}
              onEdit={onEdit}
              isDragging={activeId === opportunity.id}
            />
          ))}
        </SortableContext>
        
        {opportunities.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 150,
              border: `2px dashed ${isOver ? status.color : theme.palette.divider}`,
              borderRadius: 1,
              transition: 'all 0.2s ease',
            }}
          >
            <Typography variant="body2" sx={{ color: isOver ? status.color : theme.palette.text.secondary }}>
              Drop here
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default function OpportunityKanban({
  opportunities,
  onStatusChange,
  onView,
  onEdit,
}: OpportunityKanbanProps) {
  const theme = useTheme();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeOpportunity, setActiveOpportunity] = useState<OpportunityWithCompany | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const getOpportunitiesByStatus = (status: string) => {
    return opportunities.filter((opp) => opp.status === status);
  };

  const findContainer = (id: string) => {
    // Check if id is a status (column)
    if (STATUSES.find(s => s.id === id)) {
      return id;
    }
    
    // Find which status contains this opportunity
    const opportunity = opportunities.find(o => o.id === id);
    return opportunity?.status || null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const opportunity = opportunities.find(o => o.id === active.id);
    setActiveOpportunity(opportunity || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Visual feedback could be added here if needed
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveOpportunity(null);

    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    let overContainer = findContainer(over.id as string);

    // If dropped over another card, get its container
    if (!STATUSES.find(s => s.id === over.id)) {
      const overOpportunity = opportunities.find(o => o.id === over.id);
      overContainer = overOpportunity?.status || null;
    } else {
      overContainer = over.id as string;
    }

    if (activeContainer && overContainer && activeContainer !== overContainer) {
      // Status changed - call the API
      await onStatusChange(active.id as string, overContainer as OpportunityStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: theme.palette.action.hover,
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.text.secondary,
            borderRadius: 4,
            '&:hover': {
              backgroundColor: theme.palette.text.primary,
            },
          },
        }}
      >
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            opportunities={getOpportunitiesByStatus(status.id)}
            onView={onView}
            onEdit={onEdit}
            activeId={activeId}
          />
        ))}
      </Box>
      
      <DragOverlay>
        {activeOpportunity ? (
          <DragOverlayCard
            opportunity={activeOpportunity}
            onView={onView}
            onEdit={onEdit}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

