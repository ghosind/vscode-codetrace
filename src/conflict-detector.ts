/**
 * Conflict detection module for CodeTrace.
 * Detects other Git tracing extensions (GitLens, Git Graph, etc.) that may
 * conflict with CodeTrace, and offers to disable their blame features.
 */
import * as vscode from 'vscode';
import { t } from './utils/i18n';
import { info, warn } from './utils/logger';

/**
 * Known conflicting extension IDs.
 */
const CONFLICTING_EXTENSIONS = [
  'eamodio.gitlens',
  'mhutchie.git-graph',
  'donjayamanne.githistory',
  'waderyan.gitblame',
];

/**
 * Check if any conflicting extensions are installed and active.
 * @returns Array of conflicting extension IDs
 */
function detectConflictingExtensions(): string[] {
  const conflicts: string[] = [];

  for (const extId of CONFLICTING_EXTENSIONS) {
    const ext = vscode.extensions.getExtension(extId);
    if (ext && ext.isActive) {
      conflicts.push(extId);
    }
  }

  return conflicts;
}

/**
 * Run conflict detection and show a warning dialog if conflicts are found.
 * Provides an option to disable conflicting extension features.
 */
export async function detectConflicts(): Promise<void> {
  const conflicts = detectConflictingExtensions();

  if (conflicts.length === 0) {
    info('No conflicting extensions detected');
    return;
  }
  warn('Conflicting extensions detected', { conflicts });

  const conflictNames = conflicts.map(getExtensionDisplayName).join(', ');

  const result = await vscode.window.showWarningMessage(
    `${t('codetrace.conflict.message')}\n\n${conflictNames}`,
    { modal: false },
    t('codetrace.conflict.disableBtn'),
    t('codetrace.conflict.ignoreBtn')
  );

  if (result === t('codetrace.conflict.disableBtn')) {
    await disableConflictingFeatures(conflicts);
  }
}

/**
 * Get a human-readable display name for an extension ID.
 * @param extId - Extension identifier
 * @returns Display name
 */
function getExtensionDisplayName(extId: string): string {
  const ext = vscode.extensions.getExtension(extId);
  if (ext && ext.packageJSON) {
    return ext.packageJSON.displayName || extId;
  }
  return extId;
}

/**
 * Attempt to disable blame-related features in conflicting extensions.
 * This sets specific configuration keys that common extensions use.
 * @param conflicts - Array of conflicting extension IDs
 */
async function disableConflictingFeatures(conflicts: string[]): Promise<void> {
  const config = vscode.workspace.getConfiguration();

  for (const extId of conflicts) {
    switch (extId) {
      case 'eamodio.gitlens':
        // Disable GitLens blame features
        try {
          await config.update(
            'gitlens.currentLine.enabled',
            false,
            vscode.ConfigurationTarget.Global
          );
          await config.update(
            'gitlens.blame.highlight.enabled',
            false,
            vscode.ConfigurationTarget.Global
          );
          await config.update(
            'gitlens.hovers.currentLine.over',
            false,
            vscode.ConfigurationTarget.Global
          );
        } catch (e) {
          warn('Failed to disable GitLens features', String(e));
        }
        break;

      case 'mhutchie.git-graph':
        // Git Graph doesn't have inline blame, usually safe
        break;

      case 'waderyan.gitblame':
      case 'donjayamanne.githistory':
        try {
          await config.update(
            'gitblame.statusBarMessageEnabled',
            false,
            vscode.ConfigurationTarget.Global
          );
        } catch (e) {
          warn('Failed to disable git blame features', String(e));
        }
        break;
    }
  }

  vscode.window.showInformationMessage(
    'CodeTrace: Conflicting features have been disabled. Please reload VS Code for changes to take effect.'
  );
}

/**
 * Check conflicts silently (without dialog).
 * Used during activation.
 * @returns true if conflicts were detected
 */
export function hasConflicts(): boolean {
  return detectConflictingExtensions().length > 0;
}
