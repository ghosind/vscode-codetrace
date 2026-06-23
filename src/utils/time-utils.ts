/**
 * Time formatting utility for CodeTrace.
 * Converts ISO timestamps to human-readable relative time strings.
 */
import { t } from './i18n';

/**
 * Format a timestamp as relative time string (e.g., "3 hours ago").
 * Falls back to absolute time for dates older than 6 months.
 * @param isoTimestamp - ISO 8601 timestamp string
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();

  // Guard against invalid timestamps
  if (isNaN(then)) {
    return '';
  }

  const diffMs = now - then;

  if (diffMs < 0) {
    return formatAbsoluteTime(isoTimestamp);
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) {
    return t('codetrace.general.relativeTime.justNow');
  }
  if (minutes < 60) {
    return t('codetrace.general.relativeTime.minutesAgo', minutes);
  }
  if (hours < 24) {
    return t('codetrace.general.relativeTime.hoursAgo', hours);
  }
  if (days < 7) {
    return t('codetrace.general.relativeTime.daysAgo', days);
  }
  if (weeks < 4) {
    return t('codetrace.general.relativeTime.weeksAgo', weeks);
  }
  return t('codetrace.general.relativeTime.monthsAgo', months > 12 ? 12 : months);
}

/**
 * Format a timestamp as absolute time string for display.
 * @param isoTimestamp - ISO 8601 timestamp string
 * @returns Formatted absolute time string
 */
export function formatAbsoluteTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  // Guard against invalid dates
  if (isNaN(date.getTime())) {
    return '';
  }

  const pad = (n: number): string => n.toString().padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
