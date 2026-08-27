const c = require('./common');

(async () => {
  try {
    const repository = process.env.CACHE_REPOSITORY || c.input('repository');
    const sourceRepository = process.env.PR_REPOSITORY;
    const number = process.env.PR_NUMBER;
    if (!repository || !sourceRepository || !number) {
      throw new Error('CACHE_REPOSITORY, PR_REPOSITORY and PR_NUMBER are required');
    }
    const prefix = `untrusted/${sourceRepository}/pr-${number}/`;
    const current = await c.refs(repository);
    const removed = Object.entries(current.json.references).filter(([key]) => key.startsWith(prefix));
    for (const [key] of removed) delete current.json.references[key];
    if (removed.length) {
      await c.gh(`/repos/${repository}/contents/manifests/references-v1.json`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `cache: remove closed PR ${sourceRepository}#${number}`,
          content: Buffer.from(`${JSON.stringify(current.json, null, 2)}\n`).toString('base64'),
          ...(current.sha ? { sha: current.sha } : {}), branch: 'main',
        }),
      });
    }
    const live = new Set(Object.values(current.json.references).map((reference) => reference.object));
    const assets = (await c.assets(repository)).assets;
    for (const asset of assets.filter((item) => item.name.endsWith('.tar.zst'))) {
      const hash = `sha256:${asset.name.slice(0, -8)}`;
      if (!live.has(hash) && removed.some(([, reference]) => reference.object === hash)) {
        await c.gh(`/repos/${repository}/releases/assets/${asset.id}`, { method: 'DELETE' });
        console.log(`deleted PR cache asset ${asset.name}`);
      }
    }
    console.log(`removed ${removed.length} references for ${sourceRepository}#${number}`);
  } catch (error) { c.fail(error); }
})();
