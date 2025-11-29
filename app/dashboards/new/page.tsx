'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to edit page with 'new' ID
    router.replace('/dashboards/new/edit');
  }, [router]);

  return null;
}

