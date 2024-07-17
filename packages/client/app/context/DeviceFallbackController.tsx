'use client';

import { PropsWithChildren, useEffect, useState } from 'react';
import DeviceFallbackPage from '../fallback/DeviceFallbackPage';

function DeviceFallbackController({ children }: PropsWithChildren<{}>) {
  const [showFallbackPage, setShowFallbackPage] = useState(false);

  useEffect(() => {
    setShowFallbackPage(window.matchMedia('(max-width: 1300px)').matches);

    const handleResize = () => {
      setShowFallbackPage(window.matchMedia('(max-width: 1300px)').matches);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setShowFallbackPage]);

  if (showFallbackPage) {
    return <DeviceFallbackPage />;
  }

  return <>{children}</>;
}

export default DeviceFallbackController;
