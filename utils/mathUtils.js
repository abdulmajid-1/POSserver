/**
 * Utility to round floating point numbers to at most 4 decimal places.
 * Eliminates JavaScript floating point precision artifacts (e.g., 4.0000003 -> 4, 6.33200000003 -> 6.332).
 * 
 * @param {number|string} num 
 * @returns {number}
 */
export const round4 = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round(Number(num) * 10000) / 10000;
};
