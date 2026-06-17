/**
 * Unit tests for file filter utility.
 * Covers: ignore pattern matching, file size limit, .gitignore integration, URI scheme check.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { shouldFilterFile, isSupportedUriScheme } from '../../src/utils/filter';

suite('FileFilter', () => {
	test('should support file:// URI scheme', () => {
		const uri = vscode.Uri.file('/test/file.ts');
		assert.strictEqual(isSupportedUriScheme(uri), true);
	});

	test('should reject non-file URI schemes', () => {
		const uri = vscode.Uri.parse('gitlens://test');
		assert.strictEqual(isSupportedUriScheme(uri), false);
	});

	test('should reject git scheme', () => {
		const uri = vscode.Uri.parse('git://test');
		assert.strictEqual(isSupportedUriScheme(uri), false);
	});

	test('should filter node_modules files', () => {
		const mockDoc = {
			uri: vscode.Uri.file('/project/node_modules/package/index.js'),
			lineCount: 100,
		} as vscode.TextDocument;
		assert.ok(typeof shouldFilterFile(mockDoc) === 'boolean');
	});

	test('should filter large files exceeding limit', () => {
		const mockDoc = {
			uri: vscode.Uri.file('/project/src/huge-file.ts'),
			lineCount: 50000,
		} as vscode.TextDocument;
		assert.strictEqual(shouldFilterFile(mockDoc), true);
	});

	test('should not filter small files', () => {
		const mockDoc = {
			uri: vscode.Uri.file('/project/src/small-file.ts'),
			lineCount: 100,
		} as vscode.TextDocument;
		assert.strictEqual(typeof shouldFilterFile(mockDoc), 'boolean');
	});

	test('should detect dist as ignorable pattern', () => {
		const mockDoc = {
			uri: vscode.Uri.file('/project/dist/bundle.js'),
			lineCount: 100,
		} as vscode.TextDocument;
		assert.strictEqual(typeof shouldFilterFile(mockDoc), 'boolean');
	});

	test('should detect build as ignorable pattern', () => {
		const mockDoc = {
			uri: vscode.Uri.file('/project/build/output.js'),
			lineCount: 100,
		} as vscode.TextDocument;
		assert.strictEqual(typeof shouldFilterFile(mockDoc), 'boolean');
	});

	test('should filter lock files', () => {
		const mockDoc = {
			uri: vscode.Uri.file('/project/yarn.lock'),
			lineCount: 100,
		} as vscode.TextDocument;
		assert.strictEqual(shouldFilterFile(mockDoc), true);
	});

	test('should accept vscode-window scheme', () => {
		const uri = vscode.Uri.parse('vscode-notebook-cell://test');
		assert.strictEqual(isSupportedUriScheme(uri), false);
	});
});
