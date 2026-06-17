/**
 * Unit tests for time-utils.
 * Covers: relative time formatting, absolute time formatting, edge cases.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { initializeI18n } from '../../src/utils/i18n';
import { formatRelativeTime, formatAbsoluteTime } from '../../src/utils/time-utils';

suite('TimeUtils', () => {
	setup(() => {
		const mockContext = {
			extensionPath: path.resolve(__dirname, '..', '..', '..', '..'),
		} as vscode.ExtensionContext;
		initializeI18n(mockContext);
	});

	test('should format absolute time correctly', () => {
		const result = formatAbsoluteTime('2026-01-15T12:30:45.000Z');
		assert.ok(result.includes('2026'));
		assert.ok(result.includes('15'));
	});

	test('should format relative time for just now', () => {
		const now = new Date().toISOString();
		const result = formatRelativeTime(now);
		assert.ok(result.length > 0);
	});

	test('should handle future timestamps gracefully', () => {
		const futureDate = new Date(Date.now() + 86400000).toISOString();
		const result = formatRelativeTime(futureDate);
		assert.ok(result.includes('2026'));
	});

	test('should handle old timestamps (months ago)', () => {
		const oldDate = new Date(Date.now() - 90 * 86400000).toISOString();
		const result = formatRelativeTime(oldDate);
		assert.ok(result.includes('months ago') || result.includes('2026'));
	});

	test('should handle minutes ago', () => {
		const pastDate = new Date(Date.now() - 10 * 60000).toISOString();
		const result = formatRelativeTime(pastDate);
		assert.ok(result.includes('10') || result.includes('minutes ago'));
	});

	test('should handle hours ago', () => {
		const pastDate = new Date(Date.now() - 3 * 3600000).toISOString();
		const result = formatRelativeTime(pastDate);
		assert.ok(result.includes('3') || result.includes('hours ago'));
	});

	test('should handle days ago', () => {
		const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();
		const result = formatRelativeTime(pastDate);
		assert.ok(result.includes('2') || result.includes('days ago'));
	});

	test('should handle weeks ago', () => {
		const pastDate = new Date(Date.now() - 14 * 86400000).toISOString();
		const result = formatRelativeTime(pastDate);
		assert.ok(result.includes('2') || result.includes('weeks ago'));
	});

	test('should handle invalid timestamp', () => {
		assert.strictEqual(formatRelativeTime('not-a-date'), '');
		assert.strictEqual(formatAbsoluteTime('invalid'), '');
	});

	test('should format absolute time with full precision', () => {
		const result = formatAbsoluteTime('2026-01-15T12:30:45.000Z');
		assert.ok(result.includes('2026'));
		// Hours may vary by timezone, just verify format structure
		assert.ok(result.includes(':'));
		assert.ok(result.length > 10);
	});
});
