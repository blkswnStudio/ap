/**
 * Parses a an en-US number display to a real float for reliable expectations.
 */
export const parseNumberString = (numberString: string) => {
  return parseFloat(numberString.replace(/,/g, ''));
};
