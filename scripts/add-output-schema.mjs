import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const toolsDir = join(import.meta.dirname, '..', 'src', 'tools');

const outputSchemas = {
    'search':             '{ total: z.number(), limit: z.number(), keyword: z.string(), results: z.array(z.record(z.unknown())) }',
    'get-all-pages':       '{ total: z.number(), displayed: z.number(), pages: z.array(z.record(z.unknown())), limit: z.number() }',
    'get-article-categories': '{ title: z.string(), categories: z.array(z.record(z.unknown())), count: z.number() }',
    'get-article-info':    '{ title: z.string(), results: z.array(z.record(z.unknown())), count: z.number() }',
    'get-article-properties': '{ title: z.string(), properties: z.record(z.unknown()) }',
    'get-article-revisions': '{ title: z.string(), revisions: z.array(z.record(z.unknown())), count: z.number() }',
    'get-backlinks':       '{ target: z.string(), backlinks: z.array(z.record(z.unknown())), count: z.number() }',
    'get-categories':      '{ prefix: z.string(), categories: z.array(z.string()), count: z.number() }',
    'get-external-links':  '{ title: z.string(), links: z.array(z.record(z.unknown())), count: z.number() }',
    'get-image-info':      '{ filename: z.string(), info: z.record(z.unknown()) }',
    'get-image-usage':     '{ filename: z.string(), pages: z.array(z.record(z.unknown())), count: z.number() }',
    'get-images-from-article': '{ title: z.string(), images: z.array(z.record(z.unknown())), count: z.number() }',
    'get-images':          '{ total: z.number(), limit: z.number(), startFrom: z.string(), images: z.array(z.record(z.unknown())) }',
    'get-log':             '{ type: z.string(), start: z.string(), limit: z.number(), total: z.number(), displayed: z.number(), entries: z.array(z.record(z.unknown())) }',
    'get-mediawiki-version': '{ version: z.string() }',
    'get-pages-by-prefix': '{ prefix: z.string(), pages: z.array(z.record(z.unknown())), count: z.number() }',
    'get-pages-in-category': '{ category: z.string(), pages: z.array(z.record(z.unknown())), count: z.number() }',
    'get-pages-in-namespace': '{ namespace: z.number(), pages: z.array(z.record(z.unknown())), count: z.number() }',
    'get-pages-transcluding': '{ template: z.string(), pages: z.array(z.record(z.unknown())), count: z.number() }',
    'get-query-page':      '{ name: z.string(), results: z.array(z.record(z.unknown())), count: z.number() }',
    'get-recent-changes':  '{ total: z.number(), limit: z.number(), start: z.string(), changes: z.array(z.record(z.unknown())) }',
    'get-user-contribs':   '{ username: z.string(), namespace: z.number(), limit: z.number(), total: z.number(), displayed: z.number(), contributions: z.array(z.record(z.unknown())) }',
    'get-users':           '{ prefix: z.string(), onlyWithEdits: z.boolean(), users: z.array(z.record(z.unknown())), count: z.number() }',
    'append':              '{ success: z.boolean(), title: z.string() }',
    'get-site-info':       'z.object({}).passthrough()',
    'get-site-stats':      'z.object({}).passthrough()',
    'whoami':              'z.object({}).passthrough()',
    'whoare':              'z.object({}).passthrough()',
    'whois':               'z.object({}).passthrough()',
    'add-flow-topic':      'z.object({}).passthrough()',
    'create-account':      'z.object({}).passthrough()',
    'delete':              'z.object({}).passthrough()',
    'edit':                'z.object({}).passthrough()',
    'move':                'z.object({}).passthrough()',
    'prepend':             'z.object({}).passthrough()',
    'protect':             'z.object({}).passthrough()',
    'purge':               'z.object({}).passthrough()',
    'send-email':          'z.object({}).passthrough()',
    'upload-by-url':       'z.object({}).passthrough()',
    'upload':              'z.object({}).passthrough()',
};

const skip = new Set(['get-article.ts', 'expand-templates.ts', 'parse.ts']);

function processDir(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fp = join(dir, entry.name);
        if (entry.isDirectory()) { processDir(fp); continue; }
        if (!entry.name.endsWith('.ts') || entry.name === 'index.ts') continue;
        if (skip.has(entry.name)) {
            console.log(`SKIP: ${entry.name}`);
            continue;
        }

        let src = readFileSync(fp, 'utf8');
        if (src.includes('tool.update')) {
            console.log(`SKIP (already done): ${entry.name}`);
            continue;
        }

        // Extract tool name from server.tool('name', ...)
        const nameMatch = src.match(/server\.tool\(\s*\n\s*'([^']+)'/);
        if (!nameMatch) {
            console.log(`FAIL (no name): ${entry.name}`);
            continue;
        }
        const toolName = nameMatch[1];
        const schema = outputSchemas[toolName];
        if (!schema) {
            console.log(`FAIL (no schema): ${entry.name} / ${toolName}`);
            continue;
        }

        // Strategy: replace "return server.tool(" with "const tool = server.tool(",
        // then find the closing ");" of the tool call and add "tool.update(...); return tool;"

        // Find the "return server.tool(" line
        src = src.replace('return server.tool(', 'const tool = server.tool(');

        // The tool() call ends with "\n    );" followed by "\n}" (end of export function)
        // We need to replace the last occurrence of "\n    );" before "\n}" with
        // "\n    );\n    tool.update({ outputSchema: ... });\n    return tool;"

        // Find the closing ); of the tool() call - it's the last one before the final }
        const closingIdx = src.lastIndexOf('\n    );');
        if (closingIdx === -1) {
            console.log(`FAIL (no closing );): ${entry.name}`);
            continue;
        }

        // Verify this is the right ); by checking the next non-empty line is }
        const after = src.substring(closingIdx + 7).trim();
        if (after !== '}' && !after.startsWith('}\n')) {
            // Try indentation with 8 spaces or other variants
            const altIdx = src.lastIndexOf(');');
            if (altIdx === -1) {
                console.log(`FAIL (ambiguous closing): ${entry.name} - after='${after.substring(0,40)}'`);
                continue;
            }
        }

        const before = src.substring(0, closingIdx);
        const afterClosing = src.substring(closingIdx + 7);

        const indent = '    ';
        const updateLine = `${indent}tool.update({ outputSchema: ${schema} });\n${indent}return tool;`;

        src = before + '\n    );' + '\n' + updateLine + afterClosing;

        // Clean up ToolAnnotations import if present (some files import it for annotations typing)
        // Keep it since we still use annotations in the tool call

        writeFileSync(fp, src, 'utf8');
        console.log(`OK: ${entry.name} (${toolName})`);
    }
}

processDir(toolsDir);
console.log('Done.');
