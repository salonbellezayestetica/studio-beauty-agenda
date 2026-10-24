const STYLISTS = {
  'Ángela': {
    schedule: {
      1:{morning:{start:420,end:720},afternoon:{start:810,lastStart:1110}},
      2:{morning:{start:420,end:720},afternoon:{start:810,lastStart:990}},
      3:{morning:{start:420,end:720},afternoon:{start:810,lastStart:1110}},
      4:{morning:{start:420,end:720},afternoon:{start:810,lastStart:990}},
      5:{morning:{start:420,end:720},afternoon:{start:810,lastStart:1110}},
      6:{morning:{start:420,end:720},afternoon:{start:810,lastStart:990}}
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
  'Pedicure semipermanente':90
};

window.STUDIO_SELECTED_STYLIST=sessionStorage.getItem('studioBeautyStylist')||'Ángela';
window.STUDIO_BLOCK_STYLIST='Ángela';

function p2(n){return String(n).padStart(2,'0')}
function localDateStr(d){return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}
function minsToDb(m){return `${p2(Math.floor(m/60))}:${p2(m%60)}:00`}
function selectedDuration(){
  const names=[...document.querySelectorAll('.service-card.selected strong')].map(x=>x.textContent.trim());
  return names.reduce((sum,name)=>sum+(SERVICE_DURATIONS[name]||0),0)||30;
}
function parseDateFilter(values,prefix){
  const raw=values.find(v=>v.startsWith(prefix+'.'));
  return raw?raw.slice(prefix.length+1):null;
}
function currentStylist(){return sessionStorage.getItem('studioBeautyStylist')||window.STUDIO_SELECTED_STYLIST||'Ángela'}

function activeScheduleFor(date){
  const [y,m,d]=date.split('-').map(Number);
  const dow=new Date(y,m-1,d).getDay();
  return STYLISTS[currentStylist()]?.schedule?.[dow]||null;
}

function scheduleRowsFor(date){
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
        return new Response(JSON.stringify(scheduleRowsFor(eqDate)),{status:200,headers:{'Content-Type':'application/json'}});
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
      requestInit.body=JSON.stringify(Array.isArray(body)?body.map(apply):apply(body));
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
      <div class="admin-item"><strong>Ángela · lunes, miércoles y viernes</strong><p>7:00 a. m.–12:00 m. · desde 1:30 p. m. · último turno 6:30 p. m.</p></div>
      <div class="admin-item"><strong>Ángela · martes, jueves y sábado</strong><p>7:00 a. m.–12:00 m. · desde 1:30 p. m. · último turno 4:30 p. m.</p></div>
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
        badge.textContent=name;
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

document.addEventListener('DOMContentLoaded',()=>{
  setupStylistFlow();
  setupAdminBlockStylist();
  renderAutomaticScheduleInfo();
  const observer=new MutationObserver(()=>annotateAdminLists());
  const appt=document.querySelector('#appointmentsList');
  const blocks=document.querySelector('#blocksList');
  if(appt)observer.observe(appt,{childList:true});
  if(blocks)observer.observe(blocks,{childList:true});
});
setTimeout(()=>{setupStylistFlow();setupAdminBlockStylist();renderAutomaticScheduleInfo();annotateAdminLists()},0);
