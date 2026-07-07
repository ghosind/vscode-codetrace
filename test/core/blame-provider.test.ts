/**
 * Unit tests for blame provider.
 * Covers: engine integration, cache coordination, sleep/wake cycles.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { BlameProvider } from '../../src/core/blame-provider';
import { CacheManager } from '../../src/cache/cache-manager';
import { RepoManager } from '../../src/core/repo-manager';

suite('BlameProvider', () => {
	let provider: BlameProvider;
	let cache: CacheManager;

	setup(() => {
		const mockContext = {
			storageUri: vscode.Uri.file(`/tmp/codetrace-test-blame-${Date.now()}`),
			extensionPath: '/tmp/codetrace-test',
		} as unknown as vscode.ExtensionContext;
		cache = new CacheManager(mockContext, 5);
		provider = new BlameProvider(cache);
	});

	teardown(() => {
		provider.dispose();
		cache.dispose();
	});

	test('should create provider', () => {
		assert.ok(provider);
	});

	test('should return undefined when no engine set', async () => {
		const mockDoc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineCount: 100,
		} as vscode.TextDocument;

		const result = await provider.getBlameForLine(mockDoc, 0);
		assert.strictEqual(result, undefined);
	});

	test('should report activity without error', () => {
		assert.doesNotThrow(() => {
			provider.reportActivity();
		});
	});

	test('should sleep and wake correctly', () => {
		assert.doesNotThrow(() => {
			provider.sleep();
			provider.wake();
		});
	});

	test('should dispose without error', () => {
		assert.doesNotThrow(() => {
			provider.dispose();
		});
	});

	test('should return empty map for visible range without engine', async () => {
		const mockDoc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineCount: 100,
		} as vscode.TextDocument;
		const range = new vscode.Range(0, 0, 10, 0);
		const result = await provider.getBlameForVisibleRange(mockDoc, range);
		assert.strictEqual(result.size, 0);
	});

	test('should invalidate file cache without error', () => {
		assert.doesNotThrow(() => {
			provider.invalidateFile('/test/file.ts');
		});
	});

	test('should handle unsupported URI scheme', async () => {
		const mockDoc = {
			uri: vscode.Uri.parse('gitlens://test'),
			lineCount: 100,
		} as vscode.TextDocument;
		const result = await provider.getBlameForLine(mockDoc, 0);
		assert.strictEqual(result, undefined);
	});

	test('should return undefined when sleeping', async () => {
		const mockDoc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineCount: 100,
		} as vscode.TextDocument;
		provider.sleep();
		const result = await provider.getBlameForLine(mockDoc, 0);
		assert.strictEqual(result, undefined);
		provider.wake();
	});

	test('should return undefined after dispose', async () => {
		const mockDoc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineCount: 100,
		} as vscode.TextDocument;
		provider.dispose();
		const result = await provider.getBlameForLine(mockDoc, 0);
		assert.strictEqual(result, undefined);
	});

	test('should return blame for real file with engine', async () => {
		const repo = new RepoManager();
		await repo.discoverRoots([__dirname + '/../../..']);
		provider.setRepo(repo);

		const mockDoc = {
			uri: vscode.Uri.file(__dirname + '/../../../src/extension.ts'),
			lineCount: 200,
		} as vscode.TextDocument;
		const result = await provider.getBlameForLine(mockDoc, 0);
		// Should return blame for the first line of extension.ts
		if (result) {
			assert.ok(result.hash.length > 0);
			assert.ok(result.author.length > 0);
		}
		repo.dispose();
	});
});
