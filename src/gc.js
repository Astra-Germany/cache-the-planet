const c = require('./common');

(async () => {
  try {
    const repository = process.env.CACHE_REPOSITORY || c.input('repository');
    const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN !== 'false';
    const gracePeriod = Number(process.env.GRACE_DAYS || 7) * 86400000;
    const manifest = await c.refs(repository);
    const liveObjects = new Set(
      Object.values(manifest.json.references).map((reference) => reference.object),
    );
    const allAssets = (await c.assets(repository)).assets;
    const now = Date.now();

    for (const asset of allAssets.filter((item) => item.name.endsWith('.tar.zst'))) {
      const hash = `sha256:${asset.name.slice(0, -8)}`;
      const oldEnough = now - new Date(asset.created_at).getTime() > gracePeriod;
      if (!liveObjects.has(hash) && oldEnough) {
        console.log(`${dryRun ? 'would delete' : 'delete'} ${asset.name}`);
        if (!dryRun) {
          await c.gh(`/repos/${repository}/releases/assets/${asset.id}`, { method: 'DELETE' });
        }
      }
    }
  } catch (error) {
    c.fail(error);
  }
})();
