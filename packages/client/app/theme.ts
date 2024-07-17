import { alpha, createTheme, PaletteOptions } from '@mui/material/styles';

const DARK_PRIMARY_BACKGROUND = '#14111D';
const DARK_PAPER_BACKGROUND = '#2A2636';
const DARK_PRIMARY_TEXT = '#FFFFFF';
const DARK_SECONDARY_TEXT = '#827F8B';
const DARK_DISABLED_TEXT = '#504D59';
const DARK_TEXT_SHADY = '#46434F';
const DARK_TEXT_LABEL = '#3C3945';
const DARK_BUTTON_2_BORDER = '#3C3945';
const DARK_BUTTON_BACKGROUND_HOVER = '#1D202F';
const DARK_FIELDSET_COLOR = '#46434F';

const LIGHT_PRIMARY_BACKGROUND = '#ffffff';
const LIGHT_PAPER_BACKGROUND = '#ECECEC';
const LIGHT_PRIMARY_TEXT = '#14111D';
const LIGHT_SECONDARY_TEXT = '#5A5A5A';
const LIGHT_DISABLED_TEXT = '#939393';
const LIGHT_TEXT_SHADY = '#AEAEAE';
const LIGHT_TEXT_LABEL = '#CBCBCB';
const LIGHT_BUTTON_2_BORDER = '#CBCBCB';
// TODO: Not sure
const LIGHT_BUTTON_BACKGROUND_HOVER = '#ECECEC';
const LIGHT_FIELDSET_COLOR = '#AEAEAE';

// TODO: Adjust these base on mode
export const DARK_BUTTON_BACKGROUND = '#1E1B27';
export const DARK_BACKGROUND_EMPHASIS = '#282531';

export const LIGHT_BUTTON_BACKGROUND = '#F8F8F8';
export const LIGHT_BACKGROUND_EMPHASIS = '#ECECEC';

const buildTheme = (mode: PaletteOptions['mode']) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
        contrastText: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
      },
      background: {
        default: mode === 'dark' ? DARK_PRIMARY_BACKGROUND : LIGHT_PRIMARY_BACKGROUND,
        paper: mode === 'dark' ? DARK_PAPER_BACKGROUND : LIGHT_PAPER_BACKGROUND,
        emphasis: mode === 'dark' ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS,
      },
      text: {
        primary: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
        secondary: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
        disabled: mode === 'dark' ? DARK_DISABLED_TEXT : LIGHT_DISABLED_TEXT,
      },
      success: {
        main: '#3DD755',
        background: alpha('#3DD755', 0.15),
        contrastText: '#1E1B27',
      },
      error: {
        main: '#E04A4A',
        background: alpha('#E04A4A', 0.15),
        contrastText: '#1E1B27',
      },
      info: {
        main: '#33B6FF',
        background: alpha('#33B6FF', 0.15),
        contrastText: '#1E1B27',
      },
      table: {
        border: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
      },
    },

    typography: {
      fontFamily: ['Inter Variable', 'Space Grotesk Variable'].join(','),
      h4: {
        fontFamily: 'Space Grotesk Variable',
        color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
        fontWeight: '700',
        fontSize: '20px',
      },
      h6: {
        //styleName: Title/Title 1;
        fontFamily: 'Space Grotesk Variable',
        fontSize: '19.5px',
        fontWeight: '700',
      },
      body1: {
        color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
        fontWeight: '700',
        fontSize: '14px',
      },
      body2: {
        color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
        fontWeight: '400',
        fontSize: '11.7px',
      },
      subtitle1: {
        color: mode === 'dark' ? DARK_DISABLED_TEXT : LIGHT_DISABLED_TEXT,
        fontWeight: '700',
        fontSize: '14px',
      },
      subtitle2: {
        color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
        fontWeight: '700',
        fontSize: '14px',
        lineHeight: '14.04px',
      },
      caption: {
        color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
        fontSize: '14.3px',
        fontWeight: '400',
        lineHeight: '13px',
      },
      titleAlternate: {
        //styleName: Title/Title 3;
        fontFamily: 'Space Grotesk Variable',
        fontSize: '14.3px',
        fontWeight: '700',
        lineHeight: '14px',
        color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
      },
      hint: {
        //styleName: Text/xSmall
        fontSize: '11.7px',
        fontWeight: '400',
        lineHeight: '11px',
        color: mode === 'dark' ? DARK_DISABLED_TEXT : LIGHT_DISABLED_TEXT,
      },
      label: {
        fontFamily: 'Space Grotesk Variable',
        color: mode === 'dark' ? DARK_TEXT_LABEL : LIGHT_TEXT_LABEL,
        fontWeight: '700',
        fontSize: '11.7px',
      },
      shady: {
        fontFamily: 'Space Grotesk Variable',
        color: mode === 'dark' ? DARK_TEXT_SHADY : LIGHT_TEXT_SHADY,
        fontWeight: '700',
        fontSize: '11.7px',
      },
    },
    components: {
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': {
              backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
            },
            '&.Mui-selected': {
              backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
              ':hover': {
                backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
              },
            },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
            fontSize: '14.3px',
            borderBottom: '1px solid',
            borderColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
            padding: '10px 15px',
          },
        },
      },

      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
          },
        },
      },

      MuiInputBase: {
        styleOverrides: {
          root: {
            '& fieldset': {
              borderColor: mode === 'dark' ? DARK_FIELDSET_COLOR : LIGHT_FIELDSET_COLOR, // change border color
              borderWidth: '1px', // change border thickness
              top: '-4px',
            },
          },
          input: {
            '&::placeholder': {
              color: mode === 'dark' ? DARK_DISABLED_TEXT : LIGHT_DISABLED_TEXT, // change placeholder color
            },
          },
        },
      },

      MuiInputAdornment: {
        styleOverrides: {
          root: {
            marginTop: '1px',
            marginRight: '-5px',
          },
        },
      },

      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginTop: '6px',
            marginBottom: '2px',
            marginLeft: 0,
          },
        },
      },

      MuiButton: {
        variants: [
          {
            props: { variant: 'rounded' },
            style: {
              backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
              color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
              border: `2px solid ${mode === 'dark' ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS}`,
              fontWeight: '700',
              padding: '0px',
              height: '30px',
              display: 'inline-block',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND_HOVER : LIGHT_BUTTON_BACKGROUND_HOVER,
                color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
                border: '2px solid transparent',
              },
            },
          },
          {
            props: { variant: 'undercover' },
            style: {
              fontFamily: 'Inter Variable',
              margin: '5px 0',
              minWidth: 'auto',
              backgroundColor: 'transparent',
              color: '#33B6FF',
              border: `none`,
              padding: '0px',
              display: 'inline-block',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND_HOVER : LIGHT_BUTTON_BACKGROUND_HOVER,
                color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
              },
            },
          },
        ],

        styleOverrides: {
          root: {
            fontFamily: 'Space Grotesk Variable',
          },

          contained: {
            backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND : LIGHT_BUTTON_BACKGROUND,
            color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
            border: `2px solid ${mode === 'dark' ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS}`,
            fontWeight: '700',
            width: '100%',
            height: '30px',
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND_HOVER : LIGHT_BUTTON_BACKGROUND_HOVER,
              color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
              border: '2px solid transparent',
              boxShadow: 'none',
            },
          },
          outlined: {
            backgroundColor: 'transparent',
            color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
            border: `2px solid ${mode === 'dark' ? DARK_BUTTON_2_BORDER : LIGHT_BUTTON_2_BORDER}`,
            fontWeight: '700',
            width: '100%',
            height: '40px',
            '&:hover': {
              backgroundColor: mode === 'dark' ? DARK_BUTTON_BACKGROUND_HOVER : LIGHT_BUTTON_BACKGROUND_HOVER,
              color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
              border: '2px solid transparent',
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          flexContainer: {
            borderBottom: '1px solid',
            borderBottomColor: mode === 'dark' ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS,
          },
          indicator: {
            backgroundColor: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          textColorPrimary: {
            color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
            fontWeight: '700',
          },
          root: {
            fontFamily: 'Space Grotesk Variable',
            // These styles will apply when the tab is selected
            '&.Mui-selected': {
              color: mode === 'dark' ? DARK_PRIMARY_TEXT : LIGHT_PRIMARY_TEXT,
            },
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === 'dark' ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS,
            color: mode === 'dark' ? DARK_SECONDARY_TEXT : LIGHT_SECONDARY_TEXT,
          },
          arrow: {
            color: mode === 'dark' ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS,
          },
        },
      },
    },
  });

// Augment MUI theme for new variant

import '@mui/material/Button';

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    rounded: true;
    undercover: true;
  }
}

import '@mui/material/styles';
import '@mui/material/Typography';

declare module '@mui/material/styles' {
  interface TypographyVariants {
    titleAlternate: React.CSSProperties;
    hint: React.CSSProperties;
    label: React.CSSProperties;
    shady: React.CSSProperties;
  }

  // allow configuration using `createTheme`
  interface TypographyVariantsOptions {
    titleAlternate?: React.CSSProperties;
    hint?: React.CSSProperties;
    label?: React.CSSProperties;
    shady?: React.CSSProperties;
  }

  interface PaletteOptions {
    table: {
      border: string;
    };
  }

  interface TypeBackground {
    default: string;
    paper: string;
    emphasis: string;
  }

  interface Palette {
    table: {
      border: string;
    };
  }

  interface PaletteColorOptions {
    main: string;
    contrastText: string;
    background?: string;
  }

  interface PaletteColor {
    main: string;
    contrastText: string;
    background: string;
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    titleAlternate: true;
    hint: true;
    label: true;
    shady: true;
  }
}

export default buildTheme;
