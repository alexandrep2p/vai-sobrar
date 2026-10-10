// Sobe tudo de uma vez: Postgres (docker), migrations, backend e frontend.
// Uso: npm start (na raiz). Ctrl+C encerra backend e frontend.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

const run = (cmd, args, cwd = root) =>
  spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin });

console.log('> Subindo o Postgres (docker compose)...');
let r = run('docker', ['compose', 'up', '-d', '--wait', 'postgres']);
if (r.status !== 0) {
  console.error('Falha ao subir o Postgres. O Docker Desktop está aberto?');
  process.exit(1);
}

console.log('> Aplicando migrations...');
r = run('npx', ['prisma', 'migrate', 'deploy'], resolve(root, 'backend'));
if (r.status !== 0) process.exit(1);

const colors = { backend: '\x1b[36m', frontend: '\x1b[35m' };
const children = [];

function start(name, cwd, script) {
  const child = spawn('npm', ['run', script], { cwd: resolve(root, cwd), shell: isWin });
  const tag = `${colors[name]}[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (d) =>
      out.write(
        String(d)
          .split(/\r?\n/)
          .filter(Boolean)
          .map((l) => tag + l)
          .join('\n') + '\n',
      ),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${tag}encerrou (código ${code})`);
    shutdown(code ?? 0);
  });
  children.push(child);
}

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('> Iniciando backend e frontend... (Ctrl+C para parar)');
start('backend', 'backend', 'dev');
start('frontend', 'frontend', 'start');
