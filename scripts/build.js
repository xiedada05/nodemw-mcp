import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const isWatch = process.argv.includes('--watch');

async function build() {
	const opts = {
		entryPoints: [join(projectRoot, 'src', 'index.ts')],
		bundle: true,
		platform: 'node',
		format: 'esm',
		target: ['node18'],
		outfile: join(projectRoot, 'dist', 'index.js'),
		external: [
			'nodemw',
			'@modelcontextprotocol/*',
			'zod',
		],
		banner: {
			js: `#!/usr/bin/env node
/*
 * SPDX-License-Identifier: BSD-2-Clause
 *
 * Copyright (c) 2026 Xie Youtian
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */`,
		},
		minify: true,
		logLevel: 'info',
		treeShaking: true,
		legalComments: 'none',
		sourcemap: true,
	};

	try {
		if (isWatch) {
			const ctx = await esbuild.context(opts);
			await ctx.watch();
			console.log('Watching for changes...');
		} else {
			await esbuild.build(opts);
			console.log('Build complete: dist/index.js');
		}
	} catch (error) {
		console.error('Build failed:', error);
		process.exit(1);
	}
}

build();
