// One-off codemod: add the missing idempotentHint / openWorldHint fields to
// every tool's inline ToolAnnotations object, so all four MCP tool hints are
// declared explicitly on every tool (hosts and directories such as M8ven
// reject tools where any of the four hints is missing).
//
// Idempotency follows a strict end-state reading: idempotentHint is true only
// when repeating an identical call leaves the wiki in the same state as a
// single call (a harmless error on repeat still counts, like HTTP DELETE).
// Everything else stays false so hosts do not blindly auto-retry.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Write tools whose repeated identical call converges to the same wiki state.
const IDEMPOTENT = new Set([
    'purge', // cache invalidation — harmless to repeat
    'protect', // re-applying identical protection settings converges
    'unblock', // unblocking an unblocked user is a harmless no-op error
    'write', // full-page overwrite with identical content ends identically
]);

const dirs = ['src/tools/ro', 'src/tools/editing'];
const pattern = /( +readOnlyHint: (?:true|false),\r?\n +destructiveHint: (?:true|false))\r?\n( +)\} as ToolAnnotations,/g;

let total = 0;
for (const dir of dirs) {
    for (const file of readdirSync(join(root, dir))) {
        if (!file.endsWith('.ts')) continue;
        const path = join(root, dir, file);
        const source = readFileSync(path, 'utf8');
        const toolName = file.replace(/\.ts$/, '');
        const updated = source.replace(pattern, (match, hints, indent) => {
            total++;
            const eol = match.includes('\r\n') ? '\r\n' : '\n';
            const value = dir.endsWith('/ro') || IDEMPOTENT.has(toolName) ? 'true' : 'false';
            return (
                hints +
                `,${eol}${indent}idempotentHint: ${value},${eol}${indent}openWorldHint: true${eol}${indent}} as ToolAnnotations,`
            );
        });
        if (updated !== source) writeFileSync(path, updated);
    }
}

// Normalize indentation: the inserted hint lines must line up with the
// existing annotation fields (the readOnlyHint line), not with the closing
// brace of the annotations object.
for (const dir of dirs) {
    for (const file of readdirSync(join(root, dir))) {
        if (!file.endsWith('.ts')) continue;
        const path = join(root, dir, file);
        const source = readFileSync(path, 'utf8');
        const fieldIndent = source.match(/^[ \t]*readOnlyHint:/m)?.[0].match(/^[ \t]*/)?.[0];
        if (!fieldIndent) continue;
        const normalized = source.replace(
            /^[ \t]+(idempotentHint: (?:true|false),|openWorldHint: true)$/gm,
            (line, fieldText) => fieldIndent + fieldText
        );
        if (normalized !== source) writeFileSync(path, normalized);
    }
}
console.log(`Annotated ${total} tools`);
