import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-15',d1Databases:['DB']});
const db=await mf.getD1Database('DB');
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+file,'utf8');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement).run();}
globalThis.__testEnv={DB:db};
const bundle=await build({entryPoints:['app/api/[...path]/route.ts'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__testEnv;'}));}}]});
const route=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let sent=[];let upstreamStatus=200;let emptyResponse=false;const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const request=input instanceof Request?input:new Request(input,options);
 if(request.url.includes('/chat/completions')){
  sent.push({body:await request.json(),authorization:request.headers.get('authorization')});
  if(upstreamStatus!==200)return new Response('<html>Provider failure: test-key</html>',{status:upstreamStatus,headers:{'Content-Type':'text/html'}});
  return Response.json({id:'gen-test',object:'chat.completion',created:Math.floor(Date.now()/1000),model:'test/resolved-model',system_fingerprint:null,choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:emptyResponse?'':'Тестовый ответ '+sent.length}}]});
 }
 return originalFetch(input,options);
};
const request=(method,path,body,cookie,origin='https://test.local')=>new Request('https://test.local/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const post=(p,b,c,o)=>route.POST(request('POST',p,b,c,o));const get=(p,c)=>route.GET(request('GET',p,null,c));
try{
 assert.equal((await get('/chats')).status,401);
 assert.equal((await post('/auth/register',{email:'bad',password:'short'})).status,400);
 assert.equal((await post('/auth/register',{},null,'https://evil.local')).status,403);
 const r=await post('/auth/register',{email:'test-a@example.test',password:'disposable-local-test',name:'Tester A'});assert.equal(r.status,200);const a=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 const s=await post('/auth/register',{email:'test-b@example.test',password:'disposable-local-test',name:'Tester B'});const b=s.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('/chat',{content:'Без ключа',model:'openrouter/free'},a)).status,402);
 const first=await post('/chat',{content:'Запомни: мой проект allAI',model:'provider/first',apiKey:'test-key'},a);assert.equal(first.status,200);const id=(await first.json()).chatId;
 const second=await post('/chat',{chatId:id,content:'Как называется проект?',model:'provider/second',apiKey:'test-key'},a);assert.equal(second.status,200);
 assert.equal(sent[1].body.model,'provider/second');assert.deepEqual(sent[1].body.messages.map(m=>m.role),['user','assistant','user']);assert.equal(sent[1].body.messages[0].content,'Запомни: мой проект allAI');assert.equal(sent[1].authorization,'Bearer test-key');assert.equal(sent[1].body.max_tokens,4096);
 assert.equal((await get('/chats/'+id,b)).status,404);assert.equal((await post('/chat',{chatId:id,content:'Чужой чат',apiKey:'test-key'},b)).status,404);
 const history=await (await get('/chats/'+id,a)).json();assert.equal(history.messages.length,4);
 for(const status of [401,402,403,404,429,500]){
  upstreamStatus=status;
  const failure=await post('/chat',{chatId:id,content:'Ошибка провайдера',model:'provider/second',apiKey:'test-key'},a);
  assert.equal(failure.status,status);assert.ok(!(await failure.text()).includes('test-key'));
 }
 upstreamStatus=200;emptyResponse=true;
 assert.equal((await post('/chat',{chatId:id,content:'Пустой ответ',apiKey:'test-key'},a)).status,502);
 emptyResponse=false;
 assert.equal((await (await get('/chats/'+id,a)).json()).messages.length,4,'Failed requests must not corrupt history');
 globalThis.__testEnv.OPENROUTER_API_KEY='server-test-key';
 assert.equal((await (await get('/me',a)).json()).free,true);
 assert.equal((await post('/chat',{content:'Ключ из окружения',model:'openrouter/free'},a)).status,200);
 assert.equal(sent.at(-1).authorization,'Bearer server-test-key');
 assert.equal(sent.at(-1).body.model,'openrouter/free');
 delete globalThis.__testEnv.OPENROUTER_API_KEY;
 await post('/chats/delete',{id},b);assert.equal((await get('/chats/'+id,a)).status,200);
 assert.equal((await post('/community',{content:'Привет, тестовая комната'},a)).status,200);assert.equal((await (await get('/community',b)).json()).messages.length,1);
 assert.equal((await post('/community',{content:'Слишком быстро'},a)).status,429);
 await post('/auth/logout',{},a);assert.equal((await get('/chats',a)).status,401);
 const login=await post('/auth/login',{email:'test-a@example.test',password:'disposable-local-test'});assert.equal(login.status,200);
 assert.equal((await post('/auth/login',{email:'test-a@example.test',password:'incorrect-password'})).status,401);
 console.log('PASS: official OpenRouter SDK request, model slugs, environment key, 401/402/403/404/429/500 errors, empty replies, secret redaction, history integrity, auth, CSRF, persistence, model switching, user isolation, community, logout. Provider calls mocked; no real AI request made.');
}finally{globalThis.fetch=originalFetch;delete globalThis.__testEnv;await mf.dispose();}
