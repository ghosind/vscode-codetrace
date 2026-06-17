/**
 * Cache manager module for CodeTrace.
 * Implements a two-tier cache (memory + local disk) with automatic expiration,
 * LRU eviction, and configurable capacity limits.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * A single cached commit entry.
 */
export interface CachedBlameLine {
	/** The commit hash */
	hash: string;
	/** Author name */
	author: string;
	/** Author email */
	email: string;
	/** Commit timestamp (ISO string) */
	timestamp: string;
	/** Commit subject line */
	summary: string;
	/** Full commit body */
	body: string;
	/** Line number this blame applies to */
	lineNumber: number;
}

/**
 * Cache entry with metadata for expiration.
 */
interface CacheEntry {
	/** The cached data */
	data: CachedBlameLine;
	/** When this entry was cached (epoch ms) */
	cachedAt: number;
	/** Last access time for LRU eviction */
	lastAccess: number;
}

/** Default cache TTL: 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Default max cache entries */
const DEFAULT_MAX_ENTRIES = 20;

/**
 * Two-tier cache manager for blame data.
 * Memory cache for fast access, disk cache for persistence across sessions.
 */
export class CacheManager {
	private memoryCache: Map<string, CacheEntry> = new Map();
	private diskCachePath: string | undefined;
	private maxEntries: number;
	private cleanupTimer: ReturnType<typeof setInterval> | undefined;

	/**
	 * Create a new CacheManager.
	 * @param context - VS Code extension context for disk cache path
	 * @param maxEntries - Maximum number of cached entries
	 */
	constructor(context: vscode.ExtensionContext, maxEntries: number = DEFAULT_MAX_ENTRIES) {
		this.maxEntries = maxEntries;
		if (context.storageUri) {
			this.diskCachePath = path.join(context.storageUri.fsPath, 'blame-cache.json');
		}
		this.loadFromDisk();
		this.startCleanup();
	}

	/**
	 * Generate a cache key from file path and line number.
	 * @param filePath - Absolute file path
	 * @param lineNumber - Line number (0-based)
	 * @returns Cache key string
	 */
	private makeKey(filePath: string, lineNumber: number): string {
		return `${filePath}:${lineNumber}`;
	}

	/**
	 * Get cached blame data for a file and line.
	 * @param filePath - Absolute file path
	 * @param lineNumber - Line number (0-based)
	 * @returns Cached blame line or undefined
	 */
	get(filePath: string, lineNumber: number): CachedBlameLine | undefined {
		const key = this.makeKey(filePath, lineNumber);
		const entry = this.memoryCache.get(key);

		if (!entry) {
			return undefined;
		}

		// Check expiration
		if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
			this.memoryCache.delete(key);
			return undefined;
		}

		// Update LRU access time
		entry.lastAccess = Date.now();
		return entry.data;
	}

	/**
	 * Set cached blame data for a file and line.
	 * @param filePath - Absolute file path
	 * @param lineNumber - Line number (0-based)
	 * @param data - The blame data to cache
	 */
	set(filePath: string, lineNumber: number, data: CachedBlameLine): void {
		const key = this.makeKey(filePath, lineNumber);
		const now = Date.now();

		const entry: CacheEntry = {
			data,
			cachedAt: now,
			lastAccess: now,
		};

		// Evict oldest entries if at capacity
		if (this.memoryCache.size >= this.maxEntries) {
			this.evictLRU();
		}

		this.memoryCache.set(key, entry);
	}

	/**
	 * Get all cached entries for a specific file.
	 * @param filePath - Absolute file path
	 * @returns Array of cached blame lines for the file
	 */
	getFileEntries(filePath: string): CachedBlameLine[] {
		const results: CachedBlameLine[] = [];
		const prefix = `${filePath}:`;

		for (const [key, entry] of this.memoryCache.entries()) {
			if (key.startsWith(prefix)) {
				if (Date.now() - entry.cachedAt <= CACHE_TTL_MS) {
					results.push(entry.data);
					entry.lastAccess = Date.now();
				}
			}
		}

		return results.sort((a, b) => a.lineNumber - b.lineNumber);
	}

	/**
	 * Invalidate all cached entries for a specific file.
	 * @param filePath - Absolute file path
	 */
	invalidateFile(filePath: string): void {
		const prefix = `${filePath}:`;
		for (const key of this.memoryCache.keys()) {
			if (key.startsWith(prefix)) {
				this.memoryCache.delete(key);
			}
		}
	}

	/**
	 * Clear all in-memory cache entries.
	 */
	clearAll(): void {
		this.memoryCache.clear();
	}

	/**
	 * Evict the least recently used entry.
	 * Uses <= comparison to guarantee eviction even when timestamps tie.
	 */
	private evictLRU(): void {
		let oldestKey: string | undefined;
		let oldestAccess = Infinity;

		for (const [key, entry] of this.memoryCache.entries()) {
			if (entry.lastAccess <= oldestAccess) {
				oldestAccess = entry.lastAccess;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.memoryCache.delete(oldestKey);
		}
	}

	/**
	 * Start periodic cleanup of expired entries.
	 */
	private startCleanup(): void {
		this.cleanupTimer = setInterval(() => {
			const now = Date.now();
			for (const [key, entry] of this.memoryCache.entries()) {
				if (now - entry.cachedAt > CACHE_TTL_MS) {
					this.memoryCache.delete(key);
				}
			}
		}, CACHE_TTL_MS);
	}

	/**
	 * Persist cache to disk.
	 */
	saveToDisk(): void {
		if (!this.diskCachePath) {
			return;
		}

		try {
			const dir = path.dirname(this.diskCachePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const serializable: Record<string, CachedBlameLine> = {};
			for (const [key, entry] of this.memoryCache.entries()) {
				serializable[key] = entry.data;
			}

			fs.writeFileSync(this.diskCachePath, JSON.stringify(serializable), 'utf-8');
		} catch {
			// Silently fail disk writes
		}
	}

	/**
	 * Load cache from disk.
	 */
	private loadFromDisk(): void {
		if (!this.diskCachePath || !fs.existsSync(this.diskCachePath)) {
			return;
		}

		try {
			const raw = fs.readFileSync(this.diskCachePath, 'utf-8');
			const data: Record<string, CachedBlameLine> = JSON.parse(raw);
			const now = Date.now();

			for (const [key, value] of Object.entries(data)) {
				const entry: CacheEntry = {
					data: value,
					cachedAt: now,
					lastAccess: now,
				};
				this.memoryCache.set(key, entry);
			}
		} catch {
			// Silently fail disk reads
		}
	}

	/**
	 * Dispose the cache manager, saving to disk and stopping cleanup.
	 */
	dispose(): void {
		this.saveToDisk();
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}
		this.memoryCache.clear();
	}
}
