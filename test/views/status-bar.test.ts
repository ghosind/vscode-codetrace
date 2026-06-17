/**
 * Unit tests for StatusBarManager.
 * Covers: creation, show/hide, refresh, dispose.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { StatusBarManager } from '../../src/views/status-bar';
import { GitEngine } from '../../src/core/git-engine';

suite('StatusBarManager', () => {
	let statusBar: StatusBarManager;

	setup(() => {
		statusBar = new StatusBarManager();
	});

	teardown(() => {
		statusBar.dispose();
	});

	test('should create status bar item', () => {
		assert.ok(statusBar);
	});

	test('should show without error', () => {
		assert.doesNotThrow(() => statusBar.show());
	});

	test('should hide without error', () => {
		assert.doesNotThrow(() => statusBar.hide());
	});

	test('should refresh without engine set', async () => {
		await statusBar.refresh();
		// Should not throw even without engine
		assert.ok(true);
	});

	test('should set engine and refresh', async () => {
		const repoPath = path.resolve(__dirname, '..', '..', '..');
		const engine = new GitEngine(repoPath);
		await engine.initialize();

		statusBar.setEngine(engine);
		await statusBar.refresh();
		// Should complete without error
		assert.ok(true);
		engine.dispose();
	});

	test('should dispose without error', () => {
		assert.doesNotThrow(() => statusBar.dispose());
	});
});
