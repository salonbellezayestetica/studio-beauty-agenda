import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://ywbmlsfxvytdmnkyjial.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Esj-3c_n0bYl0QwHzIp7kg_jGuUS2j9'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const SLOT_STEP = 30
const LOCAL_SERVICE_IMAGES = {
  'Manicure tradicional': 'manicure-tradicional.jpg',
  'Semipermanente manos': 'semipermanente-manos.jpg',
  'Soft Gel': 'soft-gel.jpg',
  'Acrílicas esculpidas': 'acrilicas-esculpidas.jpg',
  'Recubrimiento con Polygel': 'recubrimiento-polygel.jpg',
  'Recubrimiento con Builder Gel': 'builder-gel.jpg',
  'Dipping en uñas naturales': 'dipping.jpg',
  'Pedicure tradicional': 'pedicure-tradicional.jpg',
  'Pedicure semipermanente': 'pedicure-semipermanente.jpg'
}

const state = {
  screen: 'home', services: [], hands: null, feet: null,
  date: '', startMinutes: null, month: startOfMonth(new Date()), availableDates: new Set()
}

const $ = (s) => document.querySelector(s)
const els = {
  backButton: $('#backButton'), homeButton: $('#homeButton'), startButton: $('#startButton'), adminAccessButton: $('#adminAccessButton'),
  handsList: $('#handsList'), feetList: $('#feetList'), selectionSummary: $('#selectionSummary'), servicesStatus: $('#servicesStatus'), servicesContinue: $('#servicesContinue'),
  prevMonth: $('#prevMonth'), nextMonth: $('#nextMonth'), monthLabel: $('#monthLabel'), calendarGrid: $('#calendarGrid'), timesGrid: $('#timesGrid'), timesStatus: $('#timesStatus'), datetimeContinue: $('#datetimeContinue'),
  confirmServices: $('#confirmServices'), summaryDate: $('#summaryDate'), summaryTime: $('#summaryTime'), bookingForm: $('#bookingForm'), nameInput: $('#nameInput'), phoneInput: $('#phoneInput'), formStatus: $('#formStatus'),
  loginForm: $('#loginForm'), loginEmail: $('#loginEmail'), loginPassword: $('#loginPassword'), loginStatus: $('#loginStatus'), logoutButton: $('#logoutButton'),
  availabilityForm: $('#availabilityForm'), availabilityDate: $('#availabilityDate'), availabilityEndDate: $('#availabilityEndDate'), availabilityStart: $('#availabilityStart'), availabilityEnd: $('#availabilityEnd'), availabilityStatus: $('#availabilityStatus'), availabilityList: $('#availabilityList'), refreshAvailability: $('#refreshAvailability'),
  appointmentsList: $('#appointmentsList'), appointmentsStatus: $('#appointmentsStatus'), refreshAppointments: $('#refreshAppointments'),
  blockForm: $('#blockForm'), blockDate: $('#blockDate'), blockStart: $('#blockStart'), blockEnd: $('#blockEnd'), blockReason: $('#blockReason'), blockStatus: $('#blockStatus'), blocksList: $('#blocksList'), refreshBlocks: $('#refreshBlocks'),
  successText: $('#successText'), newBookingButton: $('#newBookingButton')
}

function showScreen(name){
  state.screen=name
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===name))
  els.backButton.classList.toggle('hidden',['home','success','admin'].includes(name))
  els.homeButton.classList.toggle('hidden',name==='home')
  window.scrollTo({top:0,behavior:'smooth'})
}
function goBack(){ if(state.screen==='services')showScreen('home'); else if(state.screen==='datetime')showScreen('services'); else if(state.screen==='confirm')showScreen('datetime'); else if(state.screen==='adminLogin')showScreen('home') }
function pad(n){return String(n).padStart(2,'0')}
function toDateStr(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function startOfMonth(d){return new Date(d.getFullYear(),d.getMonth(),1)}
function parseDbTime(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}
function dbTime(m){return `${pad(Math.floor(m/60))}:${pad(m%60)}:00`}
function fmtTime(m){const h=Math.floor(m/60),mm=m%60,p=h>=12?'p. m.':'a. m.';return `${h%12||12}:${pad(mm)} ${p}`}
function fmtDate(v){const [y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(y,m-1,d))}
function fmtMoney(v){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v||0))}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function selectedServices(){return [state.hands,state.feet].filter(Boolean)}
function totalDuration(){return selectedServices().reduce((s,x)=>s+Number(x.duracion_minutos||0),0)}
function overlap(a1,a2,b1,b2){return a1<b2&&a2>b1}
function todayStr(){return toDateStr(new Date())}

async function loadServices(){
  els.servicesStatus.textContent='Cargando servicios...'
  const {data,error}=await supabase.from('Servicios').select('id,nombre,duracion_minutos,categoria,precio,imagen_url').eq('activo',true).order('id')
  if(error){console.error(error);els.servicesStatus.className='status error';els.servicesStatus.textContent='No pudimos cargar los servicios.';return}
  state.services=data||[]; renderServices(); els.servicesStatus.textContent=''
}
function serviceCard(s,category){
  const b=document.createElement('button'); b.type='button'; b.className='service-card'
  const imageSrc=s.imagen_url || LOCAL_SERVICE_IMAGES[s.nombre]
  const img=imageSrc?`<img class="service-photo" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(s.nombre)}" loading="lazy">`:`<div class="service-photo"></div>`
  b.innerHTML=`${img}<span class="service-copy"><strong>${escapeHtml(s.nombre)}</strong><span>${fmtMoney(s.precio)}</span></span><span class="service-tick">✓</span>`
  const refresh=()=>b.classList.toggle('selected',(category==='manos'?state.hands:state.feet)?.id===s.id)
  b.addEventListener('click',()=>{ if(category==='manos')state.hands=state.hands?.id===s.id?null:s; else state.feet=state.feet?.id===s.id?null:s; renderServices(); updateSelectionSummary() })
  refresh(); return b
}
function renderServices(){
  els.handsList.innerHTML='';els.feetList.innerHTML=''
  state.services.filter(s=>s.categoria==='manos').forEach(s=>els.handsList.appendChild(serviceCard(s,'manos')))
  state.services.filter(s=>s.categoria==='pies').forEach(s=>els.feetList.appendChild(serviceCard(s,'pies')))
  updateSelectionSummary()
}
function updateSelectionSummary(){
  const sel=selectedServices(); els.servicesContinue.disabled=!sel.length
  if(!sel.length){els.selectionSummary.classList.add('hidden-box');els.selectionSummary.innerHTML='';return}
  els.selectionSummary.classList.remove('hidden-box')
  els.selectionSummary.innerHTML=`<strong>Tu selección</strong>${sel.map(s=>`<p>${escapeHtml(s.nombre)} · ${fmtMoney(s.precio)}</p>`).join('')}`
}

async function loadMonthAvailability(){
  const start=toDateStr(state.month), end=toDateStr(new Date(state.month.getFullYear(),state.month.getMonth()+1,0))
  const {data,error}=await supabase.from('disponibilidad').select('fecha').eq('activo',true).gte('fecha',start).lte('fecha',end)
  if(error){console.error(error);state.availableDates=new Set()} else state.availableDates=new Set((data||[]).map(x=>x.fecha))
  renderCalendar()
}
function renderCalendar(){
  const y=state.month.getFullYear(),m=state.month.getMonth(); els.monthLabel.textContent=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(state.month)
  els.calendarGrid.innerHTML=''; const firstDay=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate()
  for(let i=0;i<firstDay;i++){const x=document.createElement('button');x.className='calendar-day blank';els.calendarGrid.appendChild(x)}
  const today=todayStr()
  for(let d=1;d<=days;d++){
    const date=`${y}-${pad(m+1)}-${pad(d)}`; const b=document.createElement('button');b.type='button';b.className='calendar-day';b.textContent=d
    const available=state.availableDates.has(date)&&date>=today
    if(available){b.classList.add('available');b.addEventListener('click',async()=>{state.date=date;state.startMinutes=null;renderCalendar();await renderTimes()})}
    if(state.date===date)b.classList.add('selected'); if(date===today)b.classList.add('today')
    els.calendarGrid.appendChild(b)
  }
}
async function getBusy(date){const {data,error}=await supabase.rpc('horarios_ocupados',{p_fecha:date});if(error)throw error;return(data||[]).map(r=>({start:parseDbTime(r.hora_inicio),end:parseDbTime(r.hora_fin)}))}
async function getWindows(date){const {data,error}=await supabase.from('disponibilidad').select('hora_inicio,hora_fin').eq('fecha',date).eq('activo',true).order('hora_inicio');if(error)throw error;return(data||[]).map(r=>({start:parseDbTime(r.hora_inicio),end:parseDbTime(r.hora_fin)}))}
async function renderTimes(){
  els.timesGrid.innerHTML='';els.datetimeContinue.disabled=true;state.startMinutes=null
  if(!state.date){els.timesStatus.textContent='Elige una fecha disponible.';return}
  els.timesStatus.textContent='Consultando disponibilidad...'
  try{
    const [windows,busy]=await Promise.all([getWindows(state.date),getBusy(state.date)]), duration=totalDuration(), starts=[]
    windows.forEach(w=>{for(let s=w.start;s+duration<=w.end;s+=SLOT_STEP){if(!busy.some(b=>overlap(s,s+duration,b.start,b.end)))starts.push(s)}})
    const unique=[...new Set(starts)].sort((a,b)=>a-b)
    if(!unique.length){els.timesStatus.textContent='No quedan horarios libres para ese día.';return}
    unique.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='time-btn';b.textContent=fmtTime(s);b.onclick=()=>{document.querySelectorAll('.time-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.startMinutes=s;els.datetimeContinue.disabled=false};els.timesGrid.appendChild(b)})
    els.timesStatus.textContent='Selecciona la hora que prefieras.'
  }catch(e){console.error(e);els.timesStatus.className='status error';els.timesStatus.textContent='No pudimos consultar la agenda.'}
}
function renderConfirmation(){
  const sel=selectedServices();els.confirmServices.innerHTML=sel.map(s=>`<div class="confirm-service"><strong>${escapeHtml(s.nombre)}</strong><span>${fmtMoney(s.precio)}</span></div>`).join('')
  els.summaryDate.textContent=fmtDate(state.date);els.summaryTime.textContent=fmtTime(state.startMinutes)
}
async function saveBooking(e){
  e.preventDefault(); const sel=selectedServices(); if(!sel.length||!state.date||state.startMinutes===null)return
  els.formStatus.className='status';els.formStatus.textContent='Guardando tu cita...'
  try{
    const busy=await getBusy(state.date),end=state.startMinutes+totalDuration();if(busy.some(b=>overlap(state.startMinutes,end,b.start,b.end)))throw new Error('Ese horario acaba de ocuparse. Regresa y elige otro.')
    const citaId=Date.now()
    const payload={id:citaId,nombre_cliente:els.nameInput.value.trim(),whatsapp:els.phoneInput.value.trim(),servicio_id:sel[0].id,fecha:state.date,hora_inicio:dbTime(state.startMinutes),hora_fin:dbTime(end),estado:'confirmada'}
    const {error}=await supabase.from('Citas').insert(payload);if(error)throw error
    const {error:linkError}=await supabase.from('cita_servicios').insert(sel.map(s=>({cita_id:citaId,servicio_id:s.id})));if(linkError)throw linkError
    els.successText.textContent=`${sel.map(s=>s.nombre).join(' + ')} · ${fmtDate(state.date)} · ${fmtTime(state.startMinutes)}`;showScreen('success')
  }catch(err){console.error(err);els.formStatus.className='status error';els.formStatus.textContent=err.message?.includes('acaba')?err.message:'No pudimos guardar la cita. Intenta nuevamente.'}
}
function resetBooking(){state.hands=null;state.feet=null;state.date='';state.startMinutes=null;els.nameInput.value='';els.phoneInput.value='';renderServices();showScreen('home')}

async function login(e){e.preventDefault();els.loginStatus.textContent='Ingresando...';const {error}=await supabase.auth.signInWithPassword({email:els.loginEmail.value.trim(),password:els.loginPassword.value});if(error){els.loginStatus.className='status error';els.loginStatus.textContent='Correo o contraseña incorrectos.';return}els.loginStatus.textContent='';showScreen('admin');await loadAdminAll()}
async function logout(){await supabase.auth.signOut();showScreen('home')}
async function loadAdminAll(){await Promise.all([loadAvailabilityAdmin(),loadAppointments(),loadBlocks()])}

async function loadAvailabilityAdmin(){
  els.availabilityList.innerHTML='';const {data,error}=await supabase.from('disponibilidad').select('*').gte('fecha',todayStr()).order('fecha').order('hora_inicio')
  if(error){els.availabilityStatus.className='status error';els.availabilityStatus.textContent='No pudimos cargar la disponibilidad.';return}
  els.availabilityStatus.textContent=''; if(!(data||[]).length){els.availabilityList.innerHTML='<div class="admin-item"><p>No hay horarios abiertos próximamente.</p></div>';return}
  ;(data||[]).forEach(r=>{const item=document.createElement('div');item.className='admin-item';item.innerHTML=`<div class="admin-item-top"><div><strong>${escapeHtml(fmtDate(r.fecha))}</strong><p>${fmtTime(parseDbTime(r.hora_inicio))} – ${fmtTime(parseDbTime(r.hora_fin))}</p></div><button class="danger-btn" type="button">Eliminar</button></div>`;item.querySelector('button').onclick=async()=>{await supabase.from('disponibilidad').delete().eq('id',r.id);await loadAvailabilityAdmin()};els.availabilityList.appendChild(item)})
}
function dateRangeInclusive(startStr,endStr){
  const dates=[]
  const start=new Date(startStr+'T12:00:00')
  const end=new Date(endStr+'T12:00:00')
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return dates
  const cursor=new Date(start)
  while(cursor<=end){
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`)
    cursor.setDate(cursor.getDate()+1)
  }
  return dates
}
async function addAvailability(e){
  e.preventDefault()
  els.availabilityStatus.textContent='Guardando...'
  els.availabilityStatus.className='status'
  if(!els.availabilityDate.value||!els.availabilityEndDate.value){
    els.availabilityStatus.className='status error'
    els.availabilityStatus.textContent='Selecciona la fecha inicial y la fecha final.'
    return
  }
  if(els.availabilityEndDate.value<els.availabilityDate.value){
    els.availabilityStatus.className='status error'
    els.availabilityStatus.textContent='La fecha final no puede ser anterior a la inicial.'
    return
  }
  if(els.availabilityEnd.value<=els.availabilityStart.value){
    els.availabilityStatus.className='status error'
    els.availabilityStatus.textContent='La hora final debe ser posterior a la inicial.'
    return
  }
  const dates=dateRangeInclusive(els.availabilityDate.value,els.availabilityEndDate.value)
  if(dates.length>31){
    els.availabilityStatus.className='status error'
    els.availabilityStatus.textContent='Por seguridad, agrega máximo 31 días a la vez.'
    return
  }
  const rows=dates.map(fecha=>({
    fecha,
    hora_inicio:els.availabilityStart.value,
    hora_fin:els.availabilityEnd.value,
    activo:true
  }))
  const {error}=await supabase.from('disponibilidad').insert(rows)
  if(error){
    console.error(error)
    els.availabilityStatus.className='status error'
    els.availabilityStatus.textContent='No pudimos guardar la disponibilidad.'
    return
  }
  els.availabilityStatus.className='status success'
  els.availabilityStatus.textContent=`Disponibilidad agregada para ${dates.length} día${dates.length===1?'':'s'}.`
  els.availabilityForm.reset()
  setAdminDateMins()
  await loadAvailabilityAdmin()
}

async function loadAppointments(){
  els.appointmentsList.innerHTML='';els.appointmentsStatus.textContent='Cargando...'
  const {data:appointments,error}=await supabase.from('Citas').select('id,nombre_cliente,whatsapp,fecha,hora_inicio,hora_fin,estado').gte('fecha',todayStr()).neq('estado','cancelada').order('fecha').order('hora_inicio')
  if(error){console.error(error);els.appointmentsStatus.className='status error';els.appointmentsStatus.textContent='No pudimos cargar las citas.';return}
  const ids=(appointments||[]).map(x=>x.id);let links=[]
  if(ids.length){const r=await supabase.from('cita_servicios').select('cita_id,servicio_id').in('cita_id',ids);links=r.data||[]}
  const map=new Map(state.services.map(s=>[s.id,s.nombre]));els.appointmentsStatus.textContent=''
  if(!(appointments||[]).length){els.appointmentsList.innerHTML='<div class="admin-item"><p>No hay citas próximas.</p></div>';return}
  ;(appointments||[]).forEach(a=>{
    const names=links.filter(l=>l.cita_id===a.id).map(l=>map.get(l.servicio_id)).filter(Boolean)
    const item=document.createElement('div')
    item.className='admin-item appointment-item'
    item.innerHTML=`
      <div class="appointment-main">
        <strong>${escapeHtml(a.nombre_cliente)}</strong>
        <p>${escapeHtml(fmtDate(a.fecha))} · ${fmtTime(parseDbTime(a.hora_inicio))} – ${fmtTime(parseDbTime(a.hora_fin))}</p>
        <p>${escapeHtml(names.join(' + ')||'Servicio')}</p>
        <p>WhatsApp: ${escapeHtml(a.whatsapp)}</p>
      </div>
      <div class="appointment-actions">
        <button class="danger-btn cancel-appointment-btn" type="button">Cancelar cita</button>
      </div>`
    item.querySelector('.cancel-appointment-btn').onclick=async()=>{
      const ok=window.confirm(`¿Cancelar la cita de ${a.nombre_cliente}? El horario volverá a quedar disponible.`)
      if(!ok)return
      const btn=item.querySelector('.cancel-appointment-btn')
      btn.disabled=true
      btn.textContent='Cancelando...'
      const {error}=await supabase.from('Citas').update({estado:'cancelada'}).eq('id',a.id)
      if(error){
        console.error(error)
        btn.disabled=false
        btn.textContent='Cancelar cita'
        els.appointmentsStatus.className='status error'
        els.appointmentsStatus.textContent='No pudimos cancelar la cita.'
        return
      }
      els.appointmentsStatus.className='status success'
      els.appointmentsStatus.textContent='Cita cancelada. El horario quedó libre.'
      await loadAppointments()
    }
    els.appointmentsList.appendChild(item)
  })
}
async function loadBlocks(){
  els.blocksList.innerHTML='';const {data,error}=await supabase.from('bloqueos').select('*').gte('fecha',todayStr()).order('fecha').order('hora_inicio');if(error){return}
  if(!(data||[]).length){els.blocksList.innerHTML='<div class="admin-item"><p>No hay bloqueos próximos.</p></div>';return}
  ;(data||[]).forEach(r=>{const item=document.createElement('div');item.className='admin-item';item.innerHTML=`<div class="admin-item-top"><div><strong>${escapeHtml(fmtDate(r.fecha))}</strong><p>${fmtTime(parseDbTime(r.hora_inicio))} – ${fmtTime(parseDbTime(r.hora_fin))}${r.motivo?` · ${escapeHtml(r.motivo)}`:''}</p></div><button class="danger-btn" type="button">Eliminar</button></div>`;item.querySelector('button').onclick=async()=>{await supabase.from('bloqueos').delete().eq('id',r.id);await loadBlocks()};els.blocksList.appendChild(item)})
}
async function addBlock(e){e.preventDefault();if(els.blockEnd.value<=els.blockStart.value){els.blockStatus.className='status error';els.blockStatus.textContent='La hora final debe ser posterior a la inicial.';return}els.blockStatus.textContent='Guardando...';const {error}=await supabase.from('bloqueos').insert({fecha:els.blockDate.value,hora_inicio:els.blockStart.value,hora_fin:els.blockEnd.value,motivo:els.blockReason.value.trim()||null});if(error){console.error(error);els.blockStatus.className='status error';els.blockStatus.textContent='No pudimos crear el bloqueo.';return}els.blockStatus.className='status success';els.blockStatus.textContent='Horario bloqueado.';els.blockForm.reset();setAdminDateMins();await loadBlocks()}
function setAdminDateMins(){
  const t=todayStr()
  els.availabilityDate.min=t
  els.availabilityEndDate.min=t
  els.blockDate.min=t
}
els.availabilityDate.addEventListener('change',()=>{
  els.availabilityEndDate.min=els.availabilityDate.value||todayStr()
  if(!els.availabilityEndDate.value||els.availabilityEndDate.value<els.availabilityDate.value){
    els.availabilityEndDate.value=els.availabilityDate.value
  }
})

els.startButton.onclick=()=>showScreen('services');els.adminAccessButton.onclick=()=>showScreen('adminLogin');els.backButton.onclick=goBack;els.homeButton.onclick=()=>showScreen('home');els.newBookingButton.onclick=resetBooking
els.servicesContinue.onclick=async()=>{state.date='';state.startMinutes=null;state.month=startOfMonth(new Date());await loadMonthAvailability();els.timesGrid.innerHTML='';els.timesStatus.textContent='Elige una fecha disponible.';els.datetimeContinue.disabled=true;showScreen('datetime')}
els.prevMonth.onclick=async()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);await loadMonthAvailability()};els.nextMonth.onclick=async()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);await loadMonthAvailability()}
els.datetimeContinue.onclick=()=>{renderConfirmation();showScreen('confirm')};els.bookingForm.onsubmit=saveBooking;els.loginForm.onsubmit=login;els.logoutButton.onclick=logout
els.availabilityForm.onsubmit=addAvailability;els.refreshAvailability.onclick=loadAvailabilityAdmin;els.refreshAppointments.onclick=loadAppointments;els.blockForm.onsubmit=addBlock;els.refreshBlocks.onclick=loadBlocks

await loadServices();setAdminDateMins();const {data:{session}}=await supabase.auth.getSession();if(session&&location.hash==='#admin'){showScreen('admin');await loadAdminAll()}
