import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const toolsDir = join(import.meta.dirname, '..', 'src', 'tools');

const outputSchemas = {
    // Group A: Wrapper tools
    'search': '{\n            total: z.number(),\n            limit: z.number(),\n            keyword: z.string(),\n            results: z.array(z.record(z.unknown()))\n        }',
    'get-all-pages': '{\n            total: z.number(),\n            displayed: z.number(),\n            pages: z.array(z.record(z.unknown())),\n            limit: z.number()\n        }',
    'get-article-categories': '{\n            title: z.string(),\n            categories: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-article-info': '{\n            title: z.string(),\n            results: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-article-properties': '{\n            title: z.string(),\n            properties: z.record(z.unknown())\n        }',
    'get-article-revisions': '{\n            title: z.string(),\n            revisions: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-backlinks': '{\n            target: z.string(),\n            backlinks: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-categories': '{\n            prefix: z.string(),\n            categories: z.array(z.string()),\n            count: z.number()\n        }',
    'get-external-links': '{\n            title: z.string(),\n            links: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-image-info': '{\n            filename: z.string(),\n            info: z.record(z.unknown())\n        }',
    'get-image-usage': '{\n            filename: z.string(),\n            pages: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-images-from-article': '{\n            title: z.string(),\n            images: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-images': '{\n            total: z.number(),\n            limit: z.number(),\n            startFrom: z.string(),\n            images: z.array(z.record(z.unknown()))\n        }',
    'get-log': '{\n            type: z.string(),\n            start: z.string(),\n            limit: z.number(),\n            total: z.number(),\n            displayed: z.number(),\n            entries: z.array(z.record(z.unknown()))\n        }',
    'get-mediawiki-version': '{\n            version: z.string()\n        }',
    'get-pages-by-prefix': '{\n            prefix: z.string(),\n            pages: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-pages-in-category': '{\n            category: z.string(),\n            pages: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-pages-in-namespace': '{\n            namespace: z.number(),\n            pages: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-pages-transcluding': '{\n            template: z.string(),\n            pages: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-query-page': '{\n            name: z.string(),\n            results: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'get-recent-changes': '{\n            total: z.number(),\n            limit: z.number(),\n            start: z.string(),\n            changes: z.array(z.record(z.unknown()))\n        }',
    'get-user-contribs': '{\n            username: z.string(),\n            namespace: z.number(),\n            limit: z.number(),\n            total: z.number(),\n            displayed: z.number(),\n            contributions: z.array(z.record(z.unknown()))\n        }',
    'get-users': '{\n            prefix: z.string(),\n            onlyWithEdits: z.boolean(),\n            users: z.array(z.record(z.unknown())),\n            count: z.number()\n        }',
    'append': '{\n            success: z.boolean(),\n            title: z.string()\n        }',

    // Group B: Pass-through tools
    'get-site-info': 'z.object({}).passthrough()',
    'get-site-stats': 'z.object({}).passthrough()',
    'whoami': 'z.object({}).passthrough()',
    'whoare': 'z.object({}).passthrough()',
    'whois': 'z.object({}).passthrough()',
    'add-flow-topic': 'z.object({}).passthrough()',
    'create-account': 'z.object({}).passthrough()',
    'delete': 'z.object({}).passthrough()',
    'edit': 'z.object({}).passthrough()',
    'move': 'z.object({}).passthrough()',
    'prepend': 'z.object({}).passthrough()',
    'protect': 'z.object({}).passthrough()',
    'purge': 'z.object({}).passthrough()',
    'send-email': 'z.object({}).passthrough()',
    'upload-by-url': 'z.object({}).passthrough()',
    'upload': 'z.object({}).passthrough()',
};

// Skipped files (text output, not JSON)
const skipped = new Set(['get-article.ts', 'expand-templates.ts', 'parse.ts']);

function convertFile(filepath) {
    const filename = filepath.split('/').pop();
    if (skipped.has(filename)) {
        console.log(`SKIP (text output): ${filename}`);
        return;
    }

    let src = readFileSync(filepath, 'utf8');

    if (src.includes('registerTool')) {
        console.log(`SKIP (already converted): ${filename}`);
        return;
    }

    // Extract tool name
    const toolMatch = src.match(/server\.tool\(\s*\n\s*'([^']+)'/);
    if (!toolMatch) {
        console.log(`FAIL (no tool name): ${filename}`);
        return;
    }
    const toolName = toolMatch[1];

    const outputSchema = outputSchemas[toolName];
    if (!outputSchema) {
        console.log(`FAIL (no schema): ${filename} (${toolName})`);
        return;
    }

    // Find the description string
    const descMatch = src.match(/'([^']*)',\s*\n\s*(\{[\s\S]*?\}),\s*\n\s*(\{[\s\S]*?\}\s*as\s+ToolAnnotations),\s*\n\s*(async)/);
    if (!descMatch) {
        // Try simpler pattern for tools with empty params
        const descMatch2 = src.match(/server\.tool\(\s*\n\s*'[^']+',\s*\n\s*'([^']*)'/);
        console.log(`FAIL (no match): ${filename} - desc: ${descMatch2 ? descMatch2[1] : 'unknown'}`);
        return;
    }

    const desc = descMatch[1];
    const paramsStart = src.indexOf(descMatch[2]);
    const paramsEnd = paramsStart + descMatch[2].length;

    const annotationsStart = src.indexOf(descMatch[3]);
    const annotationsEnd = annotationsStart + descMatch[3].length;

    const paramsBlock = src.substring(paramsStart, paramsEnd);
    const annotationsBlock = src.substring(annotationsStart, annotationsEnd);

    // Find handler: async (...) => handleXxxTool(...)
    const handlerMatch = src.match(/async\s*(\([\s\S]*?\))\s*=>\s*([\s\S]*?)\(([\s\S]*?)\);?\s*\n\}/);
    if (!handlerMatch) {
        console.log(`FAIL (no handler): ${filename}`);
        return;
    }

    const handlerArgs = handlerMatch[1];
    const handlerCall = handlerMatch[2].trim();
    const handlerParams = handlerMatch[3].trim();

    // Find the handler function call name
    const handlerFnMatch = handlerCall.match(/(handle\w+Tool)/);
    const handlerFn = handlerFnMatch ? handlerFnMatch[1] : handlerCall;

    // Find description string more precisely
    const beforeParams = src.substring(0, paramsStart);
    const descLineMatch = beforeParams.match(/\n\s*'([^']*)'$/m);
    const description = descLineMatch ? descLineMatch[1] : desc;

    // Build new registerTool call
    const newToolCall = `server.registerTool('${toolName}', {
        description: '${description}',
        inputSchema: ${paramsBlock},
        outputSchema: ${outputSchema},
        annotations: ${annotationsBlock}
    }, ${handlerArgs} => ${handlerFn}(${handlerParams}))`;

    // Find the old server.tool call and replace it
    const toolCallStart = src.indexOf('server.tool(');
    const afterToolCall = src.lastIndexOf(');');
    const oldToolCall = src.substring(toolCallStart, afterToolCall + 2);

    const newSrc = src.replace(oldToolCall, newToolCall);

    // Remove unused ToolAnnotations import if present (it's now inline in annotions block and might cause lint)
    // Actually keep imports as-is

    writeFileSync(filepath, newSrc, 'utf8');
    console.log(`OK: ${filename} (${toolName})`);
}

function processDir(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            processDir(fullPath);
        } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
            convertFile(fullPath);
        }
    }
}

processDir(toolsDir);
console.log('Done.');
