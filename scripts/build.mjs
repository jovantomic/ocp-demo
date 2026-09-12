import { cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
const demoOnly = process.argv.includes('--demo-only');
await mkdir('dist', { recursive:true });
for (const [from,to] of [['src/frontend','dist/frontend'],['src/logic','dist/logic'],['data/synthetic','dist/data'],['public/maps','dist/maps'],['data/external','dist/news'],['index.html','dist/index.html']]) await cp(from,to,{recursive:true});
console.log('Built OCP in dist/');
if (demoOnly) {
  // Remove external references even when rebuilding an existing local dist.
  await rm('dist/news', { recursive: true, force: true });
  const manifest = JSON.parse(await readFile('dist/data/manifest.json', 'utf8'));
  await writeFile('dist/data/manifest.json', JSON.stringify({ ...manifest, demo_only: true }, null, 2) + '\n');
  console.log('Demo-only build: external reporting and provider data are excluded.');
}
