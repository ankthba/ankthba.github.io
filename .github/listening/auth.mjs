// One-time setup for the listening Action. Run from the repository root:
//
//   node .github/listening/auth.mjs
//
// It asks for your Spotify app's Client ID and Client Secret, opens
// Spotify in the browser to approve read access to your recently played
// tracks, and stores all three secrets in the repository with `gh`, so the
// long-lived token is never printed or pasted anywhere. Then it starts
// the first run.
//
// The Spotify app needs this exact Redirect URI:
//   http://127.0.0.1:8888/callback

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import readline from 'node:readline';

const REPO = 'ankthba/ankthba.github.io';
const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'user-read-recently-played';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.startsWith(question)) rl.output.write(s);
        else if (s.includes('\n') || s.includes('\r')) rl.output.write('\n');
        else rl.output.write('*'.repeat(s.length));
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function setSecret(name, value) {
  execFileSync('gh', ['secret', 'set', name, '--repo', REPO], { input: value, stdio: ['pipe', 'ignore', 'inherit'] });
}

const clientId = process.env.SPOTIFY_CLIENT_ID || await ask('Spotify Client ID: ');
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || await ask('Spotify Client Secret: ', { hidden: true });
if (!clientId || !clientSecret) {
  console.error('Both the Client ID and the Client Secret are needed.');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authorize = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  scope: SCOPE,
  redirect_uri: REDIRECT,
  state,
});

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const done = (message) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><title>Spotify</title><p style="font:18px Georgia,serif;margin:3rem">${message}</p>`);
      server.close();
    };
    if (url.searchParams.get('state') !== state) {
      done('That response did not come from this setup. Close this tab and run the script again.');
      reject(new Error('State mismatch'));
    } else if (url.searchParams.get('error')) {
      done('Spotify access was not granted. You can close this tab.');
      reject(new Error(url.searchParams.get('error')));
    } else {
      done('Done. You can close this tab and go back to the terminal.');
      resolve(url.searchParams.get('code'));
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log('\nOpening Spotify to approve access. If nothing opens, visit:\n' + authorize + '\n');
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    spawn(opener, [authorize], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  });
  server.on('error', reject);
});

const res = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT }),
});
if (!res.ok) {
  console.error(`Spotify refused the code: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const { refresh_token: refreshToken } = await res.json();

try {
  setSecret('SPOTIFY_CLIENT_ID', clientId);
  setSecret('SPOTIFY_CLIENT_SECRET', clientSecret);
  setSecret('SPOTIFY_REFRESH_TOKEN', refreshToken);
  console.log(`Saved SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN to ${REPO}.`);
} catch {
  console.error(`\nCouldn't save the secrets with gh. Add these three under ${REPO} > Settings >`);
  console.error('Secrets and variables > Actions instead:\n');
  console.error('  SPOTIFY_CLIENT_ID      ' + clientId);
  console.error('  SPOTIFY_CLIENT_SECRET  (the secret you just entered)');
  console.error('  SPOTIFY_REFRESH_TOKEN  ' + refreshToken + '\n');
  process.exit(1);
}

try {
  execFileSync('gh', ['workflow', 'run', 'listening.yml', '--repo', REPO], { stdio: 'ignore' });
  console.log('Started the first run. The home page picks it up within a few minutes:');
  console.log(`  https://github.com/${REPO}/actions/workflows/listening.yml`);
} catch {
  console.log('Run it by hand once from the Actions tab, or wait for the next hour.');
}
