import { PropsWithChildren } from 'react';

function PageLayout({ children }: PropsWithChildren<{}>) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20px' }}>
      <div style={{ width: '1350px' }}>{children}</div>
    </div>
  );
}

export default PageLayout;
