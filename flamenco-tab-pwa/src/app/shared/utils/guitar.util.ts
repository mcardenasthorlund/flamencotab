import { STRING_NUMBERS } from '../../core/constants/guitar.constant';

export function fillStrings<T>(get: (stringNumber: number) => T): T[] {
  return STRING_NUMBERS.map((n) => get(n));
}