/**
 * Configuration utility module for CodeTrace.
 * Provides typed access to all extension settings with defaults.
 */
import * as vscode from 'vscode';

/** Configuration section prefix */
const CONFIG_SECTION = 'codetrace';

/**
 * Blame decoration style configuration.
 */
export interface BlameStyleConfig {
	/** CSS font size value */
	fontSize: string;
	/** Opacity value between 0 and 1 */
	opacity: number;
	/** CSS color value or 'auto' */
	color: string;
}

/**
 * Ignore filter configuration.
 */
export interface IgnoreConfig {
	/** User-defined glob patterns */
	patterns: string[];
	/** Whether to also respect .gitignore */
	useGitignore: boolean;
}

/**
 * Full CodeTrace configuration shape.
 */
export interface CodeTraceConfig {
	/** Master enable/disable switch */
	enabled: boolean;
	/** Idle sleep settings */
	idleSleep: {
		enabled: boolean;
		timeout: number;
	};
	/** Inline blame style */
	blame: BlameStyleConfig;
	/** File ignore settings */
	ignore: IgnoreConfig;
	/** Maximum file lines for inline blame */
	fileSizeLimit: number;
	/** Maximum commits cached per workspace */
	cacheMaxCommits: number;
}

/**
 * Get the full typed configuration from VS Code settings.
 * @returns The current CodeTrace configuration
 */
export function getConfig(): CodeTraceConfig {
	const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);

	return {
		enabled: cfg.get<boolean>('enabled', true),
		idleSleep: {
			enabled: cfg.get<boolean>('idleSleep.enabled', true),
			timeout: cfg.get<number>('idleSleep.timeout', 300),
		},
		blame: {
			fontSize: cfg.get<string>('blame.fontSize', '0.8em'),
			opacity: cfg.get<number>('blame.opacity', 0.55),
			color: cfg.get<string>('blame.color', 'auto'),
		},
		ignore: {
			patterns: cfg.get<string[]>('ignore.patterns', []),
			useGitignore: cfg.get<boolean>('ignore.useGitignore', true),
		},
		fileSizeLimit: cfg.get<number>('fileSizeLimit', 20000),
		cacheMaxCommits: cfg.get<number>('cache.maxCommits', 20),
	};
}

/**
 * Watch for configuration changes and invoke the callback.
 * @param callback - Function to call when config changes
 * @returns A disposable to unsubscribe
 */
export function onConfigChange(callback: (config: CodeTraceConfig) => void): vscode.Disposable {
	return vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration(CONFIG_SECTION)) {
			callback(getConfig());
		}
	});
}
