/**
 * Internationalization (i18n) module for CodeTrace.
 * Supports English (default) and Chinese with extensible language pack architecture.
 * Auto-detects VS Code locale on first launch.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Supported locale identifiers */
type SupportedLocale = 'en' | 'zh-cn';

/** Type for i18n message keys */
type MessageKey = string;

/** Map of language packs loaded at runtime */
const languagePacks: Map<string, Record<string, string>> = new Map();

/** Current active locale */
let currentLocale: SupportedLocale = 'en';

/**
 * Detect the VS Code display language and map it to a supported locale.
 * @returns The best-matching supported locale identifier
 */
function detectLocale(): SupportedLocale {
	const vscodeLocale = vscode.env.language.toLowerCase();
	if (vscodeLocale.startsWith('zh')) {
		return 'zh-cn';
	}
	return 'en';
}

/**
 * Load a language pack JSON file from the i18n directory.
 * @param locale - The locale identifier to load
 * @param context - VS Code extension context for resolving paths
 */
function loadLanguagePack(locale: SupportedLocale, context: vscode.ExtensionContext): void {
	try {
		const i18nPath = path.join(context.extensionPath, 'i18n', `${locale}.json`);
		if (fs.existsSync(i18nPath)) {
			const raw = fs.readFileSync(i18nPath, 'utf-8');
			const pack: Record<string, string> = JSON.parse(raw);
			languagePacks.set(locale, pack);
		}
	} catch {
		// Silently fall back to English if loading fails
	}
}

/**
 * Initialize the i18n system. Must be called once during extension activation.
 * @param context - VS Code extension context
 */
export function initializeI18n(context: vscode.ExtensionContext): void {
	currentLocale = detectLocale();
	// Always load English as fallback
	loadLanguagePack('en', context);
	if (currentLocale !== 'en') {
		loadLanguagePack(currentLocale, context);
	}
}

/**
 * Get a localized message string by key.
 * Falls back to English if the key is not found in the current locale.
 * @param key - The i18n message key
 * @param args - Optional replacement arguments for placeholders like {0}, {1}
 * @returns The localized string
 */
export function t(key: MessageKey, ...args: (string | number)[]): string {
	let message: string | undefined;

	// Try current locale first
	const currentPack = languagePacks.get(currentLocale);
	if (currentPack) {
		message = currentPack[key];
	}

	// Fall back to English
	if (!message) {
		const enPack = languagePacks.get('en');
		if (enPack) {
			message = enPack[key];
		}
	}

	// Final fallback: derive a human-readable string from the key itself
	if (!message) {
		const lastSegment = key.split('.').pop() || key;
		message = lastSegment.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
	}

	// Replace placeholders {0}, {1}, etc.
	return message.replace(/\{(\d+)\}/g, (_match, index: string) => {
		const i = parseInt(index, 10);
		return i < args.length ? String(args[i]) : `{${index}}`;
	});
}

/**
 * Get the currently active locale identifier.
 * @returns The active locale string
 */
export function getCurrentLocale(): SupportedLocale {
	return currentLocale;
}
