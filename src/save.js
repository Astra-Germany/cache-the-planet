const fs = require('fs');
const c = require('./common');

(async () => {
  try {
    const repository = c.input('repository');
    const key = c.input('key');
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
    const trustedRef = process.env.GITHUB_REF === 'refs/heads/main'
      || process.env.GITHUB_REF_TYPE === 'tag';
    if (!trustedKey && !untrustedKey) {
      throw new Error('cache key must start with trusted/ or untrusted/');
    }
    if (trustedKey && !trustedRef) {
      throw new Error('trusted cache keys may only be saved from main or tags');
    }
    if (untrustedKey && !isPullRequest) {
      throw new Error('untrusted cache keys may only be saved from pull requests');
    }
    const archive = await c.makeArchive();
    const hash = c.digest(archive.file);
    const assetName = `${hash.slice(7)}.tar.zst`;
    const existing = await c.object(repository, hash);

    if (!existing) {
      const release = (await c.assets(repository)).release;
      try {
        const uploadUrl = release.upload_url.replace(
          '{?name,label}',
          `?name=${encodeURIComponent(assetName)}`,
        );
        await c.upload(uploadUrl, archive.file, assetName, 'application/zstd');
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
        `content-hash=${hash}\nasset-name=${assetName}\ncache-size=${fs.statSync(archive.file).size}\n`,
      );
    }
    console.log(`Cache saved: key=${key}; asset=${assetName}; content-hash=${hash}`);
  } catch (error) {
    c.fail(error);
  }
})();
