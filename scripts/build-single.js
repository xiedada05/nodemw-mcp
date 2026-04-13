import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function buildSingle() {
  try {
    console.log('Building single file bundle...');
    
    const result = await esbuild.build({
      entryPoints: [join(projectRoot, 'src', 'index.ts')],
      bundle: true,
      minify: true,
      sourcemap: true,
      platform: 'node',
      format: 'esm',
      target: ['node18'],
      outfile: join(projectRoot, 'dist-bundle', 'index.js'),
      external: [
        // Only exclude Node.js built-in modules
        // All npm dependencies will be bundled
        'node:fs', 'fs',
        'node:path', 'path',
        'node:url', 'url',
        'node:util', 'util',
        'node:stream', 'stream',
        'node:events', 'events',
        'node:http', 'http',
        'node:https', 'https',
        'node:os', 'os',
        'node:child_process', 'child_process',
        'node:process', 'process',
        'node:crypto', 'crypto',
        'node:zlib', 'zlib',
        'node:buffer', 'buffer',
        'node:querystring', 'querystring',
        'node:net', 'net',
        'node:tls', 'tls',
        'node:dns', 'dns',
        'node:vm', 'vm',
      ],
      banner: {
        js: `// nodemw-mcp-server bundled version\n// Generated: ${new Date().toISOString()}\n`
      },
      logLevel: 'info',
      treeShaking: true,
      legalComments: 'none',
    });

    console.log(`✅ Bundle created at: ${join(projectRoot, 'dist-bundle', 'index.js')}`);
    console.log(`📦 Bundle size: ${(result.metafile?.outputs[join(projectRoot, 'dist-bundle', 'index.js')]?.bytes || 0) / 1024} KB`);
    
    if (result.metafile) {
      const metaPath = join(projectRoot, 'dist-bundle', 'meta.json');
      await import('fs').then(fs => 
        fs.writeFileSync(metaPath, JSON.stringify(result.metafile, null, 2))
      );
      console.log(`📊 Metadata written to: ${metaPath}`);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildSingle();