import { Box, Tooltip } from '@mui/material';
import TableCell from '@mui/material/TableCell';
import { ComponentProps } from 'react';

type Props = {
  title: string;
  cellProps?: ComponentProps<typeof TableCell>;
  tooltipProps?: Omit<ComponentProps<typeof Tooltip>, 'children'>;
};

function HeaderCell({ title, cellProps = {}, tooltipProps }: Props) {
  return (
    <TableCell
      {...cellProps}
      sx={{
        ...cellProps.sx,
        color: 'text.disabled',
        font: '14.3px Space Grotesk Variable',
        fontWeight: 700,
        borderColor: 'table.border',
      }}
    >
      {tooltipProps ? (
        <Box
          sx={{
            textDecorationLine: 'underline',
            textDecorationStyle: 'dashed',
            textDecorationColor: 'text.disabled',
          }}
        >
          <Tooltip
            {...tooltipProps}
            title={tooltipProps.title}
            sx={{ backgroundColor: 'background.emphasis', ...tooltipProps.sx }}
            arrow
          >
            <span>{title}</span>
          </Tooltip>
        </Box>
      ) : (
        title
      )}
    </TableCell>
  );
}

export default HeaderCell;
