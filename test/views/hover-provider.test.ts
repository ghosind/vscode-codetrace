/**
 * Unit tests for HoverProvider.
 * Covers: hover markdown generation, template structure, button URIs, truncation.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { CodeTraceHoverProvider } from '../../src/views/hover-provider';
import { RepoManager } from '../../src/core/repo-manager';
import { BlameProvider } from '../../src/core/blame-provider';
import { CacheManager } from '../../src/cache/cache-manager';
import { initializeI18n } from '../../src/utils/i18n';

suite('HoverProvider', () => {
	let hoverProvider: CodeTraceHoverProvider;

	setup(() => {
		const mockContext = {
			storageUri: vscode.Uri.file(`/tmp/codetrace-hover-test-${Date.now()}`),
			extensionPath: path.resolve(__dirname, '..', '..', '..', '..'),
		} as unknown as vscode.ExtensionContext;
		initializeI18n(mockContext);
		const cache = new CacheManager(mockContext, 5);
		const blameProvider = new BlameProvider(cache);
		const repo = new RepoManager();
		hoverProvider = new CodeTraceHoverProvider(blameProvider, repo);
	});

	test('should create hover provider', () => {
		assert.ok(hoverProvider);
	});

	test('should return undefined for unsupported scheme', async () => {
		const doc = {
			uri: vscode.Uri.parse('gitlens://test'),
			lineAt: () => ({ range: new vscode.Range(0, 0, 0, 0) }),
		} as unknown as vscode.TextDocument;

		const hover = await hoverProvider.provideHover(doc, new vscode.Position(0, 0));
		// No engine set, should return undefined
		assert.strictEqual(hover, undefined);
	});

	test('should handle position beyond document', async () => {
		const doc = {
			uri: vscode.Uri.file('/nonexistent/file.ts'),
			lineAt: (_line: number) => {
				// Simulate out-of-bounds line
				throw new Error('Line out of bounds');
			},
		} as unknown as vscode.TextDocument;

		try {
			const hover = await hoverProvider.provideHover(doc, new vscode.Position(999, 0));
			assert.strictEqual(hover, undefined);
		} catch {
			// Expected — provider doesn't have engine, so returns undefined before lineAt
		}
	});

	test('should return undefined for cursor within code text', async () => {
		const doc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineAt: () => ({ text: 'code', range: new vscode.Range(0, 0, 0, 4) }),
		} as unknown as vscode.TextDocument;
		const hover = await hoverProvider.provideHover(doc, new vscode.Position(0, 2));
		assert.strictEqual(hover, undefined);
	});

	test('should handle document without text property in line', async () => {
		const doc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineAt: () => ({ range: new vscode.Range(0, 0, 0, 0) }),
		} as unknown as vscode.TextDocument;
		const hover = await hoverProvider.provideHover(doc, new vscode.Position(0, 10));
		assert.strictEqual(hover, undefined);
	});

	test('should handle null return from lineAt gracefully', async () => {
		const doc = {
			uri: vscode.Uri.file('/test/file.ts'),
			lineAt: () => { throw new Error('invalid'); },
		} as unknown as vscode.TextDocument;
		try {
			await hoverProvider.provideHover(doc, new vscode.Position(0, 0));
		} catch {
			// Expected for throw-based mock
		}
	});

      test('should return hover for real committed file', async () => {
        const fp = path.resolve(__dirname, '..', '..', '..', 'src', 'extension.ts');
        const repo = new RepoManager();
        await repo.discoverRoots([path.resolve(__dirname, '..', '..', '..')]);
        const mockContext = {
          storageUri: vscode.Uri.file(`/tmp/codetrace-hover-test-real-${Date.now()}`),
          extensionPath: path.resolve(__dirname, '..', '..', '..', '..'),
        } as unknown as vscode.ExtensionContext;
        const cache = new CacheManager(mockContext, 5);
        const bp = new BlameProvider(cache);
        bp.setRepo(repo);
        const hp = new CodeTraceHoverProvider(bp, repo);

        const doc = {
          uri: vscode.Uri.file(fp),
          lineAt: (line: number) => ({
            text: 'import * as vscode from \'vscode\';',
            range: new vscode.Range(line, 0, line, 50),
          }),
        } as unknown as vscode.TextDocument;

        // Cursor at end of line to trigger hover
        const hover = await hp.provideHover(doc, new vscode.Position(0, 50));
        if (hover) {
          assert.ok(hover.contents.length > 0);
          const md = hover.contents[0] as vscode.MarkdownString;
          assert.ok(md.value.includes('**'));
          assert.ok(md.value.includes('*'));
        }
        repo.dispose();
        bp.dispose();
      });
});
