import { format, parseISO, isValid } from 'date-fns';

export function formatDate(date: string | Date, formatStr: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, formatStr) : 'Invalid date';
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, 'h:mm a') : 'Invalid time';
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, 'MMM d, yyyy h:mm a') : 'Invalid date';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatOdds(odds: number): string {
  if (odds >= 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  }
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

export function calculatePayout(amount: number, odds: number): number {
  if (odds > 0) {
    return amount * (odds / 100);
  }
  return amount * (100 / Math.abs(odds));
}

export function calculateProfit(amount: number, odds: number, won: boolean): number {
  if (!won) return -amount;
  return calculatePayout(amount, odds);
}
