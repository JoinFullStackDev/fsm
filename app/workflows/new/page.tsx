'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import { useNotification } from '@/lib/hooks/useNotification';

export default function NewWorkflowPage() {
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[NewWorkflowPage] Submitting workflow data:', data);

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      console.log('[NewWorkflowPage] Response status:', response.status);

      if (!response.ok) {
        const result = await response.json();
        console.error('[NewWorkflowPage] Error response:', result);
        
        // Show detailed error if available
        let errorMessage = result.error || 'Failed to create workflow';
        if (result.errors && Array.isArray(result.errors)) {
          errorMessage = result.errors.join(', ');
        }
        
        showError(errorMessage);
        setError(errorMessage);
        return;
      }

      const workflow = await response.json();
      console.log('[NewWorkflowPage] Created workflow:', workflow);
      
      showSuccess('Workflow created successfully!');
      
      // Small delay to show the success message before navigating
      setTimeout(() => {
        router.push(`/workflows/${workflow.id}`);
      }, 500);
    } catch (err) {
      console.error('[NewWorkflowPage] Submit error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to create workflow';
      showError(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorkflowBuilder
      mode="create"
      onSubmit={handleSubmit}
      onCancel={() => router.push('/workflows')}
      loading={loading}
      error={error}
    />
  );
}

