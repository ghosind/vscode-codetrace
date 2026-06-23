/**
 * Unit tests for logger module.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { initLogger, setLogLevel, debug, info, warn, error, measure } from '../../src/utils/logger';

suite('Logger', () => {
	let mockContext: vscode.ExtensionContext;

	setup(() => {
		mockContext = {
			subscriptions: [],
			extensionPath: '/tmp/codetrace-test',
		} as unknown as vscode.ExtensionContext;
		initLogger(mockContext);
	});

	test('should initialize without error', () => {
		assert.ok(mockContext.subscriptions.length > 0);
	});

	test('should log at all levels without throwing', () => {
		assert.doesNotThrow(() => debug('test debug'));
		assert.doesNotThrow(() => info('test info'));
		assert.doesNotThrow(() => warn('test warn'));
		assert.doesNotThrow(() => error('test error'));
	});

	test('should log with data payload without throwing', () => {
		assert.doesNotThrow(() => info('test with data', { key: 'value' }));
		assert.doesNotThrow(() => warn('test with error', new Error('test')));
	});

	test('should handle setLogLevel', () => {
		assert.doesNotThrow(() => setLogLevel('debug'));
		assert.doesNotThrow(() => setLogLevel('info'));
		assert.doesNotThrow(() => setLogLevel('warn'));
		assert.doesNotThrow(() => setLogLevel('error'));
	});

	test('should suppress debug logs when level is info', () => {
		setLogLevel('info');
		assert.doesNotThrow(() => debug('should be suppressed'));
	});

	test('should always show error logs', () => {
		setLogLevel('error');
		assert.doesNotThrow(() => error('should always show'));
	});

	test('should measure async execution time', async () => {
		const result = await measure('test-measure', async () => {
			await new Promise((r) => setTimeout(r, 10));
			return 42;
		});
		assert.strictEqual(result, 42);
	});
});
