'use client';

import { SxProps } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PropsWithChildren } from 'react';
import DiamondIcon from '../Icons/DiamondIcon';

type Props = {
  title: string;
  isDraggable?: {
    id: string;
    y: string;
    gsWidth: string;
    gsHeight: string;
  };
  noPadding?: boolean;
  borderRadius?: boolean;
  border?: 'full' | 'bottom';
  icon?: 'green' | 'neutral';
  headBorder?: 'full' | 'bottom';
  underline?: boolean;
  sx?: SxProps;
};

function FeatureBox({
  title,
  isDraggable = undefined,
  noPadding = false,
  headBorder = undefined,
  borderRadius = false,
  border = undefined,
  icon = 'neutral',
  sx = {},
  children,
}: PropsWithChildren<Props>) {
  return (
    <div
      className={isDraggable ? 'grid-stack-item' : ''}
      id={isDraggable?.id}
      gs-y={isDraggable?.y}
      gs-w={isDraggable?.gsWidth}
      gs-h={isDraggable?.gsHeight}
    >
      <Box
        sx={{
          border: border === 'full' ? '1px solid' : 'none',
          borderBottom: border ? '1px solid' : 'none',
          borderColor: 'background.paper',
          borderRadius: borderRadius ? 1 : 0,
          width: '100%',
          p: noPadding ? 0 : 2,
          ...sx,
        }}
      >
        <div className={isDraggable ? 'grid-stack-item-content' : ''}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pb: 1.25,
              border: headBorder === 'full' ? '1px solid' : 'none',
              borderBottom: headBorder === 'bottom' || headBorder === 'full' ? '1px solid' : 'none',
              borderColor: headBorder ? 'background.paper' : 'none',
              pt: noPadding ? 2 : 0,
              pl: noPadding ? 2 : 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {icon === 'green' ? (
                <img
                  src="assets/svgs/Star24_green.svg"
                  alt="Green colored diamond shape"
                  height="11"
                  typeof="image/svg+xml"
                />
              ) : (
                <DiamondIcon />
              )}
              <Typography variant="titleAlternate" component="h5" textTransform="uppercase">
                {title}
              </Typography>
            </Box>

            {isDraggable && (
              <img
                style={{ paddingRight: noPadding ? 16 : 0, cursor: 'grab' }}
                src="assets/svgs/Drag-n-Drop.svg"
                alt="Green colored diamond shape"
                height="21"
                typeof="image/svg+xml"
                className="grid-stack-apollo-drag-handle"
                aria-label="Drag and drop handler"
              />
            )}
          </Box>
          {children}
        </div>
      </Box>
    </div>
  );
}

export default FeatureBox;
