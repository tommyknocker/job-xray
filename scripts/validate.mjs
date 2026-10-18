import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, env = {}) {
    execSync(command, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, ...env },
    });
}

if (!existsSync(join(root, 'node_modules/acorn/package.json'))) {
    console.error('validate: dependencies missing — run `npm ci` first');
    process.exit(1);
}

run('node tests/run.mjs', { CI: 'true' });
run('npm run check');
run('npm run build');

console.log('validate: ok (same checks as GitHub CI + release build)');
