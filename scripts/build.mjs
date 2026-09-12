import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive:true });
for (const [from,to] of [['src/frontend','dist/frontend'],['src/logic','dist/logic'],['data/synthetic','dist/data'],['public/maps','dist/maps'],['data/external','dist/news'],['index.html','dist/index.html']]) await cp(from,to,{recursive:true});
console.log('Built OCP in dist/');
