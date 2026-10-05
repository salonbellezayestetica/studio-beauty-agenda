import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://ywbmlsfxvytdmnkyjial.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Esj-3c_n0bYl0QwHzIp7kg_jGuUS2j9'

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const OPEN_MINUTES = 8 * 60
const CLOSE_MINUTES = 18 * 60
const SLOT_STEP = 30
const BUFFER_MINUTES = 10

const state = {
  services: [],
  service: null,
  date: '',
  timeLabel: '',
  startMinutes: null,
  busyRanges: []
}

const els = {
  servicesGrid: document.querySelector('#servicesGrid'),
  servicesStatus: document.querySelector('#servicesStatus'),
  dateInput: document.querySelector('#dateInput'),
  timesGrid: document.querySelector('#timesGrid'),
  timesStatus: document.querySelector('#timesStatus'),
  bookingForm: document.querySelector('#bookingForm'),
  nameInput: document.querySelector('#nameInput'),
  phoneInput: document.querySelector('#phoneInput'),
  summaryText: document.querySelector('#summaryText'),
  bookButton: document.querySelector('#bookButton'),
  formStatus: document.querySelector('#formStatus')
}

function pad(n) { return String(n).padStart(2, '0') }
function minutesToDbTime(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00` }
function dbTimeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function formatTime(m) {
  const h = Math.floor(m / 60)
  const min = m % 60
  const period = h >= 12 ? 'p. m.' : 'a. m.'
  const displayHour = h % 12 || 12
  return `${displayHour}:${pad(min)} ${period}`
}
function formatDate(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
function isSunday(value) {
  if (!value) return false
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0
}
function overlaps(a1, a2, b1, b2) {
  return a1 < b2 && a2 > b1
}

async function loadServices() {
  els.servicesStatus.textContent = 'Cargando servicios...'

  const { data, error } = await supabase
    .from('Servicios')
    .select('id, nombre, duracion_minutos')
    .eq('activo', true)
    .order('id')

  if (error) {
    console.error(error)
    els.servicesStatus.textContent = 'No pudimos cargar los servicios. Intenta de nuevo.'
    return
  }

  state.services = data || []
  renderServices()
  els.servicesStatus.textContent = state.services.length ? '' : 'No hay servicios disponibles.'
}

function renderServices() {
  els.servicesGrid.innerHTML = ''

  state.services.forEach(service => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'service-btn'
    btn.textContent = service.nombre
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.service-btn').forEach(x => x.classList.remove('selected'))
      btn.classList.add('selected')
      state.service = service
      state.timeLabel = ''
      state.startMinutes = null
      await refreshAvailability()
      updateSummary()
    })
    els.servicesGrid.appendChild(btn)
  })
}

async function getBusyRanges(date) {
  const { data, error } = await supabase.rpc('horarios_ocupados', { p_fecha: date })
  if (error) throw error

  return (data || []).map(row => ({
    start: dbTimeToMinutes(row.hora_inicio),
    end: dbTimeToMinutes(row.hora_fin)
  }))
}

async function refreshAvailability() {
  els.timesGrid.innerHTML = ''
  state.timeLabel = ''
  state.startMinutes = null
  updateSummary()

  if (!state.service || !state.date) {
    els.timesStatus.textContent = 'Primero selecciona un servicio y una fecha.'
    return
  }
  if (isSunday(state.date)) {
    els.timesStatus.textContent = 'Los domingos no hay atención. Selecciona otro día.'
    return
  }

  els.timesStatus.textContent = 'Consultando disponibilidad...'

  try {
    state.busyRanges = await getBusyRanges(state.date)
  } catch (error) {
    console.error(error)
    els.timesStatus.textContent = 'No pudimos consultar la agenda. Intenta nuevamente.'
    return
  }

  const duration = Number(state.service.duracion_minutos)
  const available = []

  for (let start = OPEN_MINUTES; start + duration <= CLOSE_MINUTES; start += SLOT_STEP) {
    const end = start + duration
    const collides = state.busyRanges.some(range =>
      overlaps(start, end + BUFFER_MINUTES, range.start, range.end)
    )
    if (!collides) available.push(start)
  }

  if (!available.length) {
    els.timesStatus.textContent = 'No hay horarios disponibles para ese día.'
    return
  }

  available.forEach(start => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'time-btn'
    btn.textContent = formatTime(start)
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(x => x.classList.remove('selected'))
      btn.classList.add('selected')
      state.startMinutes = start
      state.timeLabel = btn.textContent
      updateSummary()
    })
    els.timesGrid.appendChild(btn)
  })

  els.timesStatus.textContent = 'Selecciona la hora que prefieras.'
}

function updateSummary() {
  if (state.service && state.date && state.timeLabel) {
    els.summaryText.textContent = `${state.service.nombre} · ${formatDate(state.date)} · ${state.timeLabel}`
  } else if (state.service && state.date) {
    els.summaryText.textContent = `${state.service.nombre} · ${formatDate(state.date)} · selecciona una hora.`
  } else if (state.service) {
    els.summaryText.textContent = `${state.service.nombre} · selecciona fecha y hora.`
  } else {
    els.summaryText.textContent = 'Aún no has seleccionado tu cita.'
  }

  els.bookButton.disabled = !(state.service && state.date && state.startMinutes !== null)
}

els.dateInput.addEventListener('change', async event => {
  state.date = event.target.value
  await refreshAvailability()
})

els.bookingForm.addEventListener('submit', async event => {
  event.preventDefault()
  els.formStatus.className = 'form-status'
  els.formStatus.textContent = ''

  const nombre = els.nameInput.value.trim()
  const whatsapp = els.phoneInput.value.trim()

  if (!nombre || !whatsapp || !state.service || !state.date || state.startMinutes === null) {
    els.formStatus.classList.add('error')
    els.formStatus.textContent = 'Completa todos los datos de la cita.'
    return
  }

  els.bookButton.disabled = true
  els.bookButton.textContent = 'Reservando...'

  try {
    const latestBusy = await getBusyRanges(state.date)
    const endMinutes = state.startMinutes + Number(state.service.duracion_minutos)
    const hasCollision = latestBusy.some(range =>
      overlaps(state.startMinutes, endMinutes + BUFFER_MINUTES, range.start, range.end)
    )

    if (hasCollision) {
      els.formStatus.classList.add('error')
      els.formStatus.textContent = 'Ese horario acaba de ocuparse. Elige otro horario.'
      await refreshAvailability()
      return
    }

    const { error } = await supabase
      .from('Citas')
      .insert({
        nombre_cliente: nombre,
        whatsapp,
        servicio_id: state.service.id,
        fecha: state.date,
        hora_inicio: minutesToDbTime(state.startMinutes),
        hora_fin: minutesToDbTime(endMinutes),
        estado: 'confirmada'
      })

    if (error) throw error

    els.formStatus.classList.add('success')
    els.formStatus.textContent = '¡Listo! Tu cita quedó reservada.'
    els.bookingForm.reset()
    state.service = null
    state.date = ''
    state.timeLabel = ''
    state.startMinutes = null
    document.querySelectorAll('.service-btn, .time-btn').forEach(x => x.classList.remove('selected'))
    els.timesGrid.innerHTML = ''
    els.timesStatus.textContent = 'Primero selecciona un servicio y una fecha.'
    updateSummary()
  } catch (error) {
    console.error(error)
    els.formStatus.classList.add('error')
    els.formStatus.textContent = 'No pudimos guardar la cita. Intenta nuevamente.'
  } finally {
    els.bookButton.textContent = 'Reservar cita'
    updateSummary()
  }
})

loadServices()
updateSummary()
