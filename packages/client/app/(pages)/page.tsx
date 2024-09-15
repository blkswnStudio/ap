'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Only on dev. We redirect directly to spot on production
    router.replace('/spot');
  }, [router]);
}
