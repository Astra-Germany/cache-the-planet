const fs = require('fs');
const c = require('./common');

(async () => {
  try {
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

    const repository = c.input('repository');
    const key = c.input('key');
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
        `content-hash=${hash}\ncache-size=${fs.statSync(archive.file).size}\n`,
      );
    }
    console.log(`Cache saved: ${key} -> ${hash}`);
  } catch (error) {
    c.fail(error);
  }
})();
