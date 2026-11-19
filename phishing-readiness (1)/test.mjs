import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
test('campaign attribution, credential exclusion, access control and pause',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'readiness-'));
 const key='test-only-secret-012345678901234567890';
 Object.assign(process.env,{ADMIN_KEY:key,DATA_DIR:dir,MEDIA_DIR:dir,TEST_NO_LISTEN:'1',PUBLIC_BASE_URL:'http://127.0.0.1:8080'});
 const {server}=await import('./server.mjs');
 const request=(url,body,auth=false,origin=null)=>new Promise(resolve=>{
 const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{url,method:body?'POST':'GET',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+key}:{}),...(origin?{origin}:{})}});
 const headers={};let code;const res={setHeader(k,v){headers[k.toLowerCase()]=v;},writeHead(c,h){code=c;for(const [k,v] of Object.entries(h))headers[k.toLowerCase()]=v;},end(text){resolve({status:code,headers,text:String(text),json:()=>JSON.parse(text)});}};
 server.emit('request',req,res);
 });
 try{
 assert.equal((await request('/api/admin/results')).status,401);
 assert.equal((await request('/api/admin/recipients',{emails:['outsider@example.org']},true)).status,400);
 let r=await request('/api/admin/recipients',{emails:['alice@nyecc.org','bob@nyecc.org']},true);assert.equal(r.status,200);
 let data=r.json();assert.equal(data.recipients.length,2);const [alice,bob]=data.recipients;assert.notEqual(alice.token,bob.token);assert.equal(new URL(alice.url).searchParams.get("email"),alice.email);
 r=await request('/api/visit',{email:'ALICE@NYECC.ORG'});assert.equal(r.status,200);const {receipt}=r.json();
 r=await request('/api/event',{token:alice.token,receipt,accountFilled:true,passwordFilled:true});assert.equal(r.status,200);
 assert.equal(r.json().media.enabled,false);
 assert.equal((await request('/api/admin/media',{email:'ALICE@NYECC.ORG',enabled:true})).status,401);
 assert.equal((await request('/api/admin/media',{email:'ALICE@NYECC.ORG',enabled:true},true)).status,200);
 assert.equal((await request('/api/admin/media-settings',{startSeconds:42.5},true)).status,200);
 assert.equal((await request('/api/admin/media-settings',{startSeconds:-1},true)).status,400);
 assert.equal((await request('/api/visit',{email:alice.email})).json().media.enabled,false);
 writeFileSync(path.join(dir,'reveal.gif'),'test-gif');writeFileSync(path.join(dir,'reveal.mp3'),'test-mp3');
 const mediaVisit=await request('/api/visit',{email:alice.email});assert.equal(mediaVisit.json().media.enabled,true);assert.equal(mediaVisit.json().media.startSeconds,42.5);
 assert.equal((await request('/api/visit',{email:bob.email})).json().media.enabled,false);
 assert.equal((await request('/media/reveal.mp3')).headers['content-type'],'audio/mpeg');
 assert.equal((await request('/api/admin/media',{email:alice.email,enabled:false},true)).status,200);
 assert.equal((await request('/api/visit',{email:alice.email})).json().media.enabled,false);
 r=await request('/api/event',{token:alice.token,receipt,accountFilled:true,passwordFilled:true,password:'SENTINEL_DO_NOT_STORE'});assert.equal(r.status,400);
 data=(await request('/api/admin/results',null,true)).json();assert.equal(data.recipients[0].visits,4);assert.equal(data.recipients[0].submissions,1);assert.equal(data.recipients[0].passwordFilled,1);assert.equal(data.recipients[1].submissions,0);
 assert(!readFileSync(path.join(dir,'campaign.json'),'utf8').includes('SENTINEL_DO_NOT_STORE'));
 assert.equal((await request('/api/visit',{token:'bogus'})).status,410);
 assert.equal((await request('/api/visit',{email:'unlisted@nyecc.org'})).status,410);
 await request('/api/admin/state',{active:false},true);assert.equal((await request('/api/visit',{token:alice.token})).status,410);
 r=await request('/');assert(!/name="(?:password|account)"/.test(r.text));assert.match(r.headers['content-security-policy'],/form-action 'none'/);
 assert.equal((await request('/api/admin/state',{active:true},true,'https://other.example')).status,403);
 }finally{server.close();rmSync(dir,{recursive:true,force:true});}
});

test('slide uses unique recipients, correct denominator, and no staff names',async()=>{
 const {runInNewContext}=await import('node:vm');
 const nodes=new Map(),text=[],downloads=[];
 const context={fillRect(){},fillText(t){text.push(t);}};
 const canvas={getContext:()=>context,toBlob:cb=>cb(new Blob(['png']))};
 const document={querySelector(s){if(!nodes.has(s))nodes.set(s,{value:'admin-key',textContent:'',replaceChildren(){},append(){}});return nodes.get(s);},createElement(tag){if(tag==='canvas')return canvas;return {setAttribute(){},append(){},click(){if(this.download)downloads.push(this.download);}};}};
 const data={active:true,recipients:[{email:'a@nyecc.org',url:'https://test/?email=a',visits:7,submissions:3,accountFilled:3,passwordFilled:0},{email:'b@nyecc.org',url:'https://test/?email=b',visits:0,submissions:0,accountFilled:0,passwordFilled:0}]};
 runInNewContext(readFileSync(new URL('./public/admin.js',import.meta.url),'utf8'),{document,fetch:async()=>({ok:true,json:async()=>data}),URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,Date,setTimeout:fn=>fn()});
 await nodes.get('#slide').onclick();
 assert.equal(canvas.width,1920);assert.equal(canvas.height,1080);
 assert.equal(text.filter(t=>t==='1 / 2  (50.0%)').length,3);
 assert(text.includes('0 / 2  (0.0%)'));assert(!text.some(t=>t.includes('a@nyecc.org')));
 assert(downloads[0].endsWith('.png'));
});

