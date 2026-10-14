export function host() {
  const data=new Map(),sessions=new Map(),hooks={},switches=[],prompts=[],interrupts=[];
  const ctx={location:{directory:process.cwd()},app:{version:'2.0.29'},options:{},
    storage:{async get(k){return structuredClone(data.get(k));},async set(k,v){data.set(k,structuredClone(v));}},
    integration:{connection:{async active(){return {type:'credential',id:'oauth',method:'oauth'};},async resolve(){return {type:'oauth',access:'secret',methodID:'chatgpt-token-sharing'};}}},
    session:{async get({sessionID}){return sessions.get(sessionID)??{id:sessionID,agent:'mi-router',location:{directory:process.cwd()},permissions:[],tokens:{input:0,output:0,cache:{read:0,write:0}}};},
      async switchModel(v){switches.push(v);},async switchAgent(v){switches.push(v);},
      async prompt(v){prompts.push(v);},async wait(){return {outcome:'succeeded'};},async interrupt(v){interrupts.push(v);},
      async hook(name,fn){(hooks[name]??=[]).push(fn);return {dispose:async()=>{}};},
      async synthetic(){},async context(){return [];},async create(v){return {id:'child',...v};}},
    tool:{async transform(){return {dispose:async()=>{}};},async hook(){return {dispose:async()=>{}};}},
    agent:{async transform(){return {dispose:async()=>{}};},async get(){return {permissions:[]};}},
    command:{async transform(){return {dispose:async()=>{}};}},
    provider:{async transform(){return {dispose:async()=>{}};}},
    permission:{async hook(){return {dispose:async()=>{}};}},
    model:{async list(){return [];}},
  };
  return {ctx,data,sessions,hooks,switches,prompts,interrupts};
}
