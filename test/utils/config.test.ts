/**
 * Unit tests for configuration utility.
 * Covers: config retrieval, defaults, change watching.
 */
import * as assert from 'assert';
import { getConfig, onConfigChange, CodeTraceConfig } from '../../src/utils/config';

suite('Configuration', () => {
	test('should return config with default values', () => {
		const config = getConfig();
		assert.strictEqual(typeof config.enabled, 'boolean');
		assert.strictEqual(typeof config.idleSleep.enabled, 'boolean');
		assert.ok(config.ignore.patterns !== undefined);
	});

	test('should have valid blame style defaults', () => {
		const config = getConfig();
		assert.ok(config.blame.fontSize.length > 0);
		assert.ok(config.blame.opacity > 0 && config.blame.opacity <= 1);
	});

	test('should have cache max commits setting', () => {
		const config = getConfig();
		assert.ok(config.cacheMaxCommits > 0);
	});

	test('should have file size limit setting', () => {
		const config = getConfig();
		assert.ok(config.fileSizeLimit >= 0);
	});

	test('should return config shape with all expected keys', () => {
		const config = getConfig();
		assert.ok('enabled' in config);
		assert.ok('idleSleep' in config);
		assert.ok('blame' in config);
		assert.ok('ignore' in config);
		assert.ok('fileSizeLimit' in config);
		assert.ok('cacheMaxCommits' in config);
	});

	test('should register config change listener', () => {
		const disposable = onConfigChange(() => { /* noop */ });
		assert.ok(disposable);
		assert.strictEqual(typeof disposable.dispose, 'function');
		disposable.dispose();
	});

	test('should have ignore patterns as array', () => {
		const config = getConfig();
		assert.ok(Array.isArray(config.ignore.patterns));
	});

	test('should have useGitignore default true', () => {
		const config = getConfig();
		assert.strictEqual(config.ignore.useGitignore, true);
	});
});
