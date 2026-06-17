/**
 * Unit tests for html-templates.
 * Covers: wrapHtml generation, renderHistoryItem, escapeHtml, theme variables.
 */
import * as assert from 'assert';
import { wrapHtml, renderHistoryItem, escapeHtml } from '../../src/utils/html-templates';
import { CommitLogEntry } from '../../src/core/git-engine';

suite('HtmlTemplates', () => {
	const sampleEntry: CommitLogEntry = {
		hash: 'abc123def4567890123456789012345678901234',
		author: 'John Doe',
		email: 'john@example.com',
		timestamp: '2026-01-15T12:00:00.000Z',
		summary: 'Fix: resolve parsing issue',
		body: 'This fixes the long-standing parsing bug.\nMore details here.',
	};

	test('should generate valid HTML document', () => {
		const html = wrapHtml('Test Title', '<p>Content</p>');
		assert.ok(html.includes('<!DOCTYPE html>'));
		assert.ok(html.includes('<title>Test Title</title>'));
		assert.ok(html.includes('<p>Content</p>'));
		assert.ok(html.includes('</html>'));
	});

	test('should include VS Code theme CSS variables', () => {
		const html = wrapHtml('Title', '');
		assert.ok(html.includes('var(--vscode-font-family)'));
		assert.ok(html.includes('var(--vscode-foreground)'));
		assert.ok(html.includes('var(--vscode-sideBar-background)'));
	});

	test('should render history item with author and summary', () => {
		const html = renderHistoryItem(sampleEntry);
		assert.ok(html.includes('John Doe'));
		assert.ok(html.includes('Fix: resolve parsing issue'));
		assert.ok(html.includes('abc123de')); // short hash
	});

	test('should render short hash (8 chars) in visible text', () => {
		const html = renderHistoryItem(sampleEntry);
		// The hash display div shows first 8 characters
		const hashDiv = html.match(/<div class="hash">([^<]+)<\/div>/);
		assert.ok(hashDiv);
		assert.strictEqual(hashDiv![1], sampleEntry.hash.substring(0, 8));
		// The full hash is stored in data-hash attribute for click handling
		assert.ok(html.includes(`data-hash="${sampleEntry.hash}"`));
	});

	test('should escape HTML special characters', () => {
		assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
		assert.strictEqual(escapeHtml('"quoted"'), '&quot;quoted&quot;');
		assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
	});

	test('should escape author names with special chars', () => {
		const entry: CommitLogEntry = {
			...sampleEntry,
			author: 'User <script>alert("xss")</script>',
			summary: 'Fix & improve <hr>',
		};
		const html = renderHistoryItem(entry);
		assert.ok(!html.includes('<script>'));
		assert.ok(html.includes('&lt;script&gt;'));
		assert.ok(html.includes('&amp;'));
	});

	test('should render empty state div', () => {
		const html = wrapHtml('Panel', '<div class="empty-state">Nothing here</div>');
		assert.ok(html.includes('empty-state'));
		assert.ok(html.includes('Nothing here'));
	});

	test('should handle empty commit body', () => {
		const entry: CommitLogEntry = { ...sampleEntry, body: '' };
		const html = renderHistoryItem(entry);
		assert.ok(html.includes('John Doe'));
	});

	test('should handle very long commit summary', () => {
		const entry: CommitLogEntry = {
			...sampleEntry,
			summary: 'A'.repeat(200),
		};
		const html = renderHistoryItem(entry);
		assert.ok(html.includes('A'.repeat(200)));
	});

	test('should wrap content in scroll container', () => {
		const html = wrapHtml('Panel', '<div class="scroll-container">items</div>');
		assert.ok(html.includes('scroll-container'));
	});
});
