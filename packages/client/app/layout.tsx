import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import { Metadata } from 'next/types';
import BaseThemeWrapper from './context/BaseThemeWrapper';
import './styles.css';

export const metadata: Metadata = {
  title: 'Apollon',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <main>
          <BaseThemeWrapper>{children}</BaseThemeWrapper>
        </main>
      </body>
    </html>
  );
}
