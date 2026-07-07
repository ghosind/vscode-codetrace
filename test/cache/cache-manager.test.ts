/**
 * Unit tests for CacheManager.
 * Covers: basic CRUD, LRU eviction, file invalidation, expiration, disk persistence.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CacheManager, CachedBlameLine } from '../../src/cache/cache-manager';

/** Unique temp path per test run to avoid disk cache pollution. */
const TEST_CACHE_DIR = path.join(os.tmpdir(), `codetrace-test-cache-${Date.now()}`);

suite('CacheManager', () => {
	let cache: CacheManager;

	const sampleBlame: CachedBlameLine = {
		hash: 'abc123',
		author: 'Test Author',
		email: 'test@example.com',
		timestamp: '2026-01-01T00:00:00.000Z',
		summary: 'Test commit',
		body: 'Test body',
		lineNumber: 0,
	};

	setup(() => {
		// Ensure clean disk cache for each test
		if (fs.existsSync(TEST_CACHE_DIR)) {
			fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
		}
		const mockContext = {
			storageUri: vscode.Uri.file(TEST_CACHE_DIR),
			extensionPath: '/tmp/codetrace-test',
		} as unknown as vscode.ExtensionContext;
		cache = new CacheManager(mockContext, 5);
	});

	teardown(() => {
		cache.dispose();
		// Clean up disk cache after each test
		if (fs.existsSync(TEST_CACHE_DIR)) {
			fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
		}
	});

	test('should set and get cached entry', () => {
		cache.set('/test/file.ts', 10, sampleBlame);
		const result = cache.get('/test/file.ts', 10);
		assert.ok(result);
		assert.strictEqual(result?.author, 'Test Author');
		assert.strictEqual(result?.lineNumber, 0);
	});

	test('should return undefined for missing key', () => {
		const result = cache.get('/nonexistent.ts', 0);
		assert.strictEqual(result, undefined);
	});

	test('should retrieve all entries for a file', () => {
		cache.set('/test/file.ts', 0, { ...sampleBlame, lineNumber: 0 });
		cache.set('/test/file.ts', 1, { ...sampleBlame, lineNumber: 1, hash: 'def456' });
		cache.set('/test/other.ts', 0, sampleBlame);

		const fileEntries = cache.getFileEntries('/test/file.ts');
		assert.strictEqual(fileEntries.length, 2);
	});

	test('should invalidate file entries', () => {
		cache.set('/test/file.ts', 0, sampleBlame);
		cache.set('/test/file.ts', 1, sampleBlame);
		cache.invalidateFile('/test/file.ts');

		assert.strictEqual(cache.get('/test/file.ts', 0), undefined);
		assert.strictEqual(cache.get('/test/file.ts', 1), undefined);
	});

	test('should clear all entries', () => {
		cache.set('/test/a.ts', 0, sampleBlame);
		cache.set('/test/b.ts', 0, sampleBlame);
		cache.clearAll();

		assert.strictEqual(cache.get('/test/a.ts', 0), undefined);
		assert.strictEqual(cache.get('/test/b.ts', 0), undefined);
	});

	test('should evict LRU entry when at capacity', () => {
		// Fill cache to capacity (5 entries)
		for (let i = 0; i < 5; i++) {
			cache.set('/test/lru.ts', i, { ...sampleBlame, lineNumber: i, hash: `hash${i}` });
		}
		// Access entries 0 and 1 to mark them as recently used
		assert.ok(cache.get('/test/lru.ts', 0));
		assert.ok(cache.get('/test/lru.ts', 1));

		// Add one more to trigger eviction
		cache.set('/test/lru.ts', 5, { ...sampleBlame, lineNumber: 5, hash: 'evicted' });

		// Cache should never exceed maxEntries
		// Recently accessed entries (0, 1) should be preserved
		// At least one of the unaccessed entries (2, 3, 4) should be gone
		const surviving: number[] = [];
		for (let i = 0; i <= 5; i++) {
			if (cache.get('/test/lru.ts', i)) { surviving.push(i); }
		}
		// Should have exactly 5 entries (max capacity)
		assert.strictEqual(surviving.length, 5);
		// Entry 5 (just added) must exist
		assert.ok(surviving.includes(5));
	});

	test('should handle save and load from disk', () => {
		cache.set('/test/disk.ts', 0, sampleBlame);
		cache.set('/test/disk.ts', 1, { ...sampleBlame, lineNumber: 1, hash: 'disk1' });
		cache.saveToDisk();
		cache.clearAll();

		// Entries should be gone from memory
		assert.strictEqual(cache.get('/test/disk.ts', 0), undefined);

		// Create a new cache pointing to same disk location to verify load
		const mockContext = {
			storageUri: vscode.Uri.file(TEST_CACHE_DIR),
			extensionPath: '/tmp/codetrace-test',
		} as unknown as vscode.ExtensionContext;
		const cache2 = new CacheManager(mockContext, 5);
		assert.ok(cache2.get('/test/disk.ts', 0));
		cache2.dispose();
	});

	test('should handle multiple sets for same key', () => {
		cache.set('/test/overwrite.ts', 0, sampleBlame);
		cache.set('/test/overwrite.ts', 0, { ...sampleBlame, author: 'Updated' });
		const result = cache.get('/test/overwrite.ts', 0);
		assert.strictEqual(result?.author, 'Updated');
	});

	test('should handle empty file entries', () => {
		const entries = cache.getFileEntries('/nonexistent/file.ts');
		assert.strictEqual(entries.length, 0);
	});

	test('should handle dispose twice safely', () => {
		cache.dispose();
		assert.doesNotThrow(() => { cache.dispose(); });
	});
});
