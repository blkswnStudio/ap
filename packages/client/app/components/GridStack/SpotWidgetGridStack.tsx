'use client';

import { GridStack } from 'gridstack';
import { PropsWithChildren, useEffect } from 'react';
import { WIDGET_HEIGHTS } from '../../utils/constants';

const SPOT_PAGE_GRID_STATE_KEY = 'apollon-spot-page-grid-state';

function SpotWidgetGridStack({ children }: PropsWithChildren<{}>) {
  useEffect(() => {
    const grid = GridStack.init({
      draggable: {
        handle: '.grid-stack-apollo-drag-handle',
      },
      cellHeight: 10,
      disableResize: true,
      animate: false,
    });

    // Load last saved grid state and change the order of the widgets accordingly
    const previousGridState = JSON.parse(localStorage.getItem(SPOT_PAGE_GRID_STATE_KEY) ?? '[]');
    if (previousGridState.length === 3) {
      grid.batchUpdate(true);
      grid.getGridItems().forEach((widget) => {
        const state = previousGridState.find((state: { id: string; y: number }) => state.id === widget.id);
        grid.update(widget, { y: state.y });
      });
      grid.batchUpdate(false);
    }

    // Save grid state to local storage on unmount
    grid.on('change', () => {
      const gridSavePoint: { id: string; y: number }[] = [];
      let y = 0;
      grid.save(false, false, ({ el }) => {
        gridSavePoint.push({ id: el!.id, y: y });
        // @ts-ignore
        y += WIDGET_HEIGHTS[el!.id];
      });
      localStorage.setItem(SPOT_PAGE_GRID_STATE_KEY, JSON.stringify(gridSavePoint));
    });

    setTimeout(() => {
      grid.setAnimation(true);
    }, 1000);
  }, []);

  return (
    <div className="grid-stack" style={{ display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}

export default SpotWidgetGridStack;
