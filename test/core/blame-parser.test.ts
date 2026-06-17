/**
 * Unit tests for blame-parser.
 * Covers: porcelain format parsing, edge cases, multi-line bodies, empty input.
 */
import * as assert from 'assert';
import { parseBlamePorcelain, parseLineHistoryOutput } from '../../src/core/blame-parser';

suite('BlameParser', () => {
	test('should parse single-line blame', () => {
		const output = [
			'abc123def4567890123456789012345678901234 1 1 1',
			'author Alice',
			'author-mail <alice@example.com>',
			'author-time 1700000000',
			'summary Initial commit',
			'\tconsole.log("hello");',
		].join('\n');

		const results = parseBlamePorcelain(output);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].hash, 'abc123def4567890123456789012345678901234');
		assert.strictEqual(results[0].author, 'Alice');
		assert.strictEqual(results[0].email, 'alice@example.com');
		assert.strictEqual(results[0].summary, 'Initial commit');
		assert.strictEqual(results[0].lineNumber, 0);
	});

	test('should parse multi-line blame correctly', () => {
		// Standard git blame --porcelain format (no commit body)
		const output = [
			'abc123def4567890123456789012345678901234 1 1 2',
			'author Bob',
			'author-mail <bob@test.com>',
			'author-time 1700000000',
			'summary Fix bug',
			'\tline one',
			'\tline two',
		].join('\n');

		const results = parseBlamePorcelain(output);
		assert.strictEqual(results.length, 2);
		assert.strictEqual(results[0].author, 'Bob');
		assert.strictEqual(results[0].summary, 'Fix bug');
		assert.strictEqual(results[1].author, 'Bob');
		assert.strictEqual(results[1].lineNumber, 1);
	});

	test('should handle multiple commits in output', () => {
		const output = [
			'1111111111111111111111111111111111111111 1 1 1',
			'author Alice',
			'author-mail <alice@a.com>',
			'author-time 1700000000',
			'summary First',
			'\tline 1',
			'2222222222222222222222222222222222222222 2 2 1',
			'author Bob',
			'author-mail <bob@b.com>',
			'author-time 1700001000',
			'summary Second',
			'\tline 2',
		].join('\n');

		const results = parseBlamePorcelain(output);
		assert.strictEqual(results.length, 2);
		assert.strictEqual(results[0].author, 'Alice');
		assert.strictEqual(results[1].author, 'Bob');
	});

	test('should handle empty input', () => {
		const results = parseBlamePorcelain('');
		assert.strictEqual(results.length, 0);
	});

	test('should handle input with only whitespace', () => {
		const results = parseBlamePorcelain('   \n  \n  ');
		assert.strictEqual(results.length, 0);
	});

	test('should handle email with angle brackets', () => {
		const output = [
			'abc123def4567890123456789012345678901234 1 1 1',
			'author Name',
			'author-mail <user@domain.com>',
			'author-time 1700000000',
			'summary Test',
			'\tcode',
		].join('\n');

		const results = parseBlamePorcelain(output);
		assert.strictEqual(results[0].email, 'user@domain.com');
	});

	test('should handle timestamps correctly', () => {
		const output = [
			'abc123def4567890123456789012345678901234 1 1 1',
			'author Test',
			'author-mail <test@t.com>',
			'author-time 1700000000',
			'summary T',
			'\tcode',
		].join('\n');

		const results = parseBlamePorcelain(output);
		// 1700000000 Unix timestamp → Nov 14, 2023 (UTC)
		assert.ok(results[0].timestamp.includes('2023') || results[0].timestamp.includes('2024'));
	});

	test('should ignore tab-prefixed file content (not commit body)', () => {
		const output = [
			'abc123def4567890123456789012345678901234 1 1 1',
			'author Test',
			'author-mail <t@t.com>',
			'author-time 1700000000',
			'summary T',
			'\tcode',
		].join('\n');

		const results = parseBlamePorcelain(output);
		assert.strictEqual(results.length, 1);
		// body should be empty — git blame --porcelain does not include commit body
		assert.strictEqual(results[0].body, '');
		assert.strictEqual(results[0].author, 'Test');
	});

	test('should parse git log -L output', () => {
		const output = [
			'abc123def4567890123456789012345678901234',
			'Alice',
			'alice@test.com',
			'2026-01-01T00:00:00Z',
			'Fix bug',
			'def4567890123456789012345678901234567890',
			'Bob',
			'bob@test.com',
			'2026-02-01T00:00:00Z',
			'Initial commit',
		].join('\n');

		const results = parseLineHistoryOutput(output);
		assert.strictEqual(results.length, 2);
		assert.strictEqual(results[0].hash, 'abc123def4567890123456789012345678901234');
		assert.strictEqual(results[0].author, 'Alice');
		assert.strictEqual(results[1].hash, 'def4567890123456789012345678901234567890');
		assert.strictEqual(results[1].author, 'Bob');
	});

	test('should handle empty line history output', () => {
		const results = parseLineHistoryOutput('');
		assert.strictEqual(results.length, 0);
	});
});
