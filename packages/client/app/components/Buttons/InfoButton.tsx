import { Button, Typography } from '@mui/material';
import InfoIcon from '../Icons/InfoIcon';

type Props = {
  title: string;
  description: string;
  disabled?: boolean;
};

function InfoButton({ title, description, disabled = false }: Props) {
  return (
    <div>
      <Button variant="outlined" type="submit" disabled={disabled}>
        {title}
      </Button>
      <Typography
        variant="hint"
        sx={{
          display: 'flex',
          textAlign: 'center',
          justifyContent: 'center',
          gap: '5px',
          alignItems: 'center',
          marginTop: '6px',
        }}
      >
        <InfoIcon />

        {description}
      </Typography>
    </div>
  );
}

export default InfoButton;
