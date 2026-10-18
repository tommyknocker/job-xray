import * as acorn from 'acorn';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    BUNDLE_ORDER,
    readFirefoxContentBundle,
    stripModuleSyntax,
} from './lib/firefox-bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TOP_LEVEL_DECL =
    /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/;

function bindingNameFromLine(line) {
    const match = line.match(TOP_LEVEL_DECL);
    if (!match) {
        return null;
    }
    return match.slice(1).find(Boolean) ?? null;
}

/** Top-level names after stripModuleSyntax — catches concat collisions before AMO. */
async function findDuplicateBindingsAcrossSources() {
    const seen = new Map();
    const duplicates = [];

    for (const rel of BUNDLE_ORDER) {
        const source = stripModuleSyntax(await readFile(join(root, rel), 'utf8'));
        for (const line of source.split('\n')) {
            if (/^\s/.test(line)) {
                continue;
            }
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                continue;
            }
            const name = bindingNameFromLine(trimmed);
            if (!name) {
                continue;
            }
            const prev = seen.get(name);
            if (prev && prev !== rel) {
                duplicates.push({ name, first: prev, second: rel });
            } else if (!prev) {
                seen.set(name, rel);
            }
        }
    }

    return duplicates;
}

function parseAsFirefoxScript(source, label) {
    try {
        acorn.parse(source, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            allowHashBang: true,
        });
    } catch (error) {
        const loc = error.loc;
        const line = loc?.line ?? '?';
        const column = loc?.column ?? '?';
        throw new Error(`${label}: syntax error at line ${line}, column ${column}: ${error.message}`);
    }
}

export async function validateFirefoxBundle() {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const bundle = await readFirefoxContentBundle(pkg.version);

    const duplicates = await findDuplicateBindingsAcrossSources();
    if (duplicates.length > 0) {
        const lines = duplicates.map(
            (d) => `  duplicate top-level "${d.name}" in ${d.first} and ${d.second}`,
        );
        throw new Error(`Firefox content bundle would redeclare identifiers:\n${lines.join('\n')}`);
    }

    parseAsFirefoxScript(bundle, 'content.js (Firefox bundle)');

    for (const rel of ['extension/src/network-hook.js', 'extension/page-network-hook.js']) {
        const source = await readFile(join(root, rel), 'utf8');
        parseAsFirefoxScript(source, rel);
    }
}

const isMain =
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    await validateFirefoxBundle();
    console.log('ok: Firefox bundle and hook scripts parse as classic scripts (AMO-safe)');
}
