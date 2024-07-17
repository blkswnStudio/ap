'use client';

import DragHandleIcon from '@mui/icons-material/DragHandle';
import { MouseEventHandler, PropsWithChildren } from 'react';

function ResizeableDiv({ children }: PropsWithChildren<{}>) {
  const startResize: MouseEventHandler<HTMLDivElement> = () => {
    // Create the div dynamically
    // follows the mouse and across the Y axis
    const follower = document.createElement('div');
    follower.id = 'apollon-mouse-follower';

    document.body.appendChild(follower);

    // Create the div dynamically
    // ALoows to capture mouse events on top of the iframe
    const catchMouseOverlay = document.createElement('div');
    catchMouseOverlay.id = 'apollon-iframe-overlay';
    document.body.appendChild(catchMouseOverlay);

    // @ts-ignore
    catchMouseOverlay.addEventListener('mouseup', stopResize);

    // Update the div's position to follow the mouse
    catchMouseOverlay.addEventListener('mousemove', function (event) {
      const y = event.clientY; // Vertical position
      follower.style.top = y + 'px';
    });
  };

  const stopResize: MouseEventHandler<HTMLDivElement> = (event) => {
    const catchMouseOverlay = document.getElementById('apollon-mouse-follower')!;
    const follower = document.getElementById('apollon-iframe-overlay')!;

    // set css custom property globally to resize the TradingView
    const distanceToBottom = window.innerHeight - event.clientY;
    document.documentElement.style.setProperty('--apollon-drag-queen-height', distanceToBottom - 10 + 'px');

    // Destroy overlay and follower
    catchMouseOverlay.remove();
    follower.remove();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div onMouseDown={startResize}>
          <DragHandleIcon fontSize="small" sx={{ color: '#46434F', cursor: 'n-resize' }} />
        </div>
      </div>

      <div id="apollon-drag-queen">{children}</div>
    </>
  );
}

export default ResizeableDiv;
