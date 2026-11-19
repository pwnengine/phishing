import http from 'node:http';
import {randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const key=process.env.ADMIN_KEY||'';
if(key.length<24)throw Error('Set ADMIN_KEY to a random secret of at least 24 characters.');
const base=process.env.PUBLIC_BASE_URL||'http://127.0.0.1:8080';
const baseUrl=new URL(base);if(baseUrl.pathname!=='/'||baseUrl.search||baseUrl.hash)throw Error('PUBLIC_BASE_URL must be an origin with no path/query.');
const dataDir=process.env.DATA_DIR||path.join(root,'data');mkdirSync(dataDir,{recursive:true});
const dbFile=path.join(dataDir,'campaign.json');
let db=existsSync(dbFile)?JSON.parse(readFileSync(dbFile,'utf8')):{active:true,recipients:[],events:[]};
function save(){writeFileSync(dbFile+'.tmp',JSON.stringify(db),{mode:0o600});renameSync(dbFile+'.tmp',dbFile);}
function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function receipt(t){return createHmac('sha256',key).update(t).digest('hex');}
const mediaDir=process.env.MEDIA_DIR||path.join(root,'public','media');
function mediaReady(){return ['reveal.gif','reveal.mp3'].every(f=>existsSync(path.join(mediaDir,f)));}
function mediaFor(r){return {enabled:r.mediaEnabled===true&&mediaReady(),startSeconds:db.mediaStartSeconds||0};}
function results(){return {active:db.active,recipients:db.recipients.map(r=>{const e=db.events.filter(e=>e.token===r.token);return {...r,url:baseUrl.origin+'/?email='+encodeURIComponent(r.email),visits:e.filter(e=>e.type==='visit').length,submissions:e.filter(e=>e.type==='submit').length,accountFilled:e.filter(e=>e.accountFilled===true).length,passwordFilled:e.filter(e=>e.passwordFilled===true).length,lastEvent:e.at(-1)?.at||null};})};}
async function body(req){if(req.headers['content-type']!=='application/json')throw Error('content');let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>32768)throw Error('size');}return JSON.parse(text);}
function exact(o,keys){return o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
const assets={'/':['index.html','text/html'],'/admin':['admin.html','text/html'],'/style.css':['style.css','text/css'],'/signin.css':['signin.css','text/css'],'/participant.js':['participant.js','text/javascript'],'/admin.js':['admin.js','text/javascript']};
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'");
 const send=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
 try{
 const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(req.method==='GET'&&(p==='/media/reveal.gif'||p==='/media/reveal.mp3')){
 const file=path.join(mediaDir,path.basename(p));if(!existsSync(file))return send(404,{error:'Media not installed'});
 res.writeHead(200,{'Content-Type':p.endsWith('.gif')?'image/gif':'audio/mpeg'});res.end(readFileSync(file));return;
 }
 if(req.method==='GET'&&assets[p]){const [file,type]=assets[p];res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(readFileSync(path.join(root,'public',file)));return;}
 if(!p.startsWith('/api/'))return send(404,{error:'Not found'});
 if(req.headers.origin&&req.headers.origin!==baseUrl.origin)return send(403,{error:'Origin rejected'});
 if(p.startsWith('/api/admin/')){
 if(!equal(req.headers.authorization||'','Bearer '+key))return send(401,{error:'Unauthorized'});
 if(p==='/api/admin/results'&&req.method==='GET')return send(200,{...results(),mediaReady:mediaReady(),mediaStartSeconds:db.mediaStartSeconds||0});
 if(req.method!=='POST')return send(405,{error:'Method'});
 const b=await body(req);
 if(p==='/api/admin/recipients'){
 if(!exact(b,['emails'])||!Array.isArray(b.emails)||b.emails.length>500||b.emails.some(e=>typeof e!=='string'||e.length>254||!/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@nyecc\.org$/i.test(e)))return send(400,{error:'Only @nyecc.org addresses are accepted (maximum 500 per batch)'});
 for(const email of b.emails)if(!db.recipients.some(r=>r.email.toLowerCase()===email.toLowerCase()))db.recipients.push({email,token:randomBytes(24).toString('hex'),expires:new Date(Date.now()+30*86400000).toISOString()});
 }else if(p==='/api/admin/state'){if(!exact(b,['active'])||typeof b.active!=='boolean')return send(400,{error:'Invalid state'});db.active=b.active;}
 else if(p==='/api/admin/media'){
 if(!exact(b,['email','enabled'])||typeof b.email!=='string'||typeof b.enabled!=='boolean')return send(400,{error:'Invalid media preference'});
 const target=db.recipients.find(r=>r.email.toLowerCase()===b.email.toLowerCase());if(!target)return send(404,{error:'Recipient not found'});target.mediaEnabled=b.enabled;
 }else if(p==='/api/admin/media-settings'){
 if(!exact(b,['startSeconds'])||!Number.isFinite(b.startSeconds)||b.startSeconds<0||b.startSeconds>3600)return send(400,{error:'Invalid cue time'});db.mediaStartSeconds=b.startSeconds;
 }
 else return send(404,{error:'Not found'});
 save();return send(200,{...results(),mediaReady:mediaReady(),mediaStartSeconds:db.mediaStartSeconds||0});
 }
 if(req.method!=='POST')return send(405,{error:'Method'});
 const b=await body(req);
 const r=typeof b.email==='string'?db.recipients.find(r=>r.email.toLowerCase()===b.email.toLowerCase()&&r.email.toLowerCase().endsWith('@nyecc.org')):db.recipients.find(r=>r.token===b.token);
 if(!db.active||!r||Date.parse(r.expires)<Date.now())return send(410,{error:'Unavailable'});
 if(p==='/api/visit'&&(exact(b,['token'])||exact(b,['email']))){db.events.push({token:r.token,type:'visit',at:new Date().toISOString()});save();return send(200,{token:r.token,receipt:receipt(r.token),media:mediaFor(r)});}
 if(p==='/api/event'&&exact(b,['token','receipt','accountFilled','passwordFilled'])&&typeof b.receipt==='string'&&equal(b.receipt,receipt(r.token))&&typeof b.accountFilled==='boolean'&&typeof b.passwordFilled==='boolean'){
 db.events.push({token:r.token,type:'submit',at:new Date().toISOString(),accountFilled:b.accountFilled,passwordFilled:b.passwordFilled});save();return send(200,{ok:true,media:mediaFor(r)});
 }
 return send(400,{error:'Invalid event; only boolean field indicators accepted'});
 }catch{return send(400,{error:'Invalid request'});}
});
export {server};
if(process.env.TEST_NO_LISTEN!=='1')server.listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('Campaign server ready. Admin: '+baseUrl.origin+'/admin'));
