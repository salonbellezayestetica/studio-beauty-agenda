const STYLISTS = {
  'Ángela': {
    schedule: {
      1:{morning:{start:420,end:720},afternoon:{start:780,lastStart:1110}},
      2:{morning:{start:420,end:720},afternoon:{start:780,lastStart:990}},
      3:{morning:{start:420,end:720},afternoon:{start:780,lastStart:1110}},
      4:{morning:{start:420,end:720},afternoon:{start:780,lastStart:990}},
      5:{morning:{start:420,end:720},afternoon:{start:780,lastStart:1110}},
      6:{morning:{start:420,end:720},afternoon:{start:780,lastStart:990}}
    }
  },
  'Liseth': {
    schedule: {
      1:{afternoon:{start:840,lastStart:990}},
      2:{afternoon:{start:840,lastStart:990}},
      3:{afternoon:{start:840,lastStart:990}},
      4:{afternoon:{start:840,lastStart:990}},
      5:{afternoon:{start:840,lastStart:990}},
      6:{afternoon:{start:840,lastStart:990}}
    }
  }
};

const SERVICE_DURATIONS = {
  'Manicure tradicional':75,
  'Semipermanente manos':90,
  'Soft Gel':180,
  'Acrílicas esculpidas':180,
  'Recubrimiento con Polygel':180,
  'Recubrimiento con Builder Gel':150,
  'Dipping en uñas naturales':150,
  'Pedicure tradicional':75,
  'Pedicure semipermanente':90,
  'Pedicure + reconstrucción de 2 uñas':90
};

window.STUDIO_SELECTED_STYLIST=sessionStorage.getItem('studioBeautyStylist')||'Ángela';
window.STUDIO_BLOCK_STYLIST='Ángela';

function p2(n){return String(n).padStart(2,'0')}
function localDateStr(d){return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}
function minsToDb(m){return `${p2(Math.floor(m/60))}:${p2(m%60)}:00`}
function parseDbMinutes(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}
function selectedDuration(){
  const names=[...document.querySelectorAll('.service-card.selected strong')].map(x=>x.textContent.trim());
  return names.reduce((sum,name)=>sum+(SERVICE_DURATIONS[name]||0),0)||30;
}
function parseDateFilter(values,prefix){
  const raw=values.find(v=>v.startsWith(prefix+'.'));
  return raw?raw.slice(prefix.length+1):null;
}
function currentStylist(){return sessionStorage.getItem('studioBeautyStylist')||window.STUDIO_SELECTED_STYLIST||'Ángela'}
function specialMarkerForStylist(stylist){return stylist==='Liseth'?'02':'01'}
function isSpecialRowForStylist(row,stylist){
  return String(row?.hora_inicio||'').endsWith(':'+specialMarkerForStylist(stylist))
}

function activeScheduleFor(date){
  const stylist=currentStylist();
  const [y,m,d]=date.split('-').map(Number);
  const dow=new Date(y,m-1,d).getDay();
  return STYLISTS[stylist]?.schedule?.[dow]||null;
}

async function scheduleRowsFor(date){
  const stylist=currentStylist();
  const marker=specialMarkerForStylist(stylist);
  try{
    const url=new URL('https://ywbmlsfxvytdmnkyjial.supabase.co/rest/v1/disponibilidad');
    url.searchParams.set('select','fecha,hora_inicio,hora_fin,activo');
    url.searchParams.set('fecha','eq.'+date);
    const resp=await nativeFetch(url.toString(),{
      headers:{apikey:'sb_publishable_Esj-3c_n0bYl0QwHzIp7kg_jGuUS2j9'}
    });
    const data=await resp.json().catch(()=>[]);
    const special=(data||[]).find(r=>String(r.hora_inicio||'').endsWith(':'+marker));
    if(special){
      const duration=selectedDuration();
      const start=parseDbMinutes(special.hora_inicio);
      const lastStart=parseDbMinutes(special.hora_fin);
      return [{hora_inicio:minsToDb(start),hora_fin:minsToDb(lastStart+duration)}];
    }
  }catch(e){console.error('Horario especial',e)}

  const day=activeScheduleFor(date);
  if(!day)return [];
  const duration=selectedDuration();
  const rows=[];
  if(day.morning) rows.push({hora_inicio:minsToDb(day.morning.start),hora_fin:minsToDb(day.morning.end)});
  if(day.afternoon) rows.push({hora_inicio:minsToDb(day.afternoon.start),hora_fin:minsToDb(day.afternoon.lastStart+duration)});
  return rows;
}

const nativeFetch=window.fetch.bind(window);
let latestAppointmentStylists=[];
let latestBlockStylists=[];

window.fetch=async function(input,init={}){
  let requestUrl=typeof input==='string'?input:input.url;
  let requestInit={...init};
  const method=(requestInit.method||(typeof input!=='string'&&input.method)||'GET').toUpperCase();

  try{
    const url=new URL(requestUrl,location.href);
    const isSupabase=url.hostname==='ywbmlsfxvytdmnkyjial.supabase.co';

    if(isSupabase && url.pathname.endsWith('/rest/v1/disponibilidad') && method==='GET'){
      const select=url.searchParams.get('select')||'';
      const filters=url.searchParams.getAll('fecha');
      const eqDate=parseDateFilter(filters,'eq');
      const gteDate=parseDateFilter(filters,'gte');
      const lteDate=parseDateFilter(filters,'lte');

      if(eqDate && select.includes('hora_inicio')){
        return new Response(JSON.stringify(await scheduleRowsFor(eqDate)),{status:200,headers:{'Content-Type':'application/json'}});
      }

      if(gteDate && lteDate && select.includes('fecha')){
        const start=new Date(gteDate+'T12:00:00');
        const end=new Date(lteDate+'T12:00:00');
        const rows=[];
        const cursor=new Date(start);
        while(cursor<=end){
          const dow=cursor.getDay();
          if(STYLISTS[currentStylist()]?.schedule?.[dow])rows.push({fecha:localDateStr(cursor)});
          cursor.setDate(cursor.getDate()+1);
        }
        return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
      }

      return new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}});
    }

    if(isSupabase && url.pathname.endsWith('/rest/v1/rpc/horarios_ocupados') && method==='POST'){
      url.pathname=url.pathname.replace('/horarios_ocupados','/horarios_ocupados_estilista');
      const body=JSON.parse(requestInit.body||'{}');
      body.p_estilista=currentStylist();
      requestInit.body=JSON.stringify(body);
      requestUrl=url.toString();
    }

    if(isSupabase && url.pathname.endsWith('/rest/v1/Citas') && method==='POST'){
      const body=JSON.parse(requestInit.body||'{}');
      const apply=o=>({...o,estilista:currentStylist()});
      const enriched=Array.isArray(body)?body.map(apply):apply(body);
      requestInit.body=JSON.stringify(enriched);
      const first=Array.isArray(enriched)?enriched[0]:enriched;
      window.STUDIO_LAST_BOOKING={
        ...first,
        estilista:currentStylist(),
        servicios:[...document.querySelectorAll('.service-card.selected strong')].map(x=>x.textContent.trim())
      };
    }

    if(isSupabase && url.pathname.endsWith('/rest/v1/bloqueos') && method==='POST'){
      const body=JSON.parse(requestInit.body||'{}');
      const apply=o=>({...o,estilista:window.STUDIO_BLOCK_STYLIST||'Ángela'});
      requestInit.body=JSON.stringify(Array.isArray(body)?body.map(apply):apply(body));
    }

    if(isSupabase && url.pathname.endsWith('/rest/v1/Citas') && method==='GET'){
      const select=url.searchParams.get('select');
      if(select && !select.includes('estilista'))url.searchParams.set('select',select+',estilista');
      requestUrl=url.toString();
      const resp=await nativeFetch(requestUrl,requestInit);
      const data=await resp.clone().json().catch(()=>null);
      if(Array.isArray(data))latestAppointmentStylists=data.map(x=>x.estilista||'Ángela');
      return resp;
    }

    if(isSupabase && url.pathname.endsWith('/rest/v1/bloqueos') && method==='GET'){
      const resp=await nativeFetch(requestUrl,requestInit);
      const data=await resp.clone().json().catch(()=>null);
      if(Array.isArray(data))latestBlockStylists=data.map(x=>x.estilista||'Ángela');
      return resp;
    }
  }catch(e){
    console.warn('Studio Beauty: ajuste de estilistas',e);
  }

  return nativeFetch(requestUrl,requestInit);
};

function showCustomScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===name));
  document.querySelector('#backButton')?.classList.remove('hidden');
  document.querySelector('#homeButton')?.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

function createStylistScreen(){
  if(document.querySelector('[data-screen="stylist"]'))return;
  const services=document.querySelector('[data-screen="services"]');
  if(!services)return;
  const section=document.createElement('section');
  section.className='screen inner-screen';
  section.dataset.screen='stylist';
  section.innerHTML=`
    <div class="inner-wrap">
      <img src="logo-studio-beauty-clean.png?v=6" class="mini-logo" alt="Studio Beauty">
      <p class="eyebrow">Tu cita</p>
      <h2>Elige tu estilista</h2>
      <p class="subtitle">Selecciona con quién deseas realizar tu servicio.</p>
      <div class="stylist-grid">
        <button class="stylist-card" type="button" data-stylist="Ángela">
          <span class="stylist-avatar">A</span>
          <span><strong>Ángela</strong><small>Ver horarios disponibles</small></span>
          <span class="stylist-arrow">→</span>
        </button>
        <button class="stylist-card" type="button" data-stylist="Liseth">
          <span class="stylist-avatar">L</span>
          <span><strong>Liseth</strong><small>Atiende principalmente en la tarde</small></span>
          <span class="stylist-arrow">→</span>
        </button>
      </div>
    </div>`;
  services.after(section);

  section.querySelectorAll('.stylist-card').forEach(btn=>{
    btn.addEventListener('click',()=>{
      window.STUDIO_SELECTED_STYLIST=btn.dataset.stylist;
      sessionStorage.setItem('studioBeautyStylist',btn.dataset.stylist);
      window.__studioStylistChosen=true;
      document.querySelector('#servicesContinue')?.click();
      window.__studioStylistChosen=false;
    });
  });
}

function setupStylistFlow(){
  createStylistScreen();
  const continueBtn=document.querySelector('#servicesContinue');
  const back=document.querySelector('#backButton');
  if(continueBtn){
    continueBtn.addEventListener('click',e=>{
      if(window.__studioStylistChosen)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showCustomScreen('stylist');
    },true);
  }
  if(back){
    back.addEventListener('click',e=>{
      const stylist=document.querySelector('[data-screen="stylist"]');
      if(stylist?.classList.contains('active')){
        e.preventDefault();
        e.stopImmediatePropagation();
        showCustomScreen('services');
      }
    },true);
  }

  document.querySelector('#datetimeContinue')?.addEventListener('click',()=>{
    setTimeout(()=>{
      const box=document.querySelector('.summary-details');
      if(!box)return;
      let div=box.querySelector('.stylist-summary');
      if(!div){
        div=document.createElement('div');
        div.className='stylist-summary';
        box.prepend(div);
      }
      div.innerHTML=`<span>✦</span><p><small>Estilista</small><strong>${currentStylist()}</strong></p>`;
    },0);
  });
}

function setupAdminBlockStylist(){
  const form=document.querySelector('#blockForm');
  if(!form || document.querySelector('#blockStylist'))return;
  const label=document.createElement('label');
  label.innerHTML=`Estilista<select id="blockStylist" required><option value="Ángela">Ángela</option><option value="Liseth">Liseth</option></select>`;
  form.prepend(label);
  const select=label.querySelector('select');
  select.addEventListener('change',()=>window.STUDIO_BLOCK_STYLIST=select.value);
}

function renderAutomaticScheduleInfo(){
  const form=document.querySelector('#availabilityForm');
  if(!form)return;
  const section=form.closest('.admin-section');
  if(!section)return;
  form.style.display='none';
  document.querySelector('#availabilityList')?.style.setProperty('display','none');
  document.querySelector('#refreshAvailability')?.style.setProperty('display','none');
  document.querySelector('#availabilityStatus')?.style.setProperty('display','none');
  const heading=section.querySelector('h3');
  if(heading)heading.textContent='Horario habitual';
  const help=section.querySelector('.admin-help');
  if(help)help.innerHTML='La agenda queda abierta automáticamente. Para un día libre, diligencia o cambio puntual, usa <strong>Bloquear horario</strong> y elige a quién aplica.';
  if(!section.querySelector('.automatic-schedule-card')){
    const box=document.createElement('div');
    box.className='automatic-schedule-card admin-list';
    box.innerHTML=`
      <div class="admin-item"><strong>Ángela · lunes, miércoles y viernes</strong><p>7:00 a. m.–12:00 m. · desde 1:00 p. m. · último turno 6:30 p. m.</p></div>
      <div class="admin-item"><strong>Ángela · martes, jueves y sábado</strong><p>7:00 a. m.–12:00 m. · desde 1:00 p. m. · último turno 4:30 p. m.</p></div>
      <div class="admin-item"><strong>Liseth · lunes a sábado</strong><p>Desde 2:00 p. m. · último turno 4:30 p. m.</p></div>
      <div class="admin-item"><strong>Domingo</strong><p>Cerrado.</p></div>`;
    section.appendChild(box);
  }
}

function annotateAdminLists(){
  const appt=document.querySelector('#appointmentsList');
  if(appt){
    [...appt.children].forEach((item,i)=>{
      if(item.querySelector('.stylist-badge'))return;
      const name=latestAppointmentStylists[i];
      if(name){
        const badge=document.createElement('span');
        badge.className='stylist-badge';
        badge.textContent=`Estilista: ${name}`;
        item.prepend(badge);
      }
    });
  }
  const blocks=document.querySelector('#blocksList');
  if(blocks){
    [...blocks.children].forEach((item,i)=>{
      if(item.querySelector('.stylist-badge'))return;
      const name=latestBlockStylists[i];
      if(name){
        const badge=document.createElement('span');
        badge.className='stylist-badge';
        badge.textContent=name;
        item.prepend(badge);
      }
    });
  }
}


function icsEscape(v){
  return String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function icsLocal(date,time){
  const [y,m,d]=String(date).split('-');
  const [hh,mm,ss='00']=String(time).split(':');
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}
function icsEscape(v){
  return String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function icsLocal(date,time){
  const [y,m,d]=String(date).split('-');
  const [hh,mm,ss='00']=String(time).split(':');
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}
function ensureCalendarButton(){
  const success=document.querySelector('[data-screen="success"] .success-box');
  if(!success)return;
  let btn=success.querySelector('#addToCalendarButton');
  if(!btn){
    btn=document.createElement('button');
    btn.id='addToCalendarButton';
    btn.type='button';
    btn.className='cta calendar-cta';
    btn.textContent='Agregar a mi calendario';
    const newBtn=document.querySelector('#newBookingButton');
    if(newBtn) success.insertBefore(btn,newBtn);
    else success.appendChild(btn);
  }
  if(btn.dataset.bound==='1')return;
  btn.dataset.bound='1';
  btn.addEventListener('click',()=>{
    const b=window.STUDIO_LAST_BOOKING;
    if(!b){
      alert('No encontramos los datos de la cita. Agenda nuevamente para agregarla al calendario.');
      return;
    }

    const servicios=(b.servicios||[]).join(' + ')||'Servicio de belleza';
    const title='Cita Studio Beauty - '+servicios;
    const details='Estilista: '+b.estilista+' | '+servicios;
    const start=icsLocal(b.fecha,b.hora_inicio);
    const end=icsLocal(b.fecha,b.hora_fin);

    const ua=navigator.userAgent||'';
    const isIOS=/iPhone|iPad|iPod/i.test(ua);
    const isAndroid=/Android/i.test(ua);

    if(isAndroid){
      const gStart=start.replace(/[-:]/g,'');
      const gEnd=end.replace(/[-:]/g,'');
      const url='https://calendar.google.com/calendar/render?action=TEMPLATE'
        +'&text='+encodeURIComponent(title)
        +'&dates='+encodeURIComponent(gStart+'/'+gEnd)
        +'&details='+encodeURIComponent(details);
      window.open(url,'_blank');
      return;
    }

    const uid=`studio-beauty-${b.id||Date.now()}@agenda`;
    const now=new Date();
    const stamp=`${now.getUTCFullYear()}${p2(now.getUTCMonth()+1)}${p2(now.getUTCDate())}T${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}${p2(now.getUTCSeconds())}Z`;
    const ics=[
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Studio Beauty//Agenda//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(details)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio cita Studio Beauty',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
    const href=URL.createObjectURL(blob);

    if(isIOS){
      window.location.href=href;
      setTimeout(()=>URL.revokeObjectURL(href),10000);
      return;
    }

    const a=document.createElement('a');
    a.href=href;
    a.download='cita-studio-beauty.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),3000);
  });
}
function watchSuccessScreen(){
  ensureCalendarButton();
  const target=document.querySelector('[data-screen="success"]');
  if(!target)return;
  const observer=new MutationObserver(()=>ensureCalendarButton());
  observer.observe(target,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
}
document.addEventListener('DOMContentLoaded',()=>{
  setupStylistFlow();
  setupAdminBlockStylist();
  renderAutomaticScheduleInfo();
  ensureCalendarButton();
  watchSuccessScreen();
  const observer=new MutationObserver(()=>annotateAdminLists());
  const appt=document.querySelector('#appointmentsList');
  const blocks=document.querySelector('#blocksList');
  if(appt)observer.observe(appt,{childList:true});
  if(blocks)observer.observe(blocks,{childList:true});
});
setTimeout(()=>{setupStylistFlow();setupAdminBlockStylist();renderAutomaticScheduleInfo();annotateAdminLists();ensureCalendarButton()},0);
