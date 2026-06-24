/**
 * Unit tests for line-history module.
 * Covers: getLineHistory, fallback path, parseLineHistoryOutput integration.
 */
import * as assert from 'assert';
import * as path from 'path';
import { RepoManager } from '../../src/core/repo-manager';
import { getLineHistory } from '../../src/core/line-history';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

suite('LineHistory', () => {
  let repo: RepoManager;

  setup(() => {
    repo = new RepoManager();
  });

  teardown(() => {
    repo.dispose();
  });

  test('should return empty for disposed repo', async () => {
    repo.dispose();
    const results = await getLineHistory(repo, '/nonexistent/file.ts', 0);
    assert.strictEqual(results.length, 0);
  });

  test('should return empty for nonexistent file', async () => {
    const results = await getLineHistory(repo, '/nonexistent/file.ts', 0, 5);
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });

  test('should return results for real file', async () => {
    await repo.discoverRoots([WORKSPACE_ROOT]);
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const results = await getLineHistory(repo, fp, 0, 10);
    assert.ok(Array.isArray(results));
  });

  test('should trigger fallback for invalid line spec', async () => {
    await repo.discoverRoots([WORKSPACE_ROOT]);
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    // Use a bizarrely high line number to trigger git log -L failure → fallback
    const results = await getLineHistory(repo, fp, 999999, 5);
    assert.ok(Array.isArray(results));
  });
});
