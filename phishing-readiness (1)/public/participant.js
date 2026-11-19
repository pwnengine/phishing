const params=new URLSearchParams(location.search),email=params.get('email'),legacyToken=params.get('t');
let token=legacyToken;
const form=document.querySelector('form'),account=document.querySelector('#account'),secret=document.querySelector('#secret'),status=document.querySelector('#status'),button=document.querySelector('button');
// Inputs have no name attributes. Their text never enters a request, URL, log or storage.
// Disable submission even if JavaScript has not finished validating the campaign.
let ready=false,receipt=null,mediaEnabled=false;
function revealMedia(config){
 const overlay=document.createElement('section');overlay.className='media-reveal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Phishing training reveal');
 const image=document.createElement('img');image.src='/media/reveal.gif';image.alt='Dancing skeleton';
 const title=document.createElement('h1');title.textContent='This was a phishing readiness test!';
 const stop=document.createElement('button');stop.textContent='Stop and view training';
 const play=document.createElement('button');play.textContent='Play music / fullscreen';play.hidden=true;
 const audio=document.createElement('audio');audio.src='/media/reveal.mp3';audio.preload='auto';audio.volume=.35;
 let ended=false,timer;
 function finish(){if(ended)return;ended=true;clearTimeout(timer);audio.pause();audio.removeAttribute('src');audio.load();overlay.remove();document.removeEventListener('keydown',escape);document.removeEventListener('fullscreenchange',fullscreenChange);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});document.querySelector('#panel h1')?.focus();}
 function escape(e){if(e.key==='Escape')finish();}
 function fullscreenChange(){if(!document.fullscreenElement)finish();}
 stop.onclick=finish;document.addEventListener('keydown',escape);document.addEventListener('fullscreenchange',fullscreenChange);
 play.onclick=()=>{document.documentElement.requestFullscreen?.().catch(()=>{});audio.play().then(()=>{play.hidden=true;}).catch(()=>{play.textContent='Sound blocked — use Stop to continue';});};
 audio.addEventListener('loadedmetadata',()=>{if(config.startSeconds<audio.duration)audio.currentTime=config.startSeconds;else audio.currentTime=0;audio.play().catch(()=>{play.hidden=false;});},{once:true});
 audio.addEventListener('error',finish);image.onerror=finish;
 overlay.append(image,title,play,stop,audio);document.body.append(overlay);stop.focus();timer=setTimeout(finish,15000);
}
form.addEventListener('submit',async e=>{
 e.preventDefault(); if(!ready)return;
 const flags={accountFilled:account.value.trim().length>0,passwordFilled:secret.value.length>0};
 account.value='';secret.value='';button.disabled=true;
 // Request fullscreen directly from the submit gesture; browser policy may refuse it.
 if(mediaEnabled)document.documentElement.requestFullscreen?.().catch(()=>{});
 try{const r=await fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,receipt,...flags})});if(!r.ok)throw Error();
 const result=await r.json();
 document.querySelector('#panel').replaceChildren();const panel=document.querySelector('#panel');
 for(const [tag,message] of [['h1','This was a phishing readiness exercise'],['p','Your password and account text were not sent or saved. Only whether the fields were filled and the form was submitted were recorded.'],]){const el=document.createElement(tag);el.textContent=message;panel.append(el);}
 panel.querySelector('h1').tabIndex=-1;
 if(result.media?.enabled)revealMedia(result.media);else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 }catch{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});status.textContent='The result could not be recorded. This was a training exercise; no account text was transmitted.';}
});
if(!email&&!token){status.textContent='This link is missing its recipient email.';form.hidden=true;}
else fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(email?{email}:{token})}).then(async r=>{if(!r.ok)throw Error();const result=await r.json();receipt=result.receipt;token=result.token;mediaEnabled=result.media?.enabled===true;ready=true;button.disabled=false;status.textContent='';}).catch(()=>{form.hidden=true;status.textContent='This training link is invalid, expired, or disabled.';});
