/**
 * Unit tests for RepoManager.
 * Covers: engine resolution, multi-root discovery, submodule handling, disposal.
 */
import * as assert from 'assert';
import * as path from 'path';
import { RepoManager } from '../../src/core/repo-manager';
import { GitEngine } from '../../src/core/git-engine';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

suite('RepoManager', () => {
  let repo: RepoManager;

  setup(() => {
    repo = new RepoManager();
  });

  teardown(() => {
    repo.dispose();
  });

  test('should create RepoManager', () => {
    assert.ok(repo);
  });

  test('checkActive should return false when no engines', () => {
    assert.strictEqual(repo.checkActive(), false);
  });

  test('should return undefined for nonexistent path', async () => {
    const engine = await repo.getEngineFor('/nonexistent/path/file.ts');
    assert.strictEqual(engine, undefined);
  });

  test('should find engine for valid repo path', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const engine = await repo.getEngineFor(fp);
    assert.ok(engine);
    assert.ok(engine instanceof GitEngine);
    assert.strictEqual(engine.isDisposed(), false);
    assert.ok(engine.getRepoPath().includes('vscode-codetrace'));
  });

  test('checkActive should return true for active engine', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    await repo.getEngineFor(fp);
    assert.strictEqual(repo.checkActive(), true);
  });

  test('getEngineByRoot should return engine for known root', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const e1 = await repo.getEngineFor(fp);
    const e2 = repo.getEngineByRoot(e1!.getRepoPath());
    assert.strictEqual(e1, e2);
  });

  test('getEngineByRoot should return undefined for unknown root', () => {
    assert.strictEqual(repo.getEngineByRoot('/nonexistent'), undefined);
  });

  test('should reuse same engine for same root', async () => {
    const fp1 = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const fp2 = path.join(WORKSPACE_ROOT, 'src', 'core', 'git-engine.ts');
    const e1 = await repo.getEngineFor(fp1);
    const e2 = await repo.getEngineFor(fp2);
    assert.strictEqual(e1, e2);
  });

  test('should return undefined for disposed RepoManager', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    repo.dispose();
    const engine = await repo.getEngineFor(fp);
    assert.strictEqual(engine, undefined);
  });

  test('discoverRoots should find multiple folders', async () => {
    await repo.discoverRoots([
      path.join(WORKSPACE_ROOT, 'src'),
      path.join(WORKSPACE_ROOT, 'test'),
    ]);
    // Both should resolve to the same git root
    const root = repo.getEngineByRoot(WORKSPACE_ROOT);
    assert.ok(root);
  });

  test('discoverRoots should handle nonexistent folders', async () => {
    await repo.discoverRoots(['/nonexistent/folder']);
    assert.strictEqual(repo.checkActive(), false);
  });

  test('dispose should clear all engines', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    await repo.getEngineFor(fp);
    assert.strictEqual(repo.checkActive(), true);
    repo.dispose();
    assert.strictEqual(repo.checkActive(), false);
  });

  // ---- Convenience method tests with valid path ----

  test('getBlame should return array for valid file', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const results = await repo.getBlame(fp);
    assert.ok(Array.isArray(results));
    if (results.length > 0) {
      assert.ok(results[0].hash);
      assert.ok(results[0].author);
    }
  });

  test('getBlame should return empty for nonexistent file', async () => {
    const results = await repo.getBlame('/nonexistent/file.ts');
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });

  test('getFileHistory should return array for valid file', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const history = await repo.getFileHistory(fp, 5);
    assert.ok(Array.isArray(history));
  });

  test('getCurrentBranch should return string', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const branch = await repo.getCurrentBranch(fp);
    assert.ok(typeof branch === 'string');
    assert.ok(branch.length > 0);
  });

  test('getDiff should return string or undefined', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const diff = await repo.getDiff(fp, 'HEAD');
    // May be undefined if file unchanged at HEAD
    assert.ok(diff === undefined || typeof diff === 'string');
  });

  test('getFileAtCommit should return content or undefined', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const content = await repo.getFileAtCommit(fp, 'HEAD');
    assert.ok(content === undefined || typeof content === 'string');
  });

  test('getChangedFilesCount should return number', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const count = await repo.getChangedFilesCount(fp);
    assert.strictEqual(typeof count, 'number');
    assert.ok(count >= 0);
  });

  test('getLatestHash should return string', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const hash = await repo.getLatestHash(fp);
    assert.ok(typeof hash === 'string');
  });

  test('getUserName should return string', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const name = await repo.getUserName(fp);
    assert.ok(typeof name === 'string');
    assert.ok(name.length > 0);
  });

  test('getCommitBody should return string or undefined', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const hash = await repo.getLatestHash(fp);
    if (hash) {
      const body = await repo.getCommitBody(hash, fp);
      assert.ok(body === undefined || typeof body === 'string');
    }
  });

  test('getCommitStats should return string or undefined', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const hash = await repo.getLatestHash(fp);
    if (hash) {
      const stats = await repo.getCommitStats(hash, fp);
      assert.ok(stats === undefined || typeof stats === 'string');
    }
  });

  test('execCli should return string for valid command', async () => {
    const fp = path.join(WORKSPACE_ROOT, 'src', 'extension.ts');
    const output = await repo.execCli(['rev-parse', '--abbrev-ref', 'HEAD'], fp);
    assert.ok(typeof output === 'string');
  });

  test('execCli should return undefined for invalid path', async () => {
    const output = await repo.execCli(['--version'], '/nonexistent/file.ts');
    assert.strictEqual(output, undefined);
  });
});
