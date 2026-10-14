import {readFile,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const UPSTREAM_SHA256='8e3397ce13f461b47aed43a018f1bfe2a3129428488386eda70e5d679d1457c9';
const replacements=[
  ['if(resource.length===0)continue;permissions.push({action:"tool",resource,effect:"deny"})','if(resource.length===0||tools[resource]!==false)continue;permissions.push({action:"tool",resource,effect:"deny"})'],
  ['for(let name of Object.keys(tools))if(Object.hasOwn(typed.tools,name))delete typed.tools[name],deleted+=1;','for(let name of Object.keys(tools))if(tools[name]===false&&Object.hasOwn(typed.tools,name))delete typed.tools[name],deleted+=1;'],
  ['if(classification.needsErrorLookup||recordedError!==void 0)return','if(classification.needsErrorLookup||(recordedError!==void 0&&classification.outcome!=="succeeded"))return'],
  ['outcome=idleOutcome(entries2);return{outcome,texts,model:assistantEntries','outcome=idleOutcome(entries2.slice(lastUserIndex+1));return{outcome,texts,model:assistantEntries'],
];
export function adaptSource(source) {
  if(createHash('sha256').update(source).digest('hex')!==UPSTREAM_SHA256) throw new Error('Unsupported Swarm bundle: verify compatibility before upgrading');
  for(const [before,after] of replacements) {
    if(source.split(before).length!==2) throw new Error('Swarm compatibility anchor changed');
    source=source.replace(before,after);
  }
  return source+'\n// Mi.agents private compatibility entry, MIT; original Swarm remains intact.\nexport const miRouterCompat=Object.freeze({readOnlyToolsToV2Permissions,makeV2SessionContextHandler,buildTranslatedPromptData,classifyContextEntries});\n';
}
export async function loadSwarm() {
  const original=fileURLToPath(new URL('../node_modules/opencode-swarm/dist/index.js',import.meta.url));
  for(const folder of [path.dirname(original),path.join(path.dirname(original),'..')]) if((await lstat(folder)).isSymbolicLink()) throw new Error('Linked Swarm dependency refused; install a private local copy');
  const pkg=JSON.parse(await readFile(path.join(path.dirname(original),'../package.json'),'utf8'));
  if(pkg.version!=='7.197.1') throw new Error('Swarm 7.197.1 required');
  const adapted=adaptSource(await readFile(original,'utf8'));
  const generated=path.join(path.dirname(original),'index.mi-router.mjs');
  let current;try{current=await readFile(generated,'utf8');}catch(e){if(e.code!=='ENOENT') throw e;}
  // Generated sibling preserves upstream asset/relative import paths. It is
  // never the shared npm cache, never the package's original entry point.
  if(current!==adapted) {
    const temp=generated+'.'+randomUUID()+'.tmp';
    try {
      await writeFile(temp,adapted,{mode:0o600,flag:'wx'});
      for(let attempt=0;;attempt++) {
        try{await rename(temp,generated);break;}
        catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=8) throw e;await delay(25*(attempt+1));}
      }
    } finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT') throw e;});}
  }
  return import(pathToFileURL(generated).href+'?compat='+createHash('sha256').update(adapted).digest('hex'));
}
