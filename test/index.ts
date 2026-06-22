import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
	const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

	const launchArgs = ['--disable-extensions'];
	if (isCI) {
		launchArgs.push('--no-sandbox');
	}

	try {
		await runTests({
			extensionDevelopmentPath: path.resolve(__dirname, '../../'),
			extensionTestsPath: path.resolve(__dirname, './suite'),
			launchArgs,
		});
	} catch (err) {
		console.error('Tests failed:', err instanceof Error ? err.message : err);
		process.exit(1);
	}
}

main();
