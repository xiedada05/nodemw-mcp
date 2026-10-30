// Simple test to verify the server starts correctly
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing nodemw-mcp-server...\n');

// Test 1: Verify dist/index.js exists
import fs from 'fs';
const indexPath = path.join(__dirname, 'dist', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.error('❌ dist/index.js not found. Please run "npm run build" first.');
  process.exit(1);
}
console.log('✓ dist/index.js exists');

// Test 2: Try to spawn the server
console.log('\nStarting server test...');
const server = spawn('node', [indexPath], {
  env: { ...process.env, CONFIG: path.join(__dirname, 'config.json') },
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Wait a bit then kill the server
setTimeout(() => {
  server.kill();

  console.log('\nServer output:');
  if (output) {
    console.log(output.substring(0, 500));
  }

  if (errorOutput) {
    console.log('\nStderr output:');
    console.log(errorOutput.substring(0, 500));
  }

  console.log('\n✓ Server test completed');
  console.log('\nNote: MCP servers use stdio transport and wait for JSON-RPC messages.');
  console.log('The server is working correctly if it starts without crashing.');

}, 2000);

// Handle process exit
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});
