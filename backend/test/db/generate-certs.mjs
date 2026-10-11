#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const certsDir = path.join(here, 'certs');
const certFiles = ['ca.crt', 'ca.key', 'server.crt', 'server.key'];

fs.mkdirSync(certsDir, { recursive: true });

const hasExistingCerts = certFiles.every((file) => fs.existsSync(path.join(certsDir, file)));
if (hasExistingCerts) {
  console.log('Test certificates already exist in test/db/certs');
  process.exit(0);
}

const run = (args) => {
  const result = spawnSync('openssl', args, {
    cwd: certsDir,
    stdio: 'inherit',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  });

  if (result.error) {
    console.error('Failed to invoke openssl:', result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650', '-keyout', 'ca.key', '-out', 'ca.crt', '-subj', '/CN=Andys Coffee Test CA']);
run(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost']);

fs.writeFileSync(path.join(certsDir, 'server.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\n');
run(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '3650', '-extfile', 'server.ext']);

for (const file of ['server.csr', 'server.ext', 'ca.srl']) {
  const filePath = path.join(certsDir, file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

console.log('Test certificates written to test/db/certs');
