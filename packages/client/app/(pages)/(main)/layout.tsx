import PlausibleProvider from 'next-plausible';
import ContextWrapper from '../../context/ContextWrapper';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlausibleProvider domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? ''}>
      <ContextWrapper>
        <main>{children}</main>
      </ContextWrapper>
    </PlausibleProvider>
  );
}
