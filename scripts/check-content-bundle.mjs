import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { smokeContentBundle } from './smoke-content-bundle.mjs';

export async function buildCheckedContentBundle() {
    const entry = fileURLToPath(new URL('../extension/src/content.js', import.meta.url));
    const { outputFiles: [output] } = await build({
        entryPoints: [entry],
        bundle: true,
        format: 'iife',
        target: ['chrome88', 'firefox140'],
        write: false,
    });
    const bundle = output.text;

    const htmlWrite = bundle.match(/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/);
    if (htmlWrite) {
        throw new Error(`Firefox content bundle assigns HTML (${htmlWrite[0].trim()}) — AMO rejects unsanitized innerHTML`);
    }

    for (const filename of ['extension/src/network-hook.js', 'extension/page-network-hook.js']) {
        const source = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8');
        new Script(source, { filename });
    }

    smokeContentBundle(new Script(bundle, { filename: 'content.js' }));
    return bundle;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await buildCheckedContentBundle();
    console.log('ok: release content.js renders and updates badges');
}
