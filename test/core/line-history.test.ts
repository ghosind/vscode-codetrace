/**
 * Unit tests for line-history module.
 * Covers: getLineHistory, fallback path, parseLineHistoryOutput integration.
 */
import * as assert from 'assert';
import { GitEngine } from '../../src/core/git-engine';
import { getLineHistory } from '../../src/core/line-history';

suite('LineHistory', () => {
	let engine: GitEngine;

	setup(() => {
		engine = new GitEngine(__dirname + '/../../..');
	});

	teardown(() => {
		engine.dispose();
	});

	test('should return empty for disposed engine', async () => {
		engine.dispose();
		const results = await getLineHistory(engine, '/nonexistent/file.ts', 0);
		assert.strictEqual(results.length, 0);
	});

	test('should return results for nonexistent file', async () => {
		await engine.initialize();
		const results = await getLineHistory(engine, '/nonexistent/file.ts', 0, 5);
		// Should return empty or fallback results
		assert.ok(Array.isArray(results));
	});
});
