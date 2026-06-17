/**
 * Simple Mocha test runner for CodeTrace unit tests.
 * Uses @vscode/test-electron to run tests inside VS Code's extension host.
 */
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './suite');

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: ['--disable-extensions'],
		});
	} catch (err) {
		console.error('Tests failed:', err);
		process.exit(1);
	}
}

main();
