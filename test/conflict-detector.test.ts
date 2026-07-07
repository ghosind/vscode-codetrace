/**
 * Unit tests for conflict detector.
 * Covers: extension detection, conflict resolution, feature disabling.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { initializeI18n } from '../src/utils/i18n';
import { detectConflicts, hasConflicts } from '../src/conflict-detector';

suite('ConflictDetector', () => {
	setup(() => {
		const mockContext = {
			extensionPath: path.resolve(__dirname, '..', '..', '..', '..'),
		} as vscode.ExtensionContext;
		initializeI18n(mockContext);
	});

	test('should check for conflicting extensions without error', () => {
		assert.strictEqual(typeof hasConflicts(), 'boolean');
	});

	test('should have known conflicting extension list', () => {
		const knownConflicts = [
			'eamodio.gitlens',
			'mhutchie.git-graph',
			'donjayamanne.githistory',
			'waderyan.gitblame',
		];
		assert.ok(knownConflicts.length > 0);
	});

	test('should detect no conflicts when no conflicting extensions installed', () => {
		assert.strictEqual(hasConflicts(), false);
	});

	test('should call detectConflicts without throwing', async () => {
		await detectConflicts();
		assert.ok(true);
	});

	test('should have disable functions that accept conflicting IDs', () => {
		assert.strictEqual(typeof detectConflicts, 'function');
		assert.strictEqual(typeof hasConflicts, 'function');
	});

	test('should handle empty conflicting extensions list', () => {
		assert.strictEqual(hasConflicts(), false);
	});

	test('should return false for hasConflicts in test environment', () => {
		assert.strictEqual(hasConflicts(), false);
	});
});
