const fs = require('fs');
const c = require('./common');

(async () => {
  try {
    const repository = c.input('repository');
    const key = c.scopedKey(c.input('key'));
    const isPullRequest = process.env.GITHUB_REF?.includes('/pull/');
    if (isPullRequest && String(c.input('allow-pr-cache')).toLowerCase() !== 'true') {
      c.log('untrusted pull request: save skipped');
      return;
    }
    if (isPullRequest) {
      const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      const number = event.pull_request?.number;
      const expectedPrefix = `untrusted/${process.env.GITHUB_REPOSITORY}/pr-${number}/`;
      if (!number || !key.startsWith(expectedPrefix)) {
        throw new Error(`PR cache key must start with ${expectedPrefix}`);
      }
    }

    const trustedKey = key.startsWith('trusted/');
    const untrustedKey = key.startsWith('untrusted/');
    const sharedKey = key.startsWith('shared/');
    const trustedRef = process.env.GITHUB_REF === 'refs/heads/main'
      || process.env.GITHUB_REF_TYPE === 'tag';
    if (!trustedKey && !untrustedKey && !sharedKey) {
      throw new Error('cache key must start with trusted/, untrusted/, or shared/');
    }
    if (trustedKey && !trustedRef) {
      throw new Error('trusted cache keys may only be saved from main or tags');
    }
    if (untrustedKey && !isPullRequest) {
      throw new Error('untrusted cache keys may only be saved from pull requests');
    }
    if (sharedKey && !trustedRef) {
      throw new Error('shared cache keys may only be saved from main or tags');
    }
    const current = await c.refs(repository);
    const existingReference = current.json.references[key];
    if (existingReference?.object) {
      const existingAsset = await c.object(repository, existingReference.object);
      if (!existingAsset) {
        c.log(`orphaned cache reference detected for key=${key}; recreating asset`);
      } else {
        const existingAssetName = existingAsset.name;
        c.log(`cache already exists for key=${key}; asset=${existingAssetName}`);
        if (process.env.GITHUB_OUTPUT) {
          fs.appendFileSync(
            process.env.GITHUB_OUTPUT,
            `content-hash=${existingReference.object}\nasset-name=${existingAssetName}\n`,
          );
        }
        return;
      }
    }
    const archive = await c.makeArchive();
    const hash = c.digest(archive.file);
    const existing = await c.object(repository, hash);
    const name = c.assetName(key, hash);

    if (!existing) {
      const release = (await c.assets(repository)).release;
      try {
        const uploadUrl = release.upload_url.replace(
          '{?name,label}',
          `?name=${encodeURIComponent(name)}`,
        );
        await c.upload(uploadUrl, archive.file, name, 'application/zstd');
        c.log(`uploaded object ${hash}`);
      } catch (error) {
        if (error.status !== 422) throw error;
        c.log(`deduplicated object ${hash}`);
      }
    } else {
      c.log(`object already exists: ${hash}`);
    }

    await c.setRef(repository, key, hash);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `content-hash=${hash}\nasset-name=${existing?.name || name}\ncache-size=${fs.statSync(archive.file).size}\n`,
      );
    }
    console.log(`Cache saved: key=${key}; asset=${existing?.name || name}; content-hash=${hash}`);
  } catch (error) {
    c.fail(error);
  }
})();
