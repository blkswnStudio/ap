import { SxProps, TextField, TextFieldProps, Theme } from '@mui/material';
import { FieldValues, UseControllerProps, useController, useFormContext } from 'react-hook-form';

type Props = TextFieldProps & {
  name: string;
  rules?: UseControllerProps<FieldValues, string>['rules'];
  sx?: SxProps<Theme>;
};

/**
 * Because the web platform can not create a reliable number input ._.
 * TODO: Exchange it with https://mui.com/base-ui/react-number-input/ some wonderful day.
 */
function NumberInput({ name, helperText, rules, onChange: handleCustomChange, ...textfieldProps }: Props) {
  const { control } = useFormContext();
  const {
    field: { ref, onChange, ...field },
    fieldState: { error },
  } = useController({ name, control, rules });

  return (
    <TextField
      {...field}
      {...textfieldProps}
      onChange={(event) => {
        onChange(event);
        handleCustomChange?.(event);
      }}
      size="small"
      inputRef={ref}
      error={!!error}
      helperText={error ? error.message : helperText}
      type="number"
      sx={{
        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
          display: 'none',
        },
        '& input[type=number]': {
          MozAppearance: 'textfield',
        },
        ...textfieldProps.sx,
      }}
    />
  );
}

export default NumberInput;
