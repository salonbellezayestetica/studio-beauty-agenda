const STUDIO_SCHEDULE = {
  1: { lastStart: 18 * 60 + 30 }, // lunes
  2: { lastStart: 16 * 60 + 30 }, // martes
  3: { lastStart: 18 * 60 + 30 }, // miércoles
  4: { lastStart: 16 * 60 + 30 }, // jueves
  5: { lastStart: 18 * 60 + 30 }, // viernes
  6: { lastStart: 16 * 60 + 30 }  // sábado
};

const SERVICE_DURATIONS = {
  'Manicure tradicional': 75,
  'Semipermanente manos': 90,
  'Soft Gel': 180,
  'Acrílicas esculpidas': 180,
  'Recubrimiento con Polygel': 180,
  'Recubrimiento con Builder Gel': 150,
  'Dipping en uñas naturales': 150,
  'Pedicure tradicional': 75,
  'Pedicure semipermanente': 90
};

function pad2(n){ return String(n).padStart(2,'0'); }
function toDateStrLocal(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function minutesToDb(m){ return `${pad2(Math.floor(m/60))}:${pad2(m%60)}:00`; }

function selectedDurationFromDom(){
  const names=[...document.querySelectorAll('.service-card.selected strong')].map(x=>x.textContent.trim());
  return names.reduce((sum,name)=>sum+(SERVICE_DURATIONS[name]||0),0) || 30;
}

function parseDateFilter(values,prefix){
  const raw=values.find(v=>v.startsWith(prefix+'.'));
  return raw ? raw.slice(prefix.length+1) : null;
}

const nativeFetch = window.fetch.bind(window);

window.fetch = async function(input, init={}){
  const requestUrl = typeof input === 'string' ? input : input.url;
  const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();

  try{
    const url = new URL(requestUrl, location.href);
    const isAvailability = url.hostname === 'ywbmlsfxvytdmnkyjial.supabase.co'
      && url.pathname.endsWith('/rest/v1/disponibilidad');

    if(isAvailability && method === 'GET'){
      const select = url.searchParams.get('select') || '';
      const fechaFilters = url.searchParams.getAll('fecha');
      const eqDate = parseDateFilter(fechaFilters,'eq');
      const gteDate = parseDateFilter(fechaFilters,'gte');
      const lteDate = parseDateFilter(fechaFilters,'lte');

      // Consulta de un día concreto: devuelve el horario habitual automático.
      if(eqDate && select.includes('hora_inicio')){
        const [y,m,d]=eqDate.split('-').map(Number);
        const dow=new Date(y,m-1,d).getDay();
        const day=STUDIO_SCHEDULE[dow];
        if(!day){
          return new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}});
        }

        const duration=selectedDurationFromDom();
        const rows=[
          {hora_inicio:'07:00:00',hora_fin:'12:00:00'},
          {hora_inicio:'13:30:00',hora_fin:minutesToDb(day.lastStart+duration)}
        ];
        return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
      }

      // Consulta mensual del calendario: lunes a sábado disponibles automáticamente.
      if(gteDate && lteDate && select.includes('fecha')){
        const start=new Date(gteDate+'T12:00:00');
        const end=new Date(lteDate+'T12:00:00');
        const rows=[];
        const cursor=new Date(start);
        while(cursor<=end){
          if(STUDIO_SCHEDULE[cursor.getDay()]) rows.push({fecha:toDateStrLocal(cursor)});
          cursor.setDate(cursor.getDate()+1);
        }
        return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
      }

      // La antigua lista manual de disponibilidad deja de controlar la agenda.
      return new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}});
    }
  }catch(e){
    console.warn('No se pudo aplicar horario automático',e);
  }

  return nativeFetch(input,init);
};

function renderAutomaticScheduleInfo(){
  const form=document.querySelector('#availabilityForm');
  if(!form) return;
  const section=form.closest('.admin-section');
  if(!section) return;

  form.style.display='none';
  document.querySelector('#availabilityList')?.style.setProperty('display','none');
  document.querySelector('#refreshAvailability')?.style.setProperty('display','none');
  document.querySelector('#availabilityStatus')?.style.setProperty('display','none');

  const heading=section.querySelector('h3');
  if(heading) heading.textContent='Horario habitual';

  const help=section.querySelector('.admin-help');
  if(help) help.innerHTML='La agenda ya queda abierta automáticamente de lunes a sábado. Para un día libre, una diligencia o un cambio puntual, usa <strong>Bloquear horario</strong>.';

  if(!section.querySelector('.automatic-schedule-card')){
    const box=document.createElement('div');
    box.className='automatic-schedule-card admin-list';
    box.innerHTML=`
      <div class="admin-item"><strong>Lunes, miércoles y viernes</strong><p>7:00 a. m. – 12:00 m. · desde 1:30 p. m. · último turno 6:30 p. m.</p></div>
      <div class="admin-item"><strong>Martes, jueves y sábado</strong><p>7:00 a. m. – 12:00 m. · desde 1:30 p. m. · último turno 4:30 p. m.</p></div>
      <div class="admin-item"><strong>Domingo</strong><p>Cerrado.</p></div>
    `;
    section.appendChild(box);
  }
}

document.addEventListener('DOMContentLoaded',renderAutomaticScheduleInfo);
setTimeout(renderAutomaticScheduleInfo,0);
