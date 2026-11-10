/**
 * PINs that are too easy to guess (NIST SP 800-63B: refuse commonly used or expected values).
 * A PIN is never stored or logged; this only answers "is this one on the refused list?".
 */

/**
 * Well-known 6-digit PINs that the patterns below do not already catch: keypad shapes,
 * mirrored and counting patterns that show up near the top of published PIN frequency studies.
 */
const BEST_KNOWN = new Set([
  "112233",
  "123321",
  "654456",
  "123654",
  "121314",
  "102030",
  "147258",
  "258369",
  "369258",
  "147852",
  "741852",
  "852963",
  "963852",
  "159753",
  "357951",
  "159357",
  "789456",
  "456123",
  "321654",
  "696969",
  "100000",
  "200000",
  "111222",
  "112211",
  "110011",
  "001122",
  "998877",
]);

/** Each digit one more (or one less) than the last, wrapping 9 to 0: 123456, 890123, 543210. */
function isStraightRun(pin: string): boolean {
  for (const step of [1, 9]) {
    let run = true;
    for (let i = 1; i < pin.length; i += 1) {
      if ((pin.charCodeAt(i) - pin.charCodeAt(i - 1) + 10) % 10 !== step) {
        run = false;
        break;
      }
    }
    if (run) return true;
  }
  return false;
}

/** The same short block over and over: 121212, 123123, and all-same digits like 000000. */
function isSimpleRepeat(pin: string): boolean {
  for (const size of [1, 2, 3]) {
    const block = pin.slice(0, size);
    if (block.repeat(pin.length / size) === pin) return true;
  }
  return false;
}

/** True when the PIN must be refused at sign-up. Expects exactly 6 digits. */
export function isCommonPin(pin: string): boolean {
  return BEST_KNOWN.has(pin) || isStraightRun(pin) || isSimpleRepeat(pin);
}
