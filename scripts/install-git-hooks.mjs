import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = join(root, '.git');
const hooksDir = join(gitDir, 'hooks');
const hookPath = join(hooksDir, 'pre-push');

const MARKER = '# job-xray validate';

const hookBody = `#!/bin/sh
set -e
cd "$(git rev-parse --show-toplevel)"
npm run validate
`;

if (!existsSync(gitDir)) {
    process.exit(0);
}

mkdirSync(hooksDir, { recursive: true });

if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(MARKER)) {
        process.exit(0);
    }
    if (existing.trim()) {
        console.log('install-git-hooks: .git/hooks/pre-push exists — not overwriting');
        console.log('  Run manually before push: npm run validate');
        process.exit(0);
    }
}

writeFileSync(hookPath, `${MARKER}\n${hookBody}`, 'utf8');
chmodSync(hookPath, 0o755);
console.log('install-git-hooks: pre-push → npm run validate');
