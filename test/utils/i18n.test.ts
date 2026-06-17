/**
 * Unit tests for i18n module.
 * Covers: locale detection, message lookup, fallback, placeholder replacement.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { initializeI18n, t, getCurrentLocale } from '../../src/utils/i18n';

suite('I18n', () => {
	let mockContext: vscode.ExtensionContext;

	setup(() => {
		// out/test/test/utils/ -> 4 levels up = project root
		mockContext = {
			extensionPath: path.resolve(__dirname, '..', '..', '..', '..'),
		} as vscode.ExtensionContext;
		initializeI18n(mockContext);
	});

	test('should initialize without error', () => {
		assert.ok(true);
	});

	test('should return localized string for valid key', () => {
		const result = t('codetrace.sidebar.title');
		// Should return actual translation, not the key itself
		assert.ok(result.length > 0);
		assert.notStrictEqual(result, 'codetrace.sidebar.title');
	});

	test('should generate readable fallback for missing key', () => {
		const result = t('nonexistent.key.xyz');
		// Should NOT return the raw key; should derive a fallback like "Xyz"
		assert.notStrictEqual(result, 'nonexistent.key.xyz');
		assert.strictEqual(typeof result, 'string');
		assert.ok(result.length > 0);
	});

	test('should handle placeholder replacement', () => {
		const result = t(
			'codetrace.general.relativeTime.minutesAgo',
			5
		);
		assert.ok(result.includes('5'));
	});

	test('should return current locale', () => {
		const locale = getCurrentLocale();
		assert.ok(['en', 'zh-cn'].includes(locale));
	});

	test('should handle multiple placeholder replacements', () => {
		// The key has one placeholder but we pass multiple args
		const result = t('codetrace.general.relativeTime.minutesAgo', 5, 10);
		assert.ok(result.includes('5'));
	});

	test('should not return raw key for undefined key', () => {
		const result = t('completely.missing.key.here');
		assert.notStrictEqual(result, 'completely.missing.key.here');
		assert.ok(result.length > 0);
	});

	test('should handle empty args gracefully', () => {
		const result = t('codetrace.general.relativeTime.minutesAgo');
		assert.ok(result.includes('{0}') || result.includes('minutes'));
	});
});
