const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cp = require('child_process');

const apiVersion = '2022-11-28';

function input(name, defaultValue = '') {
  const variable = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  return process.env[variable] ?? defaultValue;
}

function token() {
  return input('token') || process.env.GITHUB_TOKEN || process.env.ACTIONS_RUNTIME_TOKEN;
}

function log(message) {
  console.log(`::notice::${message}`);
}

function fail(error) {
  if (String(input('strict')).toLowerCase() !== 'true') {
    console.log(`::warning::cache ignored: ${error.message || error}`);
    return false;
  }
  throw error;
}

async function gh(url, options = {}) {
  const response = await fetch(`https://api.github.com${url}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': apiVersion,
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) {
    const error = new Error(`${response.status} ${body.message || text}`);
    error.status = response.status;
    error.headers = response.headers;
    throw error;
  }
  return { body, headers: response.headers };
}

async function upload(url, file, name, contentType) {
  const bytes = fs.readFileSync(file);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': contentType,
      'Content-Length': bytes.length,
      'X-GitHub-Api-Version': apiVersion,
    },
    body: bytes,
  });
  if (response.ok) return JSON.parse(await response.text());
  const error = new Error(`${response.status} ${await response.text()}`);
  error.status = response.status;
  throw error;
}

function run(command, args) {
  return cp.execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function have(command) {
  try { run(command, ['--version']); return true; } catch { return false; }
}

function entries() {
  return input('path').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

// Cache inputs are treated as untrusted. Refuse obvious credentials before tar
// ever sees them, and refuse symlinks so an apparently harmless cache path
// cannot unexpectedly include data outside the workspace.
const sensitiveName = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.git-credentials|credentials?(?:[._-].*)?|id_(?:rsa|dsa|ecdsa|ed25519))$/i;
const sensitiveKeywordName = /(^|[-_.])(secret|secrets|token|tokens|password|passwd)([-_.]|$)|\.(key|p12|pfx)$/i;
const sourceFileName = /\.(?:py|js|mjs|cjs|ts|tsx|java|go|rs|c|cc|cpp|h|hpp|rb|php|cs|swift|kt|kts|scala|sh)$/i;
const binaryFileName = /\.(?:7z|aar|bin|class|dll|dylib|exe|gz|iso|jar|jpeg|jpg|so|tar|tgz|war|webp|zip|zst)$/i;
const packageMetadataPath = /(?:^|[\\/])[^\\/]+\.(?:dist-info|egg-info)(?:[\\/]|$)/i;
const sensitiveDirectory = /(^|[\\/])(?:\.ssh|\.aws|\.docker|\.kube)(?:[\\/]|$)/i;
const privateKeyContent = /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i;
const knownTokenContent = /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/i;
const credentialAssignment = /(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*(?:"[^"\r\n]{8,}"|'[^'\r\n]{8,}'|[A-Za-z0-9_+/=.-]{20,})/i;

function securityScan(root) {
  const walk = (file) => {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) {
      const target = path.resolve(path.dirname(file), fs.readlinkSync(file));
      const targetRelative = path.relative(root, target);
      if (path.isAbsolute(targetRelative) || targetRelative === '..'
        || targetRelative.startsWith(`..${path.sep}`)) {
        throw new Error(`cache path contains an external symlink: ${path.relative(process.cwd(), file)}`);
      }
      return;
    }
    const relative = path.relative(root, file);
    if (sensitiveDirectory.test(relative)
      || sensitiveName.test(path.basename(file))
      || (sensitiveKeywordName.test(path.basename(file)) && !sourceFileName.test(path.basename(file)))) {
      throw new Error(`cache path contains a sensitive-looking file: ${path.relative(process.cwd(), file)}`);
    }
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(file)) walk(path.join(file, child));
    } else if (stat.isFile() && stat.size <= 1024 * 1024 && !binaryFileName.test(file)) {
      const content = fs.readFileSync(file);
      if (content.includes(0)) return;
      const text = content.toString('utf8');
      const sourceOrMetadata = sourceFileName.test(file) || packageMetadataPath.test(file);
      if (privateKeyContent.test(text)
        || (!sourceOrMetadata && (knownTokenContent.test(text) || credentialAssignment.test(text)))) {
        throw new Error(`cache path contains credential-like content: ${path.relative(process.cwd(), file)}`);
      }
    }
  };
  walk(root);
}

async function makeArchive() {
  if (!have('tar') || !have('zstd')) throw new Error('tar and zstd are required on the runner');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cac-'));
  const output = path.join(directory, 'object.tar.zst');
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const paths = [];
  for (const value of entries()) {
    const absolute = path.resolve(workspace, value);
    const relative = path.relative(workspace, absolute);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
      throw new Error(`cache path must be inside the workspace: ${value}`);
    }
    if (fs.existsSync(absolute)) {
      securityScan(absolute);
      paths.push(relative || '.');
    }
    else log(`cache path missing: ${value}`);
  }
  if (!paths.length) throw new Error('no cache paths exist');
  const excludes = input('exclude').split(/\r?\n/).map((value) => value.trim())
    .filter(Boolean).flatMap((value) => ['--exclude', value]);
  const tar = cp.spawn('tar', [
    '--sort=name', '--mtime=UTC 1970-01-01', '--owner=0', '--group=0',
    '--numeric-owner', '--dereference', '--format=gnu', '-cf', '-', ...excludes, '-C', workspace, ...paths,
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  const zstd = cp.spawn('zstd', ['-q', `-${input('compression-level', '3')}`, '-o', output], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  tar.stdout.pipe(zstd.stdin);
  await Promise.all([
    new Promise((resolve, reject) => {
      tar.once('error', reject);
      tar.once('close', (code) => code === 0 ? resolve() : reject(new Error('tar failed')));
    }),
    new Promise((resolve, reject) => {
      zstd.once('error', reject);
      zstd.once('close', (code) => code === 0 ? resolve() : reject(new Error('zstd failed')));
    }),
  ]);
  validateArchive(output);
  return { file: output, dir: directory };
}

function validateArchive(file) {
  const tarFile = path.join(path.dirname(file), 'validation.tar');
  const decompression = cp.spawnSync('zstd', ['-q', '-d', '-f', file, '-o', tarFile], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (decompression.status) throw new Error('created zstd archive cannot be decompressed');
  const listing = cp.spawnSync('tar', ['-tf', tarFile], { encoding: 'utf8' });
  if (listing.status) {
    throw new Error(`created tar archive is invalid: ${listing.stderr || 'tar listing failed'}`);
  }
}

function digest(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return `sha256:${hash.digest('hex')}`;
}

async function release(repository) {
  try { return (await gh(`/repos/${repository}/releases/tags/cache-v1`)).body; }
  catch (error) {
    if (error.status !== 404) throw error;
    return (await gh(`/repos/${repository}/releases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: 'cache-v1', name: 'Cache objects (v1)', prerelease: true }),
    })).body;
  }
}

async function assets(repository) {
  const cacheRelease = await release(repository);
  return {
    release: cacheRelease,
    assets: (await gh(`/repos/${repository}/releases/${cacheRelease.id}/assets?per_page=100`)).body,
  };
}

async function object(repository, hash) {
  const result = await assets(repository);
  return result.assets.find((asset) => asset.name === `${hash.slice(7)}.tar.zst`);
}

async function manifest(repository) {
  const result = await gh(`/repos/${repository}/contents/manifests/references-v1.json`);
  return { json: JSON.parse(Buffer.from(result.body.content, 'base64').toString()), sha: result.body.sha };
}

async function refs(repository) {
  try { return await manifest(repository); }
  catch (error) {
    if (error.status !== 404) throw error;
    return { json: { schema_version: 1, references: {} }, sha: null };
  }
}

async function setRef(repository, key, hash) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await refs(repository);
    current.json.references[key] = { object: hash, updated_at: new Date().toISOString() };
    try {
      await gh(`/repos/${repository}/contents/manifests/references-v1.json`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `cache: update ${key}`,
          content: Buffer.from(`${JSON.stringify(current.json, null, 2)}\n`).toString('base64'),
          ...(current.sha ? { sha: current.sha } : {}), branch: 'main',
        }),
      });
      return;
    } catch (error) { if (error.status !== 409) throw error; }
  }
  throw new Error('reference update conflicted after retries');
}

async function download(repository, hash) {
  const asset = await object(repository, hash);
  if (!asset) throw new Error(`object ${hash} not found`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-'));
  const file = path.join(directory, asset.name);
  const response = await fetch(asset.browser_download_url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  if (digest(file) !== hash) throw new Error('integrity check failed: sha256 mismatch');
  return file;
}

function extract(file) {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const tarFile = path.join(path.dirname(file), 'object.tar');
  const decompression = cp.spawnSync('zstd', ['-q', '-d', '-f', file, '-o', tarFile], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (decompression.status) throw new Error('zstd decompression failed');
  const listing = cp.spawnSync('tar', ['-tf', tarFile], { encoding: 'utf8' });
  if (listing.status) throw new Error(`invalid tar archive: ${listing.stderr || 'tar listing failed'}`);
  for (const name of listing.stdout.split(/\r?\n/).filter(Boolean)) {
    if (path.isAbsolute(name) || name.split('/').includes('..') || name.split('\\').includes('..')) {
      throw new Error('unsafe archive path');
    }
  }
  const extraction = cp.spawnSync('tar', [
    '--extract', '--file', tarFile, '--directory', workspace,
    '--no-same-owner', '--no-same-permissions',
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (extraction.status) throw new Error('tar extraction failed');
}

module.exports = {
  input, token, log, fail, gh, upload, entries, securityScan, makeArchive, digest,
  release, assets, object, refs, setRef, download, extract,
};
