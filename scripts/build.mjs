import './restore-media.mjs';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import ts from 'typescript';
import { readFile,writeFile,cp,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const name of ['validation','xlsx','qrcodegen','admin','feedback','exhibition-model','mp4-inspect']){let source=await readFile(path.join(root,'src',name+'.ts'),'utf8');if(name==='exhibition-model')source=source.replace("import initial from './exhibition.json';","import {readFileSync} from 'node:fs'; import initialPath from 'node:path'; import {fileURLToPath} from 'node:url'; const initial=JSON.parse(readFileSync(initialPath.join(initialPath.dirname(fileURLToPath(import.meta.url)),'../src/exhibition.json'),'utf8'));");const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,removeComments:false}});await writeFile(path.join(root,'runtime',name+'.mjs'),result.outputText);}
const temp=await mkdtemp(path.join(tmpdir(),'fenghua-build-assets-'));await cp(path.join(root,'dist/assets'),path.join(temp,'assets'),{recursive:true,filter:src=>!/^index-.*\.(js|css)$/.test(path.basename(src))});for(const item of ['favicon.svg','manifest.webmanifest'])await cp(path.join(root,'dist',item),path.join(temp,item));
try{await build({root,publicDir:temp,configFile:false,plugins:[react()],build:{target:['chrome90','safari15'],outDir:'dist',emptyOutDir:true,sourcemap:false},server:{host:'127.0.0.1'}});}finally{await rm(temp,{recursive:true,force:true})}
