import { ethers } from 'ethers';

export const stdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const roundCurrency = (value: number, decimals = 2, minDecimals = 2) => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals));
};

export const roundNumber = (value: number, decimals = 2) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const percentageChange = (newValue: number, oldValue: number) => {
  if (oldValue === 0) {
    return 0;
  }
  return (newValue - oldValue) / oldValue;
};

export const displayPercentage = (
  value: number,
  omitLabel: 'omit' | 'positive' | 'bivalent-omit' | 'default' = 'default',
  decimals: number = 2,
  /**
   * This is 999% because we want to show 999%+ when the value is greater than 999%
   */
  maxValue: number = 9.99,
) => {
  if (value > maxValue) {
    return omitLabel === 'omit' ? `${roundCurrency(maxValue * 100)}+` : `${roundCurrency(maxValue * 100)} %`;
  } else if (value < maxValue * -1) {
    return omitLabel === 'omit' ? `${roundCurrency(maxValue * 100)}+` : `${roundCurrency(maxValue * 100)} %`;
  }

  return omitLabel === 'omit'
    ? `${roundCurrency(value * 100, decimals, decimals)}`
    : omitLabel === 'positive'
      ? `${value > 0 ? '+' : ''}${roundCurrency(value * 100, decimals, decimals)} %`
      : omitLabel === 'bivalent-omit'
        ? `${value > 0 ? '+' : '-'}${roundCurrency(value * 100, decimals, decimals)}`
        : `${roundCurrency(value * 100, decimals, decimals)} %`;
};

export function floatToBigInt(floatNumber: number, precision: number = 18) {
  // Use ethers.js utility to parse the float string into a BigInt
  // This will account for the decimal places and convert accordingly
  const bigIntValue = ethers.parseUnits(floatNumber.toFixed(precision).toString(), precision);

  return bigIntValue;
}

export function bigIntStringToFloat(bigIntValue: string, decimals = 18) {
  const bigint = BigInt(bigIntValue);

  // Use ethers.js utility to format the BigInt value into a string
  // This takes into account the decimal places
  const formattedString = ethers.formatUnits(bigint, decimals);

  // Convert the formatted string to a float
  const floatValue = parseFloat(formattedString);

  return floatValue;
}

export function bigIntToFloatString(bigIntValue: bigint, decimals = 18) {
  // Use ethers.js utility to format the BigInt value into a string
  // This takes into account the decimal places
  const formattedString = ethers.formatUnits(bigIntValue, decimals);

  return formattedString;
}

export function dangerouslyConvertBigIntToNumber(
  bigNumber: bigint,
  precisionDigits = 18,
  shiftDigits?: number,
  /**
   * Just a dev feature because some numbers on staging dont make sense
   */
  fallback?: number,
): number {
  // Define the scaling factor based on the desired precision
  const scalingFactor = ethers.parseUnits('1', precisionDigits);

  // Scale down the BigNumber by the precision factor
  const scaledValue = bigNumber / scalingFactor;

  // Check if the scaled value is within JavaScript's safe integer range
  if (scaledValue < ethers.parseUnits(Number.MAX_SAFE_INTEGER.toString(), 0)) {
    // Convert to a JavaScript number
    return shiftDigits
      ? bigIntStringToFloat(scaledValue.toString(), 0) / Math.pow(10, shiftDigits)
      : bigIntStringToFloat(scaledValue.toString(), 0);
  } else {
    // Log an error or handle the case where the value is still too large
    if (fallback === undefined) {
      if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging' || process.env.NEXT_PUBLIC_ENVIRONMENT === 'development') {
        throw new Error("Resulting number exceeds JavaScript's safe integer range.");
      } else {
        console.warn("Resulting number exceeds JavaScript's safe integer range.");
      }

      return 0;
    } else {
      return fallback;
    }
  }
}

export function divBigIntsToFloat(number: bigint, divideBy: bigint, toPrecission: number): number {
  const scalingFactor = ethers.parseUnits('1', toPrecission);

  const result = (number * scalingFactor) / divideBy;

  return bigIntStringToFloat(result.toString(), toPrecission);
}

export function convertToEtherPrecission(bigNumber: bigint, precisionDigits: number) {
  const scalingFactor = ethers.parseUnits('1', 18 - precisionDigits);

  const result = bigNumber * scalingFactor;

  return result;
}
