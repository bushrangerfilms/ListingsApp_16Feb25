#!/usr/bin/env node
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { exec } from 'node:child_process';

const CREDS_FILE = '/Users/bushrangerfilms/Documents/Claude/.env.gsc-oauth.json';
const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

const file = JSON.parse(readFileSync(CREDS_FILE, 'utf8'));
const creds = file.installed;

const authUrl = `${creds.auth_uri}?` + new URLSearchParams({
  client_id: creds.client_id,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Auth failed</h1><p>${error}</p>`);
    setTimeout(() => { server.close(); process.exit(1); }, 100);
    return;
  }

  if (!code) {
    res.writeHead(400);
    res.end('Missing ?code parameter');
    return;
  }

  const tokenRes = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>No refresh token returned</h1><pre>${JSON.stringify(tokens, null, 2)}</pre>`);
    console.error('Tokens response:', tokens);
    setTimeout(() => { server.close(); process.exit(1); }, 100);
    return;
  }

  file.installed.refresh_token = tokens.refresh_token;
  writeFileSync(CREDS_FILE, JSON.stringify(file, null, 2));

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<h1>Authorized</h1><p>Refresh token saved. You can close this tab.</p>`);

  console.log('Refresh token saved to', CREDS_FILE);
  setTimeout(() => { server.close(); process.exit(0); }, 500);
});

server.listen(PORT, () => {
  console.log(`Auth server listening on ${REDIRECT_URI}`);
  console.log('Opening browser. If it does not open, visit:');
  console.log(authUrl);
  const cmd = process.platform === 'darwin' ? 'open' :
              process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${authUrl.replace(/"/g, '\\"')}"`);
});

setTimeout(() => {
  console.error('Timed out waiting for OAuth callback');
  server.close();
  process.exit(1);
}, 5 * 60 * 1000);
