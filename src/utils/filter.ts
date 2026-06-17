/**
 * File filter utility for CodeTrace.
 * Determines whether a file should be processed for blame operations
 * based on user configuration, .gitignore rules, and built-in defaults.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, IgnoreConfig } from './config';

/** Default patterns always excluded from blame */
const DEFAULT_IGNORE_PATTERNS = [
	'node_modules/**',
	'dist/**',
	'build/**',
	'out/**',
	'*.lock',
	'package-lock.json',
	'yarn.lock',
];

/**
 * Check if a file should be ignored based on configured patterns.
 * @param filePath - Absolute path to the file
 * @param ignoreConfig - The ignore configuration
 * @returns true if the file should be ignored
 */
function matchesIgnorePatterns(filePath: string, ignoreConfig: IgnoreConfig): boolean {
	const allPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignoreConfig.patterns];
	const relativePath = path.relative(getWorkspaceRoot() || '', filePath);
	const fileName = path.basename(filePath);

	for (const pattern of allPatterns) {
		if (matchGlob(relativePath, pattern) || matchGlob(fileName, pattern)) {
			return true;
		}
	}

	return false;
}

/**
 * Simple glob matching for ignore patterns.
 * Supports * and ** wildcards.
 * @param target - The string to match against
 * @param pattern - The glob pattern
 * @returns true if target matches the pattern
 */
function matchGlob(target: string, pattern: string): boolean {
	// Convert glob pattern to regex
	const regexStr = pattern
		.replace(/\./g, '\\.')
		.replace(/\*\*/g, '<<<GLOBSTAR>>>')
		.replace(/\*/g, '[^/]*')
		.replace(/<<<GLOBSTAR>>>/g, '.*')
		.replace(/\?/g, '.');

	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(target);
}

/**
 * Get the workspace root path.
 * @returns The workspace root path or undefined
 */
function getWorkspaceRoot(): string | undefined {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return undefined;
	}
	return folders[0].uri.fsPath;
}

/**
 * Load .gitignore patterns from the workspace root.
 * @returns Array of gitignore patterns
 */
function loadGitignorePatterns(): string[] {
	const root = getWorkspaceRoot();
	if (!root) {
		return [];
	}

	const gitignorePath = path.join(root, '.gitignore');
	if (!fs.existsSync(gitignorePath)) {
		return [];
	}

	try {
		const content = fs.readFileSync(gitignorePath, 'utf-8');
		return content
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'));
	} catch {
		return [];
	}
}

/**
 * Determine if a file should be excluded from blame processing.
 * Checks file size, ignore patterns, and .gitignore rules.
 * @param document - The VS Code text document to check
 * @returns true if the file should be filtered out
 */
export function shouldFilterFile(document: vscode.TextDocument): boolean {
	const config = getConfig();

	// Check file size limit (0 means no limit)
	if (config.fileSizeLimit > 0 && document.lineCount > config.fileSizeLimit) {
		return true;
	}

	const ignoreConfig = config.ignore;

	// Check user-defined and default ignore patterns
	if (matchesIgnorePatterns(document.uri.fsPath, ignoreConfig)) {
		return true;
	}

	// Check .gitignore if enabled
	if (ignoreConfig.useGitignore) {
		const gitignorePatterns = loadGitignorePatterns();
		const relativePath = path.relative(getWorkspaceRoot() || '', document.uri.fsPath);

		for (const pattern of gitignorePatterns) {
			if (matchGlob(relativePath, pattern)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if a URI scheme is supported for blame operations.
 * Only file:// URIs are supported.
 * @param uri - The document URI
 * @returns true if the URI scheme is supported
 */
export function isSupportedUriScheme(uri: vscode.Uri): boolean {
	return uri.scheme === 'file';
}
