const { spawnSync } = require('child_process');

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/run.js <script> [args...]');
  process.exit(1);
}

const result = spawnSync(process.execPath, [script, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
