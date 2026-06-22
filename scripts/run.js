const { spawnSync } = require('child_process');

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/run.js <script> [args...]');
  process.exit(1);
}

const scriptArgs = process.argv.slice(3);
// Pass on the command line (not NODE_OPTIONS) — required for dsebd.org on Windows and GitHub Actions.
const nodeArgs = ['--use-system-ca', script, ...scriptArgs];

const result = spawnSync(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
