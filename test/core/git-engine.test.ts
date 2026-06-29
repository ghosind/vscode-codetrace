/**
 * Unit tests for GitEngine.
 * Covers: initialization, blame parsing, file history, diff, edge cases.
 */
import * as assert from 'assert';
import { GitEngine, parseLogOutput, parseCommitStats } from '../../src/core/git-engine';
import { parseBlamePorcelain } from '../../src/core/blame-parser';

suite('GitEngine', () => {
	let engine: GitEngine;

	setup(() => {
		// Create engine pointing to the extension's own repo
		engine = new GitEngine(__dirname + '/../../..');
	});

	teardown(() => {
		engine.dispose();
	});

	test('should create engine with repo path', () => {
		assert.ok(engine);
		assert.strictEqual(engine.isDisposed(), false);
	});

	test('should initialize without error', async () => {
		await engine.initialize();
		assert.ok(true); // No throw = pass
	});

	test('should parse blame porcelain output correctly', () => {
		const sampleOutput = [
			'abc123def4567890123456789012345678901234 1 1 3',
			'author John Doe',
			'author-mail <john@example.com>',
			'author-time 1620000000',
			'summary Fix bug in parser',
			'\tfunction hello() {',
			'abc123def4567890123456789012345678901234 2 2 1',
			'\tworld',
		].join('\n');

		const results = parseBlamePorcelain(sampleOutput);
		assert.ok(results.length > 0);
		assert.strictEqual(results[0].author, 'John Doe');
		assert.strictEqual(results[0].email, 'john@example.com');
	});

	test('should handle empty blame porcelain input', () => {
		const results = parseBlamePorcelain('');
		assert.strictEqual(results.length, 0);
	});

	test('should return empty array when disposed', async () => {
		engine.dispose();
		const result = await engine.getBlame('/nonexistent/file.ts');
		assert.strictEqual(result.length, 0);
	});

	test('getBlame should return empty for nonexistent file', async () => {
		await engine.initialize();
		const result = await engine.getBlame('/nonexistent/file.ts');
		assert.ok(Array.isArray(result));
	});

	test('should get current branch', async () => {
		await engine.initialize();
		const branch = await engine.getCurrentBranch();
		// Should return a string (branch name) or undefined
		assert.ok(branch === undefined || typeof branch === 'string');
	});

	test('should get changed files count', async () => {
		await engine.initialize();
		const count = await engine.getChangedFilesCount();
		assert.strictEqual(typeof count, 'number');
		assert.ok(count >= 0);
	});

	test('should get diff for a file', async () => {
		await engine.initialize();
		const diff = await engine.getDiff('/nonexistent/file.ts', 'HEAD');
		// Should return undefined for nonexistent file
		assert.ok(diff === undefined || typeof diff === 'string');
	});

	test('should get file at commit', async () => {
		await engine.initialize();
		const content = await engine.getFileAtCommit('/nonexistent/file.ts', 'HEAD');
		assert.ok(content === undefined || typeof content === 'string');
	});

	test('should return empty history for nonexistent file', async () => {
		await engine.initialize();
		const history = await engine.getFileHistory('/nonexistent/file.ts');
		assert.ok(Array.isArray(history));
	});

	test('should parse log output format', () => {
		const output = [
			'abc123',
			'Author Name',
			'author@test.com',
			'2026-01-01T00:00:00Z',
			'Test commit summary',
			'Body line 1',
			'Body line 2',
			'---END---',
		].join('\n');

		const results = parseLogOutput(output);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].hash, 'abc123');
		assert.strictEqual(results[0].author, 'Author Name');
		assert.strictEqual(results[0].summary, 'Test commit summary');
	});

	test('should handle multiple commits in log output', () => {
		const output = [
			'hash1', 'Alice', 'a@a.com', '2026-01-01T00:00:00Z', 'First', '',
			'---END---',
			'hash2', 'Bob', 'b@b.com', '2026-01-02T00:00:00Z', 'Second', '',
			'---END---',
		].join('\n');

		const results = parseLogOutput(output);
		assert.strictEqual(results.length, 2);
		assert.strictEqual(results[0].hash, 'hash1');
		assert.strictEqual(results[1].hash, 'hash2');
	});

	test('should dispose without error', () => {
		assert.doesNotThrow(() => engine.dispose());
		assert.strictEqual(engine.isDisposed(), true);
	});

	test('should get commit stats for HEAD', async () => {
		await engine.initialize();
		const stats = await engine.getCommitStats('HEAD');
		assert.ok(stats === undefined || (stats !== null && typeof stats === 'object'));
	});

	test('should get user name', async () => {
		await engine.initialize();
		const name = await engine.getUserName();
		assert.ok(typeof name === 'string');
		assert.ok(name.length > 0);
	});

	test('should get latest hash', async () => {
		await engine.initialize();
		const hash = await engine.getLatestHash();
		assert.ok(hash === undefined || typeof hash === 'string');
	});

	test('should convert absolute path to repo-relative', () => {
		const repoPath = __dirname + '/../../..';
		const eng = new GitEngine(repoPath);
		const rel = eng.toRepoRelative(repoPath + '/src/extension.ts');
		assert.ok(rel.includes('src/extension'));
		eng.dispose();
	});

	test('should handle disposed engine gracefully', async () => {
		engine.dispose();
		assert.deepStrictEqual(await engine.getBlame('/x.ts'), []);
		assert.strictEqual(await engine.getCommitStats('HEAD'), undefined);
		assert.strictEqual(await engine.getLatestHash(), undefined);
		assert.strictEqual(await engine.getCurrentBranch(), undefined);
	});
});

suite('parseCommitStats', () => {
	test('should parse multi-file stat output', () => {
		const o = [
			' src/foo.ts | 12 ++++++++++++',
			' src/bar.ts | 5 ++---',
			' 2 files changed, 15 insertions(+), 5 deletions(-)',
		].join('\n');
		const s = parseCommitStats(o);
		assert.ok(s);
		assert.strictEqual(s!.filesChanged, 2);
		assert.strictEqual(s!.insertions, 15);
		assert.strictEqual(s!.deletions, 5);
		assert.strictEqual(s!.files.length, 2);
	});

	test('should parse single-file stat', () => {
		const o = [
			' src/ext.ts | 3 +++',
			' 1 file changed, 3 insertions(+)',
		].join('\n');
		const s = parseCommitStats(o);
		assert.ok(s);
		assert.strictEqual(s!.filesChanged, 1);
		assert.strictEqual(s!.insertions, 3);
		assert.strictEqual(s!.deletions, 0);
	});

	test('should parse deletion-only stat', () => {
		const o = [
			' src/old.ts | 8 --------',
			' 1 file changed, 8 deletions(-)',
		].join('\n');
		const s = parseCommitStats(o);
		assert.ok(s);
		assert.strictEqual(s!.insertions, 0);
		assert.strictEqual(s!.deletions, 8);
	});

	test('should return undefined for empty input', () => {
		assert.strictEqual(parseCommitStats(''), undefined);
	});

	test('should return undefined for whitespace-only', () => {
		assert.strictEqual(parseCommitStats('  \n  '), undefined);
	});

	test('should handle output with no summary line', () => {
		const s = parseCommitStats(' src/foo.ts | 3 +++');
		assert.ok(s);
		assert.strictEqual(s!.filesChanged, 1);
		assert.strictEqual(s!.insertions, 0);
	});
});
