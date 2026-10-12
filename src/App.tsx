import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  checkApiHealth,
  createAdmission,
  createAppointment,
  createEmergencyCase,
  createInvoice,
  createLabOrder,
  createPatient,
  createPrescription,
  dischargeAdmission,
  dispensePrescription,
  downloadExport,
  getAdmissions,
  getAppointments,
  getBeds,
  getCurrentUser,
  getDashboard,
  getEmergencyCases,
  getHealthMetrics,
  getInsuranceClaims,
  getInvoices,
  getLabs,
  getMedications,
  getNotifications,
  getPatients,
  getPrescriptions,
  logHealthMetric,
  login as apiLogin,
  logout as apiLogout,
  markAllNotificationsRead,
  markNotificationRead,
  payInvoice,
  register as apiRegister,
  updateAppointment,
  updateBedStatus,
  updateEmergencyCase,
  updateLabOrder,
  type ApiAdmission,
  type ApiAppointment,
  type ApiBed,
  type ApiDashboardSummary,
  type ApiEmergencyCase,
  type ApiInvoice,
  type ApiLabOrder,
  type ApiMedication,
  type ApiNotification,
  type ApiPatient,
  type ApiPrescription,
  type ApiStatus,
  type ApiUser,
  type RemoteHealthMetric,
} from './api'

type Role = 'Admin' | 'Doctor' | 'Staff' | 'Patient'
type Theme = 'light' | 'dark'
type FeedbackTone = 'success' | 'alert' | 'tap'
type IconName =
  | 'activity'
  | 'alert'
  | 'arrow'
  | 'bed'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'download'
  | 'file'
  | 'filter'
  | 'flask'
  | 'grid'
  | 'heart'
  | 'home'
  | 'lab'
  | 'logout'
  | 'menu'
  | 'message'
  | 'moon'
  | 'more'
  | 'people'
  | 'pharmacy'
  | 'plus'
  | 'reports'
  | 'search'
  | 'settings'
  | 'shield'
  | 'spark'
  | 'sun'
  | 'user'
  | 'vibrate'
  | 'volume'
  | 'volumeOff'
  | 'x'

type NavItem = { label: string; icon: IconName }

type Kpi = {
  label: string
  value: string
  delta: string
  deltaTone: 'positive' | 'negative' | 'neutral'
  note: string
  color: string
  icon: IconName
  points: string
}

type DetailItem = {
  eyebrow: string
  title: string
  meta: string
  tone: 'cyan' | 'mint' | 'violet' | 'coral'
  icon: IconName
  facts: { label: string; value: string }[]
  timeline?: { label: string; value: string }[]
  actionLabel?: string
  actionType?: 'complete_appointment' | 'cancel_appointment' | 'dispense_rx' | 'discharge_admission' | 'pay_invoice' | 'complete_lab' | 'treat_emergency'
  rawId?: string
}

type ModalType = 'appointment' | 'emergency' | 'health_metric' | 'patient' | 'prescription' | 'lab' | 'admission' | 'invoice'

const roleProfiles: Record<Role, { name: string; title: string; initials: string; workspace: string }> = {
  Admin: { name: 'Dr. Morgan', title: 'Chief Medical Officer', initials: 'DM', workspace: 'Operations' },
  Doctor: { name: 'Dr. Elena Ruiz', title: 'Cardiology · Clinician', initials: 'ER', workspace: 'Clinical workspace' },
  Staff: { name: 'James Wilson', title: 'Care Coordinator', initials: 'JW', workspace: 'Front desk' },
  Patient: { name: 'Olivia Harris', title: 'Patient portal', initials: 'OH', workspace: 'My health' },
}

const navByRole: Record<Role, NavItem[]> = {
  Admin: [
    { label: 'Operations', icon: 'activity' },
    { label: 'Patients', icon: 'people' },
    { label: 'Appointments', icon: 'calendar' },
    { label: 'Inpatient Care', icon: 'bed' },
    { label: 'Emergency', icon: 'alert' },
    { label: 'Pharmacy', icon: 'pharmacy' },
    { label: 'Lab & Diagnostics', icon: 'flask' },
    { label: 'Billing & Revenue', icon: 'reports' },
    { label: 'Reports', icon: 'grid' },
    { label: 'Settings', icon: 'settings' },
  ],
  Doctor: [
    { label: 'My dashboard', icon: 'activity' },
    { label: 'My patients', icon: 'people' },
    { label: 'Appointments', icon: 'calendar' },
    { label: 'Prescriptions', icon: 'pharmacy' },
    { label: 'Lab results', icon: 'flask' },
    { label: 'Messages', icon: 'message' },
  ],
  Staff: [
    { label: 'Front desk', icon: 'activity' },
    { label: 'Patients', icon: 'people' },
    { label: 'Queue management', icon: 'clock' },
    { label: 'Beds & wards', icon: 'bed' },
    { label: 'Lab & Diagnostics', icon: 'flask' },
    { label: 'Billing support', icon: 'reports' },
  ],
  Patient: [
    { label: 'My health', icon: 'heart' },
    { label: 'Health tracker', icon: 'activity' },
    { label: 'Appointments', icon: 'calendar' },
    { label: 'Prescriptions', icon: 'pharmacy' },
    { label: 'Lab reports', icon: 'flask' },
    { label: 'Bills & insurance', icon: 'reports' },
    { label: 'Messages', icon: 'message' },
  ],
}

const healthMetrics = [
  { label: 'Steps', value: '6,842', goal: '8,000 goal', progress: 86, tone: 'cyan' as const, icon: 'activity' as IconName, meta: 'Today · 4.8 km walked' },
  { label: 'Heart rate', value: '72 bpm', goal: 'Resting average', progress: 72, tone: 'coral' as const, icon: 'heart' as IconName, meta: 'Healthy range · 60–100 bpm' },
  { label: 'Sleep', value: '7h 42m', goal: '8h goal', progress: 96, tone: 'violet' as const, icon: 'moon' as IconName, meta: 'Quality score · 91 / 100' },
  { label: 'Hydration', value: '1.6 L', goal: '2.0 L goal', progress: 80, tone: 'cyan' as const, icon: 'spark' as IconName, meta: '8 glasses · 400 ml remaining' },
  { label: 'Blood oxygen', value: '98%', goal: 'Last checked 09:12', progress: 98, tone: 'mint' as const, icon: 'activity' as IconName, meta: 'Within your personal range' },
  { label: 'Weight', value: '68.4 kg', goal: '−0.6 kg this month', progress: 74, tone: 'mint' as const, icon: 'reports' as IconName, meta: 'BMI 22.1 · Healthy range' },
]

const healthMetricTypes: Record<string, RemoteHealthMetric['metricType']> = {
  Steps: 'steps',
  'Heart rate': 'heart_rate',
  Sleep: 'sleep',
  Hydration: 'hydration',
  'Blood oxygen': 'blood_oxygen',
  Weight: 'weight',
}

function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'activity': return <svg {...common}><path d="M3 12h3l2-7 4 14 2-7h7" /><path d="M4 19h16" /></svg>
    case 'alert': return <svg {...common}><path d="m10.3 3.9-7 12.2A1.8 1.8 0 0 0 4.9 19h14.2a1.8 1.8 0 0 0 1.6-2.9l-7-12.2a1.9 1.9 0 0 0-3.4 0Z" /><path d="M12 9v4M12 16h.01" /></svg>
    case 'arrow': return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    case 'bed': return <svg {...common}><path d="M3 18v-7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7M3 14h17a1 1 0 0 1 1 1v3M3 20v-2M21 20v-2M12 12h8" /></svg>
    case 'bell': return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    case 'calendar': return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></svg>
    case 'check': return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>
    case 'chevron': return <svg {...common}><path d="m7 9 5 5 5-5" /></svg>
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>
    case 'download': return <svg {...common}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
    case 'file': return <svg {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></svg>
    case 'filter': return <svg {...common}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
    case 'flask': return <svg {...common}><path d="M9 3h6M10 3v6L4.8 18.2A1.8 1.8 0 0 0 6.3 21h11.4a1.8 1.8 0 0 0 1.5-2.8L14 9V3M7.5 16h9" /></svg>
    case 'grid': return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
    case 'heart': return <svg {...common}><path d="M20.8 8.7c0 5.3-8.8 10.1-8.8 10.1S3.2 14 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
    case 'home': return <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'lab': return <svg {...common}><path d="M9 3h6M10 3v6l-5.6 8.8A1.5 1.5 0 0 0 5.7 20h12.6a1.5 1.5 0 0 0 1.3-2.2L14 9V3M7.6 15h8.8" /></svg>
    case 'logout': return <svg {...common}><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M15 16l4-4-4-4M19 12H9" /></svg>
    case 'menu': return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    case 'message': return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" /><path d="M8 8h8M8 11h5" /></svg>
    case 'moon': return <svg {...common}><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" /></svg>
    case 'more': return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
    case 'people': return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c.2-3.1 2.2-5 6-5s5.8 1.9 6 5M16 5.5a3 3 0 0 1 0 5.7M17.5 15c2.1.4 3.3 2 3.5 4.2" /></svg>
    case 'pharmacy': return <svg {...common}><path d="m8 3 13 13-5 5L3 8zM5.5 5.5l13 13M8 12l4-4M11 15l4-4" /></svg>
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
    case 'reports': return <svg {...common}><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></svg>
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
    case 'settings': return <svg {...common}><path d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" /><path d="m19.4 15.2 1.1 1.9-2.1 2.1-1.9-1.1a7.7 7.7 0 0 1-2.1.9l-.5 2.1h-3l-.5-2.1a7.7 7.7 0 0 1-2.1-.9l-1.9 1.1-2.1-2.1 1.1-1.9a7.7 7.7 0 0 1-.9-2.1l-2.1-.5v-3l2.1-.5a7.7 7.7 0 0 1 .9-2.1L3.4 5.1 5.5 3l1.9 1.1a7.7 7.7 0 0 1 2.1-.9l.5-2.1h3l.5 2.1a7.7 7.7 0 0 1 2.1.9L17.5 3l2.1 2.1-1.1 1.9a7.7 7.7 0 0 1 .9 2.1l2.1.5v3l-2.1.5a7.7 7.7 0 0 1-.9 2.1Z" /></svg>
    case 'shield': return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></svg>
    case 'spark': return <svg {...common}><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" /></svg>
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="3.3" /><path d="M4.5 20c.5-3.3 3-5.2 7.5-5.2s7 1.9 7.5 5.2" /></svg>
    case 'vibrate': return <svg {...common}><path d="M8 5h8v14H8zM5 8v8M2 9.5v5M19 8v8M22 9.5v5" /></svg>
    case 'volume': return <svg {...common}><path d="M4 10v4h3l4 3V7l-4 3zM15 9.5a4 4 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" /></svg>
    case 'volumeOff': return <svg {...common}><path d="M4 10v4h3l4 3V7l-4 3zM16 10l5 5M21 10l-5 5" /></svg>
    case 'x': return <svg {...common}><path d="M5 5l14 14M19 5 5 19" /></svg>
  }
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>
}

function Sparkline({ points, color }: { points: string; color: string }) {
  return <svg className={`sparkline sparkline-${color}`} viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return <article className="kpi-card">
    <div className={`kpi-icon kpi-icon-${kpi.color}`}><Icon name={kpi.icon} size={22} /></div>
    <div className="kpi-copy"><span>{kpi.label}</span><strong>{kpi.value}</strong><div className={`kpi-delta ${kpi.deltaTone}`}><Icon name={kpi.deltaTone === 'negative' ? 'alert' : kpi.deltaTone === 'positive' ? 'arrow' : 'activity'} size={12} />{kpi.delta}<small>{kpi.note}</small></div></div>
    <Sparkline points={kpi.points} color={kpi.color} />
  </article>
}

function FlowChart({ range }: { range: 'Today' | '7d' | '30d' }) {
  const multiplier = range === 'Today' ? 1 : range === '7d' ? 0.88 : 0.7
  const lineA = [35, 50, 44, 57, 70, 62, 46, 48, 55, 47].map((v) => Math.round(v * multiplier))
  const lineB = [22, 30, 28, 31, 42, 39, 32, 29, 35, 31].map((v) => Math.round(v * multiplier))
  const lineC = [8, 14, 18, 13, 20, 25, 15, 13, 19, 22].map((v) => Math.round(v * multiplier))
  const x = (index: number) => 22 + index * 41
  const y = (value: number) => 142 - value * 1.55
  const polyline = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  return <div className="flow-chart" aria-label={`Patient flow for ${range}`}>
    <svg viewBox="0 0 405 165" role="img">
      <defs><linearGradient id="flow-cyan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#19c5d1" stopOpacity=".24" /><stop offset="1" stopColor="#19c5d1" stopOpacity="0" /></linearGradient></defs>
      {[20, 56, 92, 128].map((line) => <line key={line} className="chart-grid" x1="22" x2="390" y1={line} y2={line} />)}
      {[22, 63, 104, 145, 186, 227, 268, 309, 350, 390].map((line) => <line key={line} className="chart-grid chart-grid-vertical" x1={line} x2={line} y1="20" y2="142" />)}
      <polyline className="chart-area" points={`22,142 ${polyline(lineA)} 390,142`} />
      <polyline className="flow-line flow-line-cyan" points={polyline(lineA)} />
      <polyline className="flow-line flow-line-violet" points={polyline(lineB)} />
      <polyline className="flow-line flow-line-mint" points={polyline(lineC)} />
      {lineA.map((value, index) => <circle className="flow-point flow-point-cyan" key={`a-${index}`} cx={x(index)} cy={y(value)} r="3.6" />)}
      {lineB.map((value, index) => <circle className="flow-point flow-point-violet" key={`b-${index}`} cx={x(index)} cy={y(value)} r="3.6" />)}
      {lineC.map((value, index) => <circle className="flow-point flow-point-mint" key={`c-${index}`} cx={x(index)} cy={y(value)} r="3.6" />)}
    </svg>
    <div className="chart-y-axis"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
    <div className="chart-x-axis"><span>6am</span><span>8am</span><span>10am</span><span>12pm</span><span>2pm</span><span>4pm</span><span>6pm</span><span>8pm</span><span>10pm</span></div>
  </div>
}

function App() {
  const [role, setRole] = useState<Role>('Admin')
  const [activeNav, setActiveNav] = useState('Operations')
  const [range, setRange] = useState<'Today' | '7d' | '30d'>('Today')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = window.localStorage.getItem('medinexus-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [hapticsEnabled, setHapticsEnabled] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [sessionUser, setSessionUser] = useState<ApiUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  
  // Real server entities
  const [dashboardSummary, setDashboardSummary] = useState<ApiDashboardSummary | null>(null)
  const [liveAppointments, setLiveAppointments] = useState<ApiAppointment[]>([])
  const [livePatients, setLivePatients] = useState<ApiPatient[]>([])
  const [liveBeds, setLiveBeds] = useState<ApiBed[]>([])
  const [liveAdmissions, setLiveAdmissions] = useState<ApiAdmission[]>([])
  const [liveEmergencyCases, setLiveEmergencyCases] = useState<ApiEmergencyCase[]>([])
  const [liveMedications, setLiveMedications] = useState<ApiMedication[]>([])
  const [livePrescriptions, setLivePrescriptions] = useState<ApiPrescription[]>([])
  const [liveLabs, setLiveLabs] = useState<ApiLabOrder[]>([])
  const [liveInvoices, setLiveInvoices] = useState<ApiInvoice[]>([])
  const [remoteHealthMetrics, setRemoteHealthMetrics] = useState<RemoteHealthMetric[]>([])
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  
  // Navigation & Modals
  const [roleOpen, setRoleOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [modal, setModal] = useState<ModalType | null>(null)
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showAllSchedule, setShowAllSchedule] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('medinexus-theme', theme)
  }, [theme])

  // Initial API health & session check
  useEffect(() => {
    const controller = new AbortController()
    checkApiHealth(controller.signal)
      .then(() => setApiStatus('connected'))
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('offline')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then((user) => {
        if (!active || !user) return
        setSessionUser(user)
        setRole(user.role)
        setActiveNav(navByRole[user.role][0].label)
      })
      .catch(() => {
        // Offline demo workspace remains active
      })
    return () => { active = false }
  }, [])

  // Sync state with URL hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '')
      if (!hash) return
      const parts = hash.split('/')
      if (parts.length >= 2) {
        const hashRole = parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()
        if (['Admin', 'Doctor', 'Staff', 'Patient'].includes(hashRole)) {
          setRole(hashRole as Role)
          const targetNav = decodeURIComponent(parts.slice(1).join('/')).replace(/-/g, ' ')
          const matched = navByRole[hashRole as Role].find((item) => item.label.toLowerCase() === targetNav.toLowerCase())
          if (matched) setActiveNav(matched.label)
        }
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // Refresh active module data from API
  const refreshData = () => {
    if (apiStatus !== 'connected') return

    getDashboard()
      .then((res) => {
        setDashboardSummary(res.summary)
        setLiveAppointments(res.appointments)
      })
      .catch(() => {})

    getNotifications()
      .then((res) => setNotifications(res))
      .catch(() => {})

    if (activeNav === 'Patients' || activeNav === 'My patients') {
      getPatients()
        .then((pts) => setLivePatients(pts))
        .catch(() => {})
    } else if (activeNav === 'Appointments') {
      getAppointments()
        .then((apts) => setLiveAppointments(apts))
        .catch(() => {})
    } else if (activeNav === 'Inpatient Care' || activeNav === 'Beds & wards') {
      getBeds().then(setLiveBeds).catch(() => {})
      getAdmissions().then(setLiveAdmissions).catch(() => {})
    } else if (activeNav === 'Emergency' || activeNav === 'Queue management') {
      getEmergencyCases().then(setLiveEmergencyCases).catch(() => {})
    } else if (activeNav === 'Pharmacy' || activeNav === 'Prescriptions') {
      getMedications().then(setLiveMedications).catch(() => {})
      getPrescriptions().then(setLivePrescriptions).catch(() => {})
    } else if (activeNav === 'Lab & Diagnostics' || activeNav === 'Lab results' || activeNav === 'Lab reports') {
      getLabs().then(setLiveLabs).catch(() => {})
    } else if (activeNav === 'Billing & Revenue' || activeNav === 'Billing support' || activeNav === 'Bills & insurance') {
      getInvoices().then(setLiveInvoices).catch(() => {})
    } else if (activeNav === 'Health tracker' || role === 'Patient') {
      getHealthMetrics().then(setRemoteHealthMetrics).catch(() => {})
    }
  }

  useEffect(() => {
    refreshData()
  }, [activeNav, role, apiStatus, sessionUser])

  // Keyboard shortcut & Escape handlers
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null)
        setRoleOpen(false)
        setNotificationsOpen(false)
        setPreferencesOpen(false)
        setDetailItem(null)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const profile = sessionUser
    ? { ...roleProfiles[role], name: sessionUser.name, initials: sessionUser.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
    : roleProfiles[role]
  const navItems = navByRole[role]
  const workspaceRoles: Role[] = sessionUser ? [sessionUser.role] : (Object.keys(roleProfiles) as Role[])
  const isDashboard = activeNav === navItems[0].label

  // Compute live KPIs
  const kpis: Kpi[] = useMemo(() => {
    if (role === 'Patient') {
      const aptCount = dashboardSummary?.appointments ?? 3
      const rxCount = dashboardSummary?.activePrescriptions ?? 1
      const balance = dashboardSummary?.outstandingBalance ?? 240
      return [
        { label: 'Upcoming visits', value: String(aptCount), delta: 'Scheduled', deltaTone: 'neutral', note: 'patient portal', color: 'cyan', icon: 'calendar', points: '2,21 14,18 26,21 38,16 50,19 62,14 74,17 86,12 98,14' },
        { label: 'Active prescriptions', value: String(rxCount), delta: 'On track', deltaTone: 'positive', note: 'active regimen', color: 'mint', icon: 'pharmacy', points: '2,25 14,22 26,24 38,20 50,19 62,15 74,16 86,11 98,9' },
        { label: 'Care plan adherence', value: '94%', delta: '+6%', deltaTone: 'positive', note: 'vs. last check-in', color: 'violet', icon: 'heart', points: '2,28 14,25 26,24 38,20 50,18 62,16 74,12 86,11 98,6' },
        { label: 'Outstanding balance', value: `$${balance}`, delta: balance > 0 ? 'Due soon' : 'Zero balance', deltaTone: balance > 0 ? 'negative' : 'positive', note: 'billing summary', color: 'coral', icon: 'reports', points: '2,10 14,15 26,13 38,18 50,17 62,19 74,18 86,24 98,22' },
      ]
    }
    const aptCount = dashboardSummary?.appointments ?? (liveAppointments.length || 48)
    const patientCount = dashboardSummary?.patients ?? (livePatients.length || 136)
    const bedRate = dashboardSummary?.bedOccupancyRate !== undefined ? `${dashboardSummary.bedOccupancyRate}%` : '78%'
    const revenue = dashboardSummary?.monthlyRevenue ? `$${(dashboardSummary.monthlyRevenue / 1000).toFixed(0)}K` : '$2.4M'
    return [
      { label: 'Appointments', value: String(aptCount), delta: '+12%', deltaTone: 'positive', note: 'active scheduled visits', color: 'cyan', icon: 'calendar', points: '2,26 14,21 26,24 38,16 50,19 62,11 74,13 86,7 98,10' },
      { label: 'Patients in care', value: String(patientCount), delta: '+6%', deltaTone: 'positive', note: 'across departments', color: 'mint', icon: 'people', points: '2,28 14,24 26,25 38,18 50,20 62,13 74,14 86,5 98,8' },
      { label: 'Bed occupancy', value: bedRate, delta: '+4%', deltaTone: 'negative', note: 'inpatient ward load', color: 'coral', icon: 'bed', points: '2,24 14,23 26,19 38,23 50,17 62,20 74,12 86,14 98,5' },
      { label: 'Revenue this month', value: revenue, delta: '+18%', deltaTone: 'positive', note: 'settled collections', color: 'violet', icon: 'reports', points: '2,28 14,22 26,25 38,19 50,20 62,13 74,15 86,7 98,9' },
    ]
  }, [role, dashboardSummary, liveAppointments, livePatients])

  // Derive rows for active module
  type DisplayRow = {
    id: string
    label: string
    meta: string
    value: string
    tone: 'cyan' | 'mint' | 'violet' | 'coral'
    detail: DetailItem
  }

  const moduleRows: DisplayRow[] = useMemo(() => {
    if (activeNav === 'Patients' || activeNav === 'My patients') {
      if (livePatients.length > 0) {
        return livePatients.map((p) => ({
          id: p.id,
          label: p.name,
          meta: `${p.id} · ${p.department}`,
          value: p.status,
          tone: p.status === 'Critical' ? 'coral' : p.status === 'Stable' ? 'mint' : 'cyan',
          detail: {
            eyebrow: 'Patient Profile',
            title: p.name,
            meta: `${p.id} · ${p.department} · ${p.status}`,
            tone: p.status === 'Critical' ? 'coral' : 'cyan',
            icon: 'people',
            facts: [
              { label: 'Patient ID', value: p.id },
              { label: 'Department', value: p.department },
              { label: 'Status', value: p.status },
              { label: 'DOB', value: p.dob || 'Unspecified' },
              { label: 'Gender', value: p.gender || 'Unspecified' },
              { label: 'Blood Group', value: p.bloodGroup || 'Unspecified' },
              { label: 'Allergies', value: p.allergies || 'None reported' },
            ],
            timeline: [{ label: 'Enrolled', value: new Date(p.createdAt).toLocaleDateString() }],
            actionLabel: 'Schedule Appointment',
            rawId: p.id,
          },
        }))
      }
    }

    if (activeNav === 'Appointments') {
      if (liveAppointments.length > 0) {
        return liveAppointments.map((a) => {
          const dateStr = new Date(a.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return {
            id: a.id,
            label: a.patientName || `Patient (${a.patientId})`,
            meta: `${dateStr} · ${a.department} · ${a.clinicianName}`,
            value: a.status,
            tone: a.status === 'Completed' ? 'mint' : a.status === 'Cancelled' ? 'coral' : 'cyan',
            detail: {
              eyebrow: 'Appointment',
              title: a.patientName || a.patientId,
              meta: `${a.department} · ${a.clinicianName} · ${a.room}`,
              tone: a.status === 'Completed' ? 'mint' : 'violet',
              icon: 'calendar',
              facts: [
                { label: 'Appointment ID', value: a.id },
                { label: 'Patient', value: a.patientName || a.patientId },
                { label: 'Clinician', value: a.clinicianName },
                { label: 'Department', value: a.department },
                { label: 'Room', value: a.room },
                { label: 'Scheduled', value: new Date(a.appointmentAt).toLocaleString() },
                { label: 'Notes', value: a.notes || 'None' },
              ],
              actionLabel: a.status !== 'Completed' ? 'Mark Completed' : undefined,
              actionType: 'complete_appointment',
              rawId: a.id,
            },
          }
        })
      }
    }

    if (activeNav === 'Inpatient Care' || activeNav === 'Beds & wards') {
      if (liveBeds.length > 0) {
        return liveBeds.map((b) => ({
          id: b.id,
          label: `${b.ward} — Room ${b.roomNumber}`,
          meta: `${b.bedNumber} · Type: ${b.bedType}`,
          value: b.status,
          tone: b.status === 'Occupied' ? 'coral' : b.status === 'Available' ? 'mint' : 'violet',
          detail: {
            eyebrow: 'Inpatient Bed',
            title: `${b.ward} · ${b.bedNumber}`,
            meta: `Room ${b.roomNumber} · ${b.bedType} Bed`,
            tone: b.status === 'Occupied' ? 'coral' : 'mint',
            icon: 'bed',
            facts: [
              { label: 'Bed ID', value: b.id },
              { label: 'Ward', value: b.ward },
              { label: 'Room', value: b.roomNumber },
              { label: 'Status', value: b.status },
            ],
            actionLabel: b.status === 'Available' ? 'Admit Patient to Bed' : b.status === 'Cleaning' ? 'Mark Available' : undefined,
            rawId: b.id,
          },
        }))
      }
    }

    if (activeNav === 'Emergency' || activeNav === 'Queue management') {
      if (liveEmergencyCases.length > 0) {
        return liveEmergencyCases.map((e) => ({
          id: e.id,
          label: e.patientName,
          meta: `Acuity ${e.triageAcuity} · ${e.assignedTeam} · ${e.chiefComplaint}`,
          value: e.status,
          tone: e.triageAcuity <= 2 ? 'coral' : e.triageAcuity === 3 ? 'violet' : 'cyan',
          detail: {
            eyebrow: 'Emergency Triage Case',
            title: e.patientName,
            meta: `Acuity ${e.triageAcuity} · ${e.assignedTeam} Team · ${e.status}`,
            tone: e.triageAcuity <= 2 ? 'coral' : 'violet',
            icon: 'alert',
            facts: [
              { label: 'Case ID', value: e.id },
              { label: 'Patient Name', value: e.patientName },
              { label: 'Chief Complaint', value: e.chiefComplaint },
              { label: 'Acuity Level', value: `Level ${e.triageAcuity} (${e.triageAcuity === 1 ? 'Resuscitation' : e.triageAcuity === 2 ? 'Emergent' : 'Urgent'})` },
              { label: 'Vitals', value: e.vitals || 'Not documented' },
              { label: 'Assigned Team', value: e.assignedTeam },
              { label: 'Arrived', value: new Date(e.arrivalTime).toLocaleTimeString() },
            ],
            actionLabel: e.status === 'Triage' ? 'Advance to Treatment' : e.status === 'In Treatment' ? 'Mark Discharged' : undefined,
            actionType: 'treat_emergency',
            rawId: e.id,
          },
        }))
      }
    }

    if (activeNav === 'Pharmacy') {
      if (liveMedications.length > 0) {
        return liveMedications.map((m) => ({
          id: m.id,
          label: m.name,
          meta: `${m.code} · ${m.category} · ${m.stockQuantity} ${m.unit}`,
          value: m.status,
          tone: m.status === 'Out of stock' ? 'coral' : m.status === 'Low stock' ? 'violet' : 'mint',
          detail: {
            eyebrow: 'Medication Inventory',
            title: m.name,
            meta: `Code: ${m.code} · Category: ${m.category}`,
            tone: m.status === 'In stock' ? 'mint' : 'coral',
            icon: 'pharmacy',
            facts: [
              { label: 'Code', value: m.code },
              { label: 'Stock', value: `${m.stockQuantity} ${m.unit}` },
              { label: 'Reorder Level', value: String(m.reorderLevel) },
              { label: 'Unit Price', value: `$${m.unitPrice.toFixed(2)}` },
              { label: 'Status', value: m.status },
            ],
            actionLabel: 'Restock Medication',
            rawId: m.id,
          },
        }))
      }
    }

    if (activeNav === 'Prescriptions') {
      if (livePrescriptions.length > 0) {
        return livePrescriptions.map((pr) => ({
          id: pr.id,
          label: pr.medicationName,
          meta: `${pr.patientName || 'Patient'} · ${pr.dosage} · Dr. ${pr.doctorName}`,
          value: pr.status,
          tone: pr.status === 'Active' ? 'mint' : 'cyan',
          detail: {
            eyebrow: 'Prescription Order',
            title: pr.medicationName,
            meta: `For ${pr.patientName || pr.patientId} by ${pr.doctorName}`,
            tone: 'mint',
            icon: 'pharmacy',
            facts: [
              { label: 'Prescription ID', value: pr.id },
              { label: 'Medication', value: pr.medicationName },
              { label: 'Dosage', value: pr.dosage },
              { label: 'Frequency', value: pr.frequency },
              { label: 'Duration', value: pr.duration },
              { label: 'Status', value: pr.status },
            ],
            actionLabel: pr.status === 'Active' ? 'Dispense Medication' : undefined,
            actionType: 'dispense_rx',
            rawId: pr.id,
          },
        }))
      }
    }

    if (activeNav === 'Lab & Diagnostics' || activeNav === 'Lab results' || activeNav === 'Lab reports') {
      if (liveLabs.length > 0) {
        return liveLabs.map((l) => ({
          id: l.id,
          label: `${l.testType} · ${l.patientName}`,
          meta: `Ordered by ${l.orderedByName} · Priority: ${l.priority}`,
          value: l.status,
          tone: l.status === 'Completed' ? 'mint' : l.priority === 'Stat' ? 'coral' : 'violet',
          detail: {
            eyebrow: 'Laboratory Diagnostics',
            title: l.testType,
            meta: `Patient: ${l.patientName} · ${l.status}`,
            tone: l.status === 'Completed' ? 'mint' : 'violet',
            icon: 'flask',
            facts: [
              { label: 'Order ID', value: l.id },
              { label: 'Test Type', value: l.testType },
              { label: 'Priority', value: l.priority },
              { label: 'Ordered By', value: l.orderedByName },
              { label: 'Result Summary', value: l.resultSummary || 'Awaiting lab processing' },
              { label: 'Normal Range', value: l.normalRange || 'N/A' },
              { label: 'Interpretation', value: l.interpretation || 'Pending analysis' },
            ],
            actionLabel: l.status !== 'Completed' ? 'Enter Diagnostic Result' : undefined,
            actionType: 'complete_lab',
            rawId: l.id,
          },
        }))
      }
    }

    if (activeNav === 'Billing & Revenue' || activeNav === 'Billing support' || activeNav === 'Bills & insurance') {
      if (liveInvoices.length > 0) {
        return liveInvoices.map((inv) => ({
          id: inv.id,
          label: `${inv.invoiceNumber} · ${inv.patientName}`,
          meta: `${inv.description} · Due: ${inv.dueDate}`,
          value: `$${inv.amount.toFixed(2)} (${inv.status})`,
          tone: inv.status === 'Paid' ? 'mint' : inv.status === 'Overdue' ? 'coral' : 'violet',
          detail: {
            eyebrow: 'Billing Invoice',
            title: inv.invoiceNumber,
            meta: `Patient: ${inv.patientName} · Status: ${inv.status}`,
            tone: inv.status === 'Paid' ? 'mint' : 'coral',
            icon: 'reports',
            facts: [
              { label: 'Invoice No', value: inv.invoiceNumber },
              { label: 'Description', value: inv.description },
              { label: 'Total Amount', value: `$${inv.amount.toFixed(2)}` },
              { label: 'Insurance Paid', value: `$${inv.insuranceCoverage.toFixed(2)}` },
              { label: 'Patient Due', value: `$${inv.patientDue.toFixed(2)}` },
              { label: 'Due Date', value: inv.dueDate },
            ],
            actionLabel: inv.status !== 'Paid' ? 'Settle & Pay Invoice' : undefined,
            actionType: 'pay_invoice',
            rawId: inv.id,
          },
        }))
      }
    }

    // Default fallback demo items when offline or bootstrapping
    return [
      { id: '1', label: 'Olivia Harris', meta: 'P-20391 · Cardiology', value: 'Stable', tone: 'mint', detail: { eyebrow: 'Patient', title: 'Olivia Harris', meta: 'Cardiology · Stable', tone: 'mint', icon: 'people', facts: [{ label: 'ID', value: 'P-20391' }] } },
      { id: '2', label: 'James Patel', meta: 'P-19402 · Internal Medicine', value: 'New intake', tone: 'cyan', detail: { eyebrow: 'Patient', title: 'James Patel', meta: 'Internal Medicine', tone: 'cyan', icon: 'people', facts: [{ label: 'ID', value: 'P-19402' }] } },
      { id: '3', label: 'Maria Lopez', meta: 'P-18841 · Surgery', value: 'Pre-op', tone: 'violet', detail: { eyebrow: 'Patient', title: 'Maria Lopez', meta: 'Surgery', tone: 'violet', icon: 'people', facts: [{ label: 'ID', value: 'P-18841' }] } },
      { id: '4', label: 'Robert Chen', meta: 'P-17438 · Endocrinology', value: 'Follow-up', tone: 'cyan', detail: { eyebrow: 'Patient', title: 'Robert Chen', meta: 'Endocrinology', tone: 'cyan', icon: 'people', facts: [{ label: 'ID', value: 'P-17438' }] } },
    ]
  }, [activeNav, livePatients, liveAppointments, liveBeds, liveEmergencyCases, liveMedications, livePrescriptions, liveLabs, liveInvoices])

  // Filtered rows by search and status filter
  const filteredRows = useMemo(() => {
    let result = moduleRows
    if (statusFilter !== 'All') {
      result = result.filter((row) => row.value.toLowerCase().includes(statusFilter.toLowerCase()))
    }
    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter((row) => `${row.label} ${row.meta} ${row.value}`.toLowerCase().includes(query))
    }
    return result
  }, [moduleRows, search, statusFilter])

  const triggerFeedback = (tone: FeedbackTone = 'success') => {
    if (hapticsEnabled && 'vibrate' in navigator) {
      navigator.vibrate(tone === 'alert' ? [70, 40, 120] : tone === 'tap' ? 18 : 35)
    }
    if (!soundEnabled) return
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = tone === 'alert' ? 'square' : 'sine'
      oscillator.frequency.value = tone === 'alert' ? 220 : tone === 'tap' ? 480 : 620
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(tone === 'alert' ? 0.035 : 0.02, context.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.12)
      oscillator.addEventListener('ended', () => void context.close())
    } catch {
      // Audio enhancement only
    }
  }

  const handleAction = (message: string, tone: FeedbackTone = 'success') => {
    triggerFeedback(tone)
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  const openDetail = (item: DetailItem) => {
    triggerFeedback('tap')
    setDetailItem(item)
  }

  const handleRoleChange = (nextRole: Role) => {
    if (sessionUser && nextRole !== sessionUser.role) {
      setRoleOpen(false)
      handleAction(`${sessionUser.role} accounts cannot switch into another role`, 'alert')
      return
    }
    setRole(nextRole)
    const firstNav = navByRole[nextRole][0].label
    setActiveNav(firstNav)
    window.location.hash = `#/${nextRole.toLowerCase()}/${firstNav.toLowerCase().replace(/\s+/g, '-')}`
    setRoleOpen(false)
    handleAction(`${nextRole} workspace loaded`, 'tap')
  }

  const handleNavChange = (label: string) => {
    setActiveNav(label)
    setMobileNavOpen(false)
    setStatusFilter('All')
    triggerFeedback('tap')
    window.location.hash = `#/${role.toLowerCase()}/${label.toLowerCase().replace(/\s+/g, '-')}`
  }

  const handleAuthenticated = (user: ApiUser) => {
    setSessionUser(user)
    setRole(user.role)
    const firstNav = navByRole[user.role][0].label
    setActiveNav(firstNav)
    window.location.hash = `#/${user.role.toLowerCase()}/${firstNav.toLowerCase().replace(/\s+/g, '-')}`
    setAuthOpen(false)
    handleAction(`Signed in as ${user.name}`, 'success')
  }

  const handleSignOut = async () => {
    try {
      await apiLogout()
    } finally {
      setSessionUser(null)
      setRemoteHealthMetrics([])
      setRole('Admin')
      setActiveNav('Operations')
      window.location.hash = '#/admin/operations'
      setRoleOpen(false)
      handleAction('You have been safely signed out', 'success')
    }
  }

  const handleExport = async () => {
    const tableMap: Record<string, string> = {
      Patients: 'patients',
      'My patients': 'patients',
      Appointments: 'appointments',
      'Inpatient Care': 'beds',
      'Beds & wards': 'beds',
      Emergency: 'emergency_cases',
      Pharmacy: 'medications',
      'Lab & Diagnostics': 'lab_orders',
      'Billing & Revenue': 'billing_invoices',
    }
    const table = tableMap[activeNav] || 'patients'
    try {
      handleAction(`Exporting ${activeNav} data as CSV…`, 'tap')
      await downloadExport(table)
      handleAction(`Downloaded medinexus-${table}.csv`, 'success')
    } catch {
      handleAction('CSV export is available when signed in as clinician or admin', 'alert')
    }
  }

  const handleDrawerAction = async (item: DetailItem) => {
    if (!item.actionType || !item.rawId) {
      handleAction(item.actionLabel ?? 'Record reviewed', 'tap')
      setDetailItem(null)
      return
    }

    try {
      if (item.actionType === 'complete_appointment') {
        await updateAppointment(item.rawId, { status: 'Completed' })
        handleAction('Appointment completed', 'success')
      } else if (item.actionType === 'cancel_appointment') {
        await updateAppointment(item.rawId, { status: 'Cancelled' })
        handleAction('Appointment cancelled', 'alert')
      } else if (item.actionType === 'dispense_rx') {
        await dispensePrescription(item.rawId)
        handleAction('Prescription dispensed by pharmacy', 'success')
      } else if (item.actionType === 'discharge_admission') {
        await dischargeAdmission(item.rawId)
        handleAction('Patient discharged from ward', 'success')
      } else if (item.actionType === 'pay_invoice') {
        await payInvoice(item.rawId)
        handleAction('Invoice payment processed successfully', 'success')
      } else if (item.actionType === 'complete_lab') {
        await updateLabOrder(item.rawId, { status: 'Completed', resultSummary: 'Verified by pathology' })
        handleAction('Laboratory diagnostic result recorded', 'success')
      } else if (item.actionType === 'treat_emergency') {
        await updateEmergencyCase(item.rawId, { status: 'In Treatment' })
        handleAction('Patient transferred to emergency treatment', 'success')
      }
      refreshData()
    } catch (err) {
      handleAction(err instanceof Error ? err.message : 'Action could not be completed', 'alert')
    } finally {
      setDetailItem(null)
    }
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><BrandMark /><div><strong>MediNexus</strong><span>Unified Hospital Management</span></div></div>
      <div className="sidebar-workspace">
        <span className="workspace-icon"><Icon name={role === 'Patient' ? 'heart' : 'activity'} size={18} /></span>
        <div><strong>{profile.workspace}</strong><span>Connected care network</span></div>
        <button className="icon-button ghost" aria-label="Change workspace" onClick={() => setRoleOpen((open) => !open)}><Icon name="chevron" size={16} /></button>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        <span className="nav-section-label">Workspace</span>
        {navItems.map((item) => <button key={item.label} className={`nav-item ${activeNav === item.label ? 'active' : ''}`} onClick={() => handleNavChange(item.label)}><Icon name={item.icon} size={20} /><span>{item.label}</span>{item.label === 'Emergency' && <span className="nav-alert-dot" />}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="connection-card"><div className="connection-glow" /><span className="connection-line" /><strong>Connected care<br />for a healthier<br />tomorrow</strong><div className="connection-buildings" aria-hidden="true"><i /><i /><i /></div></div>
        <button className="sidebar-bottom-link" onClick={() => handleAction('Knowledge center and system documentation opened')}><Icon name="message" size={17} />Help & support</button>
        <button className="sidebar-bottom-link" onClick={() => { if (sessionUser) void handleSignOut(); else { setAuthMode('login'); setAuthOpen(true) } }}><Icon name="logout" size={17} />{sessionUser ? 'Sign out' : 'Sign in'}</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu icon-button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Icon name={mobileNavOpen ? 'x' : 'menu'} size={22} /></button>
        <div className="workspace-select-wrap">
          <button className="workspace-select" onClick={() => setRoleOpen((open) => !open)} aria-expanded={roleOpen}><span className="workspace-select-icon"><Icon name={role === 'Patient' ? 'heart' : 'activity'} size={18} /></span><strong>{profile.workspace}</strong><Icon name="chevron" size={16} /></button>
          {roleOpen && <div className="role-menu" role="menu"><span className="role-menu-title">{sessionUser ? 'Signed-in workspace' : 'Switch workspace'}</span>{workspaceRoles.map((item) => <button key={item} className={role === item ? 'selected' : ''} onClick={() => handleRoleChange(item)}><span className={`role-dot role-dot-${item.toLowerCase()}`} />{item}<small>{roleProfiles[item].workspace}</small>{role === item && <Icon name="check" size={16} />}</button>)}{sessionUser ? <button className="role-menu-action" onClick={handleSignOut}><Icon name="logout" size={15} />Sign out</button> : <button className="role-menu-action" onClick={() => { setAuthMode('login'); setAuthOpen(true); setRoleOpen(false) }}><Icon name="shield" size={15} />Sign in to care API</button>}</div>}
        </div>
        <label className="global-search"><Icon name="search" size={19} /><input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients, appointments, or records..." aria-label="Search patients, appointments, or records" /><kbd>⌘ K</kbd></label>
        <span className={`api-status api-status-${apiStatus}`} aria-label={apiStatus === 'connected' ? 'MediNexus API connected' : apiStatus === 'offline' ? 'Using demo data because the MediNexus API is offline' : 'Checking MediNexus API connection'}><i />{apiStatus === 'connected' ? 'API connected' : apiStatus === 'offline' ? 'Demo data' : 'Connecting'}</span>
        <div className="topbar-actions">
          <button className="icon-button preference-trigger" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); handleAction(`${theme === 'dark' ? 'Light' : 'Dark'} theme enabled`, 'tap') }}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} /></button>
          <button className={`icon-button preference-trigger ${preferencesOpen ? 'active' : ''}`} aria-label="Open accessibility and feedback preferences" aria-expanded={preferencesOpen} onClick={() => setPreferencesOpen((open) => !open)}><Icon name="settings" size={19} /></button>
          <button className={`notification-button icon-button ${notificationsOpen ? 'active' : ''}`} aria-label="Open notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={21} />{unreadCount > 0 ? <span className="notification-badge">{unreadCount}</span> : <span />}</button>
          <div className="topbar-divider" />
          <button className="profile-trigger" aria-label={`Switch workspace, current ${profile.workspace}`} aria-expanded={roleOpen} onClick={() => setRoleOpen((open) => !open)}><span className={`avatar avatar-large avatar-${profile.initials.toLowerCase()}`}>{profile.initials}</span><span className="profile-copy"><strong>{profile.name}</strong><small>{profile.title}</small></span><Icon name="chevron" size={16} /></button>
        </div>
        {preferencesOpen && <PreferencesPanel theme={theme} soundEnabled={soundEnabled} hapticsEnabled={hapticsEnabled} onThemeChange={setTheme} onSoundChange={setSoundEnabled} onHapticsChange={setHapticsEnabled} onAction={handleAction} />}
        {notificationsOpen && <div className="notification-panel"><div className="panel-heading"><div><span className="eyebrow">Inbox</span><h2>Notifications ({notifications.length})</h2></div><button className="text-button" onClick={() => { markAllNotificationsRead().then(() => { refreshData(); handleAction('All notifications marked read', 'success') }) }}>Mark all read</button></div>{notifications.length ? notifications.map((n) => <div key={n.id} className={`notification-item ${!n.readAt ? 'unread' : ''}`} onClick={() => { markNotificationRead(n.id).then(refreshData) }}><span className={`notification-symbol notification-symbol-${n.kind === 'alert' ? 'coral' : n.kind === 'success' ? 'mint' : 'cyan'}`}><Icon name={n.kind === 'alert' ? 'alert' : n.kind === 'success' ? 'check' : 'flask'} size={17} /></span><div><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div>) : <div className="empty-state" style={{ padding: '20px' }}><span><Icon name="check" size={20} /></span><p>No new alerts.</p></div>}</div>}
      </header>

      <section className="page-content">
        {isDashboard ? <>
          <div className="page-heading">
            <div><h1>Good morning, {profile.name}</h1><p className="page-subtitle">{role === 'Patient' ? 'Your care plan, appointments, and next steps in one place.' : "Here is today's care overview"}</p></div>
            <div className="heading-actions"><button className="button button-primary" onClick={() => setModal('appointment')}><Icon name="calendar" size={18} />{role === 'Patient' ? 'Book appointment' : 'New appointment'}</button><button className="button button-danger" onClick={() => setModal('emergency')}><Icon name="alert" size={18} />Emergency access</button></div>
          </div>
          <div className="kpi-grid">{kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}</div>
          {role === 'Patient' ? <PatientDashboard remoteMetrics={remoteHealthMetrics} onAction={handleAction} onOpenDetail={openDetail} onOpenLog={() => setModal('health_metric')} /> : <>
            <div className="main-grid">
              <section className="panel schedule-panel"><div className="panel-heading"><div><span className="eyebrow">{role === 'Doctor' ? 'Your day' : 'Live schedule'}</span><h2>Today's schedule ({liveAppointments.length})</h2></div><button className="text-button" onClick={() => setShowAllSchedule((open) => !open)}>{showAllSchedule ? 'Show less' : 'View all'} <Icon name="arrow" size={15} /></button></div><div className="schedule-list">{(liveAppointments.length ? liveAppointments : []).slice(0, showAllSchedule ? liveAppointments.length : 6).map((item) => { const dateStr = new Date(item.appointmentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return <button key={item.id} className={`schedule-row ${selectedAppointment === item.id ? 'selected' : ''}`} onClick={() => { setSelectedAppointment(item.id); openDetail({ eyebrow: 'Appointment', title: item.patientName || item.patientId, meta: `${dateStr} · ${item.department} · ${item.clinicianName}`, tone: 'cyan', icon: 'calendar', facts: [{ label: 'Time', value: dateStr }, { label: 'Room', value: item.room }, { label: 'Clinician', value: item.clinicianName }, { label: 'Status', value: item.status }], actionLabel: item.status !== 'Completed' ? 'Mark Completed' : undefined, actionType: 'complete_appointment', rawId: item.id }); handleAction(`Appointment selected`, 'tap') }}><span className="schedule-time">{dateStr}</span><span className="schedule-dot dot-cyan" /><span className="schedule-connector" /><span className="schedule-patient"><strong>{item.patientName || item.patientId}</strong><small>{item.department} · {item.clinicianName}</small></span><span className="schedule-room">{item.room}</span><Icon name="chevron" size={15} /></button> })}</div></section>
              <section className="panel flow-panel"><div className="panel-heading flow-heading"><div><span className="eyebrow">Throughput</span><h2>Patient flow</h2></div><div className="flow-actions"><div className="legend"><span><i className="legend-dot cyan" />Inpatients</span><span><i className="legend-dot violet" />ED visits</span><span><i className="legend-dot mint" />Discharges</span></div><span className="live-status"><i />Live</span></div></div><div className="flow-toolbar"><span className="flow-updated"><Icon name="activity" size={15} />Updated just now</span><div className="range-picker">{(['Today', '7d', '30d'] as const).map((item) => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div><FlowChart range={range} /><div className="flow-insights"><div><Icon name="people" size={22} /><strong>{dashboardSummary?.openEmergency ?? 18}<small>Currently in ED</small></strong><span className="insight-bad">▲ Active</span></div><div><Icon name="bed" size={22} /><strong>{dashboardSummary?.criticalEmergency ?? 3}<small>Waiting for bed</small></strong><span className="insight-bad">▲ Critical</span></div><div><Icon name="clock" size={22} /><strong>28 min<small>Avg. ED wait time</small></strong><span className="insight-good">▲ Fast track</span></div><div><Icon name="arrow" size={22} /><strong>14<small>Discharges today</small></strong><span className="insight-good">▲ Target met</span></div></div></section>
            </div>
            <div className="bottom-grid"><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">Across the network</span><h2>Care team activity</h2></div><button className="text-button" onClick={() => openDetail({ eyebrow: 'Network Activity', title: 'Live Clinical Activity', meta: 'Real-time telemetry and clinical events', tone: 'cyan', icon: 'activity', facts: [{ label: 'Status', value: 'Nominal' }, { label: 'Audit Records', value: 'Encrypted & active' }] })}>View all <Icon name="arrow" size={15} /></button></div><div className="activity-list"><div className="activity-row"><span className="avatar avatar-cyan">ER</span><span className="activity-time">Just now</span><div className="activity-copy"><strong>Dr. Elena Ruiz</strong><small>Signed cardiology consultation note</small></div><span className="status status-success">Completed</span></div><div className="activity-row"><span className="avatar avatar-mint">JW</span><span className="activity-time">8 min ago</span><div className="activity-copy"><strong>James Wilson</strong><small>Assigned patient to Ward A bed 102</small></div><span className="status status-success">Completed</span></div><div className="activity-row"><span className="avatar avatar-coral">ED</span><span className="activity-time">14 min ago</span><div className="activity-copy"><strong>Triage Team</strong><small>Admitted Level 2 cardiac emergency</small></div><span className="status status-attention">In Treatment</span></div></div></section><EmergencyPanel onEmergency={() => setModal('emergency')} onOpenDetail={openDetail} /></div>
          </>}
        </> : <ModuleView
          activeNav={activeNav}
          rows={filteredRows}
          search={search}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          showFilterBar={showFilterBar}
          onToggleFilterBar={() => setShowFilterBar((v) => !v)}
          remoteMetrics={remoteHealthMetrics}
          onAction={handleAction}
          onOpenCreateModal={() => {
            if (activeNav === 'Patients' || activeNav === 'My patients') setModal('patient')
            else if (activeNav === 'Appointments') setModal('appointment')
            else if (activeNav === 'Emergency' || activeNav === 'Queue management') setModal('emergency')
            else if (activeNav === 'Pharmacy') setModal('prescription')
            else if (activeNav === 'Prescriptions') setModal('prescription')
            else if (activeNav === 'Inpatient Care' || activeNav === 'Beds & wards') setModal('admission')
            else if (activeNav === 'Lab & Diagnostics' || activeNav === 'Lab results' || activeNav === 'Lab reports') setModal('lab')
            else if (activeNav === 'Billing & Revenue' || activeNav === 'Billing support' || activeNav === 'Bills & insurance') setModal('invoice')
            else if (activeNav === 'Health tracker') setModal('health_metric')
            else setModal('appointment')
          }}
          onExport={handleExport}
          onEmergency={() => setModal('emergency')}
          onOpenDetail={openDetail}
        />}
      </section>
    </main>

    {mobileNavOpen && <button className="mobile-scrim" aria-label="Dismiss navigation overlay" onClick={() => setMobileNavOpen(false)} />}
    {authOpen && <AuthDialog mode={authMode} onClose={() => setAuthOpen(false)} onModeChange={setAuthMode} onAuthenticated={handleAuthenticated} />}
    {modal && <Modal type={modal} role={role} onClose={() => setModal(null)} onCreated={(msg) => { setModal(null); refreshData(); handleAction(msg, 'success') }} />}
    {detailItem && <DetailsDrawer item={detailItem} onClose={() => setDetailItem(null)} onAction={handleDrawerAction} />}
    {toast && <div className="toast" role="status"><span className="toast-icon"><Icon name="check" size={16} /></span>{toast}<button onClick={() => setToast(null)} aria-label="Dismiss"><Icon name="close" size={15} /></button></div>}
  </div>
}

function AuthDialog({ mode, onClose, onModeChange, onAuthenticated }: { mode: 'login' | 'register'; onClose: () => void; onModeChange: (mode: 'login' | 'register') => void; onAuthenticated: (user: ApiUser) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = mode === 'login' ? await apiLogin(email, password) : await apiRegister(name, email, password)
      onAuthenticated(user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The account request could not be completed.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close icon-button ghost" onClick={onClose} aria-label="Close authentication dialog"><Icon name="close" size={19} /></button><div className="modal-symbol modal-symbol-primary"><Icon name="shield" size={23} /></div><span className="eyebrow">Secure care access</span><h2 id="auth-title">{mode === 'login' ? 'Sign in to MediNexus' : 'Create your patient account'}</h2><p>{mode === 'login' ? 'Use your server-backed session to access role-protected care data.' : 'Create a Patient account to sync health metrics and notifications.'}</p><form className="appointment-form" onSubmit={submit}>{mode === 'register' && <label>Full name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}<label>Email<input autoFocus={mode === 'login'} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /></label>{error && <div className="auth-error" role="alert"><Icon name="alert" size={16} />{error}</div>}<button className="button button-primary button-full" disabled={submitting} type="submit"><Icon name={submitting ? 'clock' : 'arrow'} size={17} />{submitting ? 'Connecting…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><button className="text-button auth-switch" onClick={() => { setError(''); onModeChange(mode === 'login' ? 'register' : 'login') }}>{mode === 'login' ? 'Create a new patient account' : 'Already have an account? Sign in'}</button><small className="auth-note">Sessions are stored in an HttpOnly cookie and enforced by the API.</small></section></div>
}

function PatientDashboard({ remoteMetrics, onAction, onOpenDetail, onOpenLog }: { remoteMetrics: RemoteHealthMetric[]; onAction: (message: string, tone?: FeedbackTone) => void; onOpenDetail: (item: DetailItem) => void; onOpenLog: () => void }) {
  const appointmentDetail: DetailItem = {
    eyebrow: 'Next appointment',
    title: 'Cardiology follow-up',
    meta: 'Thursday · 10:30 AM · Room 301',
    tone: 'violet',
    icon: 'calendar',
    facts: [{ label: 'Clinician', value: 'Dr. Elena Ruiz' }, { label: 'Department', value: 'Cardiology' }, { label: 'Visit type', value: 'Follow-up' }],
    timeline: [{ label: 'Check-in opens', value: '10:15 AM' }, { label: 'Reminder', value: 'Tomorrow at 9:00 AM' }],
    actionLabel: 'Reschedule appointment',
  }
  return <>
    <div className="patient-grid"><section className="panel care-plan-panel"><div className="patient-hero"><div><span className="eyebrow">Care plan progress</span><h2>Your recovery is on track</h2><p>Keep following your care plan to stay ahead of your next milestone.</p></div><div className="progress-ring"><svg viewBox="0 0 80 80"><circle className="ring-track" cx="40" cy="40" r="32" /><circle className="ring-value" cx="40" cy="40" r="32" /></svg><strong>94<small>%</small></strong></div></div><div className="plan-steps"><div className="plan-step complete"><span><Icon name="check" size={15} /></span><div><strong>Medication plan</strong><small>Completed today at 08:12</small></div></div><div className="plan-step complete"><span><Icon name="check" size={15} /></span><div><strong>Daily health check-in</strong><small>Synced via API metrics</small></div></div><div className="plan-step upcoming"><span><Icon name="calendar" size={15} /></span><div><strong>Cardiology follow-up</strong><small>Thursday · 10:30 AM</small></div><button className="text-button" onClick={() => onOpenDetail(appointmentDetail)}>Details <Icon name="arrow" size={15} /></button></div></div></section><section className="panel next-visit-panel"><div className="panel-heading"><div><span className="eyebrow">Next visit</span><h2>Cardiology follow-up</h2></div><button className="icon-button ghost" aria-label="More appointment options" onClick={() => onOpenDetail(appointmentDetail)}><Icon name="more" size={17} /></button></div><div className="visit-date"><span className="visit-day">18</span><div><strong>Thursday, September 18</strong><small>10:30 AM · Room 301</small></div></div><div className="doctor-line"><span className="avatar avatar-cyan">ER</span><div><strong>Dr. Elena Ruiz</strong><small>Cardiology</small></div><button className="icon-button ghost" aria-label="Message Dr. Elena Ruiz" onClick={() => onAction('Message composer opened', 'tap')}><Icon name="message" size={17} /></button></div><button className="button button-soft button-full" onClick={() => onOpenDetail(appointmentDetail)}>View appointment details <Icon name="arrow" size={16} /></button></section></div>
    <HealthTracker compact remoteMetrics={remoteMetrics} onAction={onAction} onOpenDetail={onOpenDetail} onOpenLog={onOpenLog} />
  </>
}

function HealthTracker({ compact = false, remoteMetrics, onAction, onOpenDetail, onOpenLog }: { compact?: boolean; remoteMetrics?: RemoteHealthMetric[]; onAction: (message: string, tone?: FeedbackTone) => void; onOpenDetail: (item: DetailItem) => void; onOpenLog?: () => void }) {
  const displayMetrics = useMemo(() => healthMetrics.map((metric) => {
    const metricType = healthMetricTypes[metric.label]
    const latest = remoteMetrics?.filter((item) => item.metricType === metricType).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]
    if (!latest) return metric
    const remoteValue = metricType === 'steps' ? Math.round(latest.value).toLocaleString() : metricType === 'heart_rate' ? `${Math.round(latest.value)} bpm` : metricType === 'sleep' ? `${Math.floor(latest.value / 60)}h ${Math.round(latest.value % 60)}m` : metricType === 'hydration' ? `${latest.value.toFixed(1)} L` : metricType === 'blood_oxygen' ? `${Math.round(latest.value)}%` : `${latest.value.toFixed(1)} kg`
    const progress = latest.goalValue ? Math.min(100, Math.round((latest.value / latest.goalValue) * 100)) : metric.progress
    return { ...metric, value: remoteValue, progress, meta: `Synced ${new Date(latest.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` }
  }), [remoteMetrics])
  const healthDetail = (metric: typeof healthMetrics[number]): DetailItem => ({
    eyebrow: 'Health tracker',
    title: metric.label,
    meta: `${metric.value} · ${metric.meta}`,
    tone: metric.tone,
    icon: metric.icon,
    facts: [{ label: 'Current reading', value: metric.value }, { label: 'Target', value: metric.goal }, { label: 'Last synced', value: 'API Verified' }],
    timeline: [{ label: 'Today', value: metric.meta }, { label: 'Trend', value: metric.progress >= 90 ? 'On track' : 'Moving toward goal' }],
    actionLabel: `Log ${metric.label.toLowerCase()}`,
  })
  return <section className={`panel health-tracker ${compact ? 'health-tracker-compact' : ''}`}><div className="panel-heading"><div><span className="eyebrow">Personal health data</span><h2>{compact ? "Today's health snapshot" : 'Health tracker'}</h2></div><div className="tracker-heading-actions"><span className="sync-status"><i />{remoteMetrics?.length ? 'API synced just now' : 'Demo snapshot'}</span>{compact && <button className="text-button" onClick={() => onAction('Health tracker opened', 'tap')}>Open full tracker <Icon name="arrow" size={15} /></button>}</div></div><div className="health-metric-grid">{displayMetrics.map((metric) => <button className={`health-metric health-metric-${metric.tone}`} key={metric.label} onClick={() => onOpenDetail(healthDetail(metric))}><span className="health-metric-icon"><Icon name={metric.icon} size={19} /></span><span className="health-metric-copy"><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.meta}</small></span><span className="metric-progress"><i style={{ width: `${metric.progress}%` }} /></span><Icon name="chevron" size={14} /></button>)}</div><div className="health-visuals"><div className="health-chart-block"><div className="health-block-heading"><span><strong>Heart rate trend</strong><small>Resting average · Last 7 days</small></span><b>72 <small>bpm</small></b></div><svg className="health-chart" viewBox="0 0 520 115" role="img" aria-label="Heart rate trend chart"><defs><linearGradient id="health-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#19c5d1" stopOpacity=".22" /><stop offset="1" stopColor="#19c5d1" stopOpacity="0" /></linearGradient></defs><path className="health-grid-line" d="M0 20h520M0 57h520M0 94h520" /><path className="health-chart-fill" d="M0 80 74 68 148 77 222 42 296 55 370 31 444 44 520 22V115H0Z" /><polyline className="health-line" points="0,80 74,68 148,77 222,42 296,55 370,31 444,44 520,22" />{[[0,80],[74,68],[148,77],[222,42],[296,55],[370,31],[444,44],[520,22]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} className="health-point" cx={cx} cy={cy} r="4" />)}</svg><div className="health-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div><div className="health-insight-block"><div className="health-block-heading"><span><strong>Daily goals</strong><small>Keep your care plan moving</small></span><Icon name="spark" size={20} /></div><div className="goal-row"><span><i className="goal-icon goal-icon-cyan"><Icon name="activity" size={15} /></i><strong>Steps</strong><small>6,842 / 8,000</small></span><b>86%</b></div><div className="goal-row"><span><i className="goal-icon goal-icon-violet"><Icon name="moon" size={15} /></i><strong>Sleep</strong><small>7h 42m / 8h</small></span><b>96%</b></div><div className="goal-row"><span><i className="goal-icon goal-icon-mint"><Icon name="spark" size={15} /></i><strong>Hydration</strong><small>1.6 L / 2.0 L</small></span><b>80%</b></div><button className="button button-soft tracker-log-button" onClick={() => (onOpenLog ? onOpenLog() : onAction('Log metric dialog', 'tap'))}><Icon name="plus" size={15} />Log health data</button></div></div></section>
}

function PreferencesPanel({ theme, soundEnabled, hapticsEnabled, onThemeChange, onSoundChange, onHapticsChange, onAction }: { theme: Theme; soundEnabled: boolean; hapticsEnabled: boolean; onThemeChange: (theme: Theme) => void; onSoundChange: (enabled: boolean) => void; onHapticsChange: (enabled: boolean) => void; onAction: (message: string, tone?: FeedbackTone) => void }) {
  return <div className="preferences-panel"><div className="preferences-heading"><div><span className="eyebrow">Interface</span><h2>Preferences</h2></div><span className="privacy-note"><Icon name="shield" size={13} />Stored on this device</span></div><div className="preference-row"><span className="preference-icon"><Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} /></span><span><strong>Theme</strong><small>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</small></span><button className="segmented-control" aria-label="Switch theme" onClick={() => { const nextTheme = theme === 'dark' ? 'light' : 'dark'; onThemeChange(nextTheme); onAction(`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme enabled`, 'tap') }}><span className={theme === 'light' ? 'active' : ''}>Light</span><span className={theme === 'dark' ? 'active' : ''}>Dark</span></button></div><label className="preference-row preference-toggle"><span className="preference-icon"><Icon name={soundEnabled ? 'volume' : 'volumeOff'} size={17} /></span><span><strong>Sound feedback</strong><small>Short confirmation tones after actions</small></span><input type="checkbox" checked={soundEnabled} onChange={(event) => { onSoundChange(event.target.checked); onAction(event.target.checked ? 'Sound feedback enabled' : 'Sound feedback muted', 'tap') }} /><i /></label><label className="preference-row preference-toggle"><span className="preference-icon"><Icon name="vibrate" size={17} /></span><span><strong>Vibration cues</strong><small>Use supported device haptics for feedback</small></span><input type="checkbox" checked={hapticsEnabled} onChange={(event) => { onHapticsChange(event.target.checked); onAction(event.target.checked ? 'Vibration cues enabled' : 'Vibration cues muted', 'tap') }} /><i /></label><button className="text-button preferences-test" onClick={() => onAction('Feedback test complete', 'success')}><Icon name="spark" size={15} />Test feedback</button></div>
}

function DetailsDrawer({ item, onClose, onAction }: { item: DetailItem; onClose: () => void; onAction: (item: DetailItem) => void }) {
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="details-drawer" role="dialog" aria-modal="true" aria-labelledby="details-title"><div className="drawer-topline"><span className={`drawer-symbol drawer-symbol-${item.tone}`}><Icon name={item.icon} size={21} /></span><button className="icon-button ghost" aria-label="Close details" onClick={onClose}><Icon name="close" size={18} /></button></div><span className="eyebrow">{item.eyebrow}</span><h2 id="details-title">{item.title}</h2><p className="drawer-meta">{item.meta}</p><div className="drawer-facts">{item.facts.map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div>{item.timeline && <div className="drawer-timeline"><h3>Activity</h3>{item.timeline.map((event) => <div key={`${event.label}-${event.value}`}><i /><span><strong>{event.label}</strong><small>{event.value}</small></span></div>)}</div>}<div className="drawer-actions">{item.actionLabel && <button className="button button-primary button-full" onClick={() => onAction(item)}><Icon name="arrow" size={16} />{item.actionLabel}</button>}<button className="button button-soft button-full" onClick={onClose}>Close details</button></div></aside></div>
}

function EmergencyPanel({ onEmergency, onOpenDetail }: { onEmergency: () => void; onOpenDetail: (item: DetailItem) => void }) {
  const emergencyDetail: DetailItem = { eyebrow: 'Real-time triage', title: 'Emergency status', meta: 'ED priority triage and active care queues', tone: 'coral', icon: 'alert', facts: [{ label: 'Level 1 (Resuscitation)', value: 'Active triage' }, { label: 'Level 2 (Emergent)', value: 'In treatment' }, { label: 'Trauma team', value: 'On call' }], timeline: [{ label: 'Telemetry', value: 'Real-time verified' }], actionLabel: 'Open emergency access' }
  return <section className="panel emergency-panel"><div className="panel-heading"><div><span className="eyebrow">Real-time triage</span><h2>Emergency status</h2></div><button className="text-button" onClick={() => onOpenDetail(emergencyDetail)}>View all <Icon name="arrow" size={15} /></button></div><div className="emergency-summary"><div className="gauge"><svg viewBox="0 0 140 85"><path className="gauge-track" d="M12 74a58 58 0 0 1 116 0" /><path className="gauge-value" d="M12 74a58 58 0 0 1 116 0" /></svg><strong>18<small>ED cases</small></strong></div><div className="emergency-legend"><span><i className="severity critical" />Critical <b>3</b></span><span><i className="severity serious" />Serious <b>6</b></span><span><i className="severity stable" />Stable <b>9</b></span></div></div><button className="critical-callout" onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Critical care queue', meta: 'High acuity cases requiring active monitoring', actionLabel: 'Open emergency triage' })}><span><Icon name="alert" size={18} /></span><strong>Active emergency triage & bed allocation</strong><Icon name="arrow" size={17} /></button><div className="emergency-teams"><button onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Trauma team', meta: 'Trauma response team · On track', tone: 'mint' })}><strong>Trauma</strong><span><i />On track</span></button><button onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Stroke team', meta: 'Stroke response team · On track', tone: 'mint' })}><strong>Stroke</strong><span><i />On track</span></button><button onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Cardiac team', meta: 'Cardiac response team · Ready', tone: 'mint' })}><strong>Cardiac</strong><span className="attention"><i />Ready</span></button></div><button className="emergency-panel-action button button-danger" onClick={onEmergency}><Icon name="alert" size={15} />Emergency access</button></section>
}

function ModuleView({
  activeNav,
  rows,
  search,
  statusFilter,
  onStatusFilterChange,
  showFilterBar,
  onToggleFilterBar,
  remoteMetrics,
  onAction,
  onOpenCreateModal,
  onExport,
  onEmergency,
  onOpenDetail,
}: {
  activeNav: string
  rows: { id: string; label: string; meta: string; value: string; tone: string; detail: DetailItem }[]
  search: string
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  showFilterBar: boolean
  onToggleFilterBar: () => void
  remoteMetrics: RemoteHealthMetric[]
  onAction: (message: string, tone?: FeedbackTone) => void
  onOpenCreateModal: () => void
  onExport: () => void
  onEmergency: () => void
  onOpenDetail: (item: DetailItem) => void
}) {
  const isEmergency = activeNav === 'Emergency' || activeNav === 'Queue management'
  if (activeNav === 'Health tracker') {
    return <div className="module-page"><div className="page-heading"><div><p className="eyebrow">Personal health data</p><h1>Health tracker</h1><p className="page-subtitle">See your connected health signals, goals, and trends in one view.</p></div><div className="heading-actions"><button className="button button-primary" onClick={onOpenCreateModal}><Icon name="plus" size={18} />Log health data</button></div></div><HealthTracker remoteMetrics={remoteMetrics} onAction={onAction} onOpenDetail={onOpenDetail} onOpenLog={onOpenCreateModal} /></div>
  }

  const filterOptions = ['All', 'Stable', 'Confirmed', 'Completed', 'In stock', 'Low stock', 'Active', 'Paid', 'Pending']

  return <div className="module-page"><div className="page-heading"><div><p className="eyebrow">Workspace module</p><h1>{activeNav}</h1><p className="page-subtitle">Manage connected care workflows with clarity and confidence.</p></div><div className="heading-actions"><button className="button button-primary" onClick={onOpenCreateModal}><Icon name="plus" size={18} />Create new</button>{isEmergency && <button className="button button-danger" onClick={onEmergency}><Icon name="alert" size={18} />Emergency access</button>}</div></div>
    <div className="module-toolbar"><div className="module-count"><strong>{rows.length}</strong> active records {search && <span>matching “{search}”</span>}</div><div className="module-tools"><button className={`button ${showFilterBar ? 'button-primary' : 'button-soft'}`} onClick={onToggleFilterBar}><Icon name="filter" size={17} />Filter</button><button className="button button-soft" onClick={onExport}><Icon name="download" size={17} />Export CSV</button></div></div>
    {showFilterBar && <div className="filter-bar">{filterOptions.map((opt) => <button key={opt} className={`filter-pill ${statusFilter === opt ? 'active' : ''}`} onClick={() => onStatusFilterChange(opt)}>{opt}</button>)}</div>}
    <section className="panel module-table"><div className="module-table-header"><span>Record</span><span>Details</span><span>Status / value</span><span /></div>{rows.length ? rows.map((row) => <button className="module-row" key={row.id} onClick={() => onOpenDetail(row.detail)}><span className="module-record"><span className={`module-symbol symbol-${row.tone}`}><Icon name={activeNav === 'Patients' ? 'people' : activeNav === 'Appointments' ? 'calendar' : activeNav === 'Emergency' ? 'alert' : 'activity'} size={18} /></span><strong>{row.label}</strong></span><span className="module-meta">{row.meta}</span><span className={`module-value module-value-${row.tone}`}><i />{row.value}</span><Icon name="chevron" size={16} /></button>) : <div className="empty-state"><span><Icon name="search" size={22} /></span><h2>No matching records</h2><p>Try a different search term or reset your filter.</p></div>}</section>
  </div>
}

function Modal({ type, role, onClose, onCreated }: { type: ModalType; role: Role; onClose: () => void; onCreated: (message: string) => void }) {
  // Appointment form state
  const [patientName, setPatientName] = useState('')
  const [department, setDepartment] = useState('Cardiology')
  const [clinicianName, setClinicianName] = useState('Dr. Elena Ruiz')
  const [aptDate, setAptDate] = useState('2026-10-20')
  const [aptTime, setAptTime] = useState('10:30')
  const [notes, setNotes] = useState('')
  
  // Emergency form state
  const [edAcuity, setEdAcuity] = useState(2)
  const [edComplaint, setEdComplaint] = useState('')
  const [edVitals, setEdVitals] = useState('')
  const [edTeam, setEdTeam] = useState('Cardiac')

  // Health metric form state
  const [metricType, setMetricType] = useState<'steps' | 'heart_rate' | 'sleep' | 'hydration' | 'blood_oxygen' | 'weight'>('steps')
  const [metricValue, setMetricValue] = useState('7500')
  const [metricGoal, setMetricGoal] = useState('8000')

  // Patient form state
  const [pName, setPName] = useState('')
  const [pDept, setPDept] = useState('General Medicine')
  const [pDob, setPDob] = useState('1985-06-15')
  const [pGender, setPGender] = useState('Female')
  const [pPhone, setPPhone] = useState('+1 555-0199')
  const [pBlood, setPBlood] = useState('O+')
  const [pAllergies, setPAllergies] = useState('')

  // Prescription form state
  const [rxPatient, setRxPatient] = useState('P-20391')
  const [rxMedName, setRxMedName] = useState('Amoxicillin 500mg')
  const [rxDosage, setRxDosage] = useState('500mg three times daily')
  const [rxFrequency, setRxFrequency] = useState('Three times daily')
  const [rxDuration, setRxDuration] = useState('7 days')

  // Lab form state
  const [labPatient, setLabPatient] = useState('P-20391')
  const [labPatientName, setLabPatientName] = useState('Olivia Harris')
  const [labTestType, setLabTestType] = useState('Complete Blood Count (CBC)')
  const [labPriority, setLabPriority] = useState<'Routine' | 'Urgent' | 'Stat'>('Routine')

  // Bed admission form state
  const [admPatient, setAdmPatient] = useState('P-20391')
  const [admBed, setAdmBed] = useState('bed_a102')
  const [admDoctor, setAdmDoctor] = useState('Dr. Elena Ruiz')
  const [admDiagnosis, setAdmDiagnosis] = useState('Cardiovascular observation')

  // Invoice form state
  const [invPatient, setInvPatient] = useState('P-20391')
  const [invPatientName, setInvPatientName] = useState('Olivia Harris')
  const [invDesc, setInvDesc] = useState('Specialist consultation and diagnostic labs')
  const [invAmount, setInvAmount] = useState('450')
  const [invCoverage, setInvCoverage] = useState('350')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (type === 'appointment') {
        const appointmentAt = new Date(`${aptDate}T${aptTime}:00.000Z`).toISOString()
        await createAppointment({
          patientId: role === 'Patient' ? undefined : (patientName || 'P-20391'),
          department,
          clinicianName,
          appointmentAt,
          notes,
        })
        onCreated('Appointment scheduled successfully')
      } else if (type === 'emergency') {
        await createEmergencyCase({
          patientName: patientName || 'Emergency Patient',
          triageAcuity: edAcuity,
          chiefComplaint: edComplaint || 'Acute symptoms requiring emergency triage',
          vitals: edVitals || 'BP 130/85, HR 88, SpO2 97%',
          assignedTeam: edTeam,
        })
        onCreated('Emergency case admitted to triage queue')
      } else if (type === 'health_metric') {
        const unitMap: Record<string, string> = { steps: 'steps', heart_rate: 'bpm', sleep: 'minutes', hydration: 'L', blood_oxygen: '%', weight: 'kg' }
        await logHealthMetric({
          metricType,
          value: parseFloat(metricValue),
          unit: unitMap[metricType] || '',
          goalValue: metricGoal ? parseFloat(metricGoal) : undefined,
        })
        onCreated('Health metric logged successfully')
      } else if (type === 'patient') {
        await createPatient({
          name: pName,
          department: pDept,
          dob: pDob,
          gender: pGender,
          phone: pPhone,
          bloodGroup: pBlood,
          allergies: pAllergies,
        })
        onCreated(`Patient ${pName} registered successfully`)
      } else if (type === 'prescription') {
        await createPrescription({
          patientId: rxPatient,
          medicationId: 'med_amx',
          medicationName: rxMedName,
          dosage: rxDosage,
          frequency: rxFrequency,
          duration: rxDuration,
        })
        onCreated(`Prescription for ${rxMedName} submitted`)
      } else if (type === 'lab') {
        await createLabOrder({
          patientId: labPatient,
          patientName: labPatientName,
          testType: labTestType,
          priority: labPriority,
        })
        onCreated(`Lab order for ${labTestType} placed`)
      } else if (type === 'admission') {
        await createAdmission({
          patientId: admPatient,
          bedId: admBed,
          admittingDoctor: admDoctor,
          diagnosis: admDiagnosis,
        })
        onCreated('Patient admitted to inpatient bed')
      } else if (type === 'invoice') {
        await createInvoice({
          patientId: invPatient,
          patientName: invPatientName,
          description: invDesc,
          amount: parseFloat(invAmount),
          insuranceCoverage: parseFloat(invCoverage),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        })
        onCreated('Billing invoice generated')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className={`modal ${type === 'emergency' ? 'modal-emergency' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button ghost" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={19} /></button><div className={`modal-symbol ${type === 'emergency' ? 'modal-symbol-danger' : 'modal-symbol-primary'}`}><Icon name={type === 'emergency' ? 'alert' : type === 'appointment' ? 'calendar' : type === 'health_metric' ? 'activity' : 'plus'} size={23} /></div><span className="eyebrow">{type === 'emergency' ? 'Priority access' : 'Clinical action'}</span><h2 id="modal-title">{type === 'emergency' ? 'Emergency Triage Registration' : type === 'appointment' ? 'Schedule Appointment' : type === 'health_metric' ? 'Log Health Metric' : type === 'patient' ? 'Register New Patient' : type === 'prescription' ? 'Prescribe Medication' : type === 'lab' ? 'Order Diagnostic Lab' : type === 'admission' ? 'Inpatient Bed Admission' : 'Generate Billing Invoice'}</h2>
    <form className="appointment-form" onSubmit={handleSubmit}>
      {error && <div className="auth-error" role="alert"><Icon name="alert" size={16} />{error}</div>}
      {type === 'appointment' && <>
        {role !== 'Patient' && <label>Patient Name or ID<input autoFocus required value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. Eleanor Roosevelt" /></label>}
        <label>Department<select value={department} onChange={(e) => setDepartment(e.target.value)}><option>Cardiology</option><option>Internal Medicine</option><option>Orthopedics</option><option>Pediatrics</option><option>Surgery</option><option>Endocrinology</option></select></label>
        <label>Clinician<input value={clinicianName} onChange={(e) => setClinicianName(e.target.value)} placeholder="Dr. Elena Ruiz" /></label>
        <div className="form-split"><label>Date<input type="date" required value={aptDate} onChange={(e) => setAptDate(e.target.value)} /></label><label>Time<select value={aptTime} onChange={(e) => setAptTime(e.target.value)}><option>08:00</option><option>09:30</option><option>10:30</option><option>13:00</option><option>14:30</option><option>16:00</option></select></label></div>
        <label>Clinical Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for consultation, relevant symptoms..." /></label>
      </>}
      {type === 'emergency' && <>
        <label>Patient Name<input autoFocus required value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name or unidentified alias" /></label>
        <label>Triage Acuity Level<select value={edAcuity} onChange={(e) => setEdAcuity(Number(e.target.value))}><option value={1}>Level 1 — Resuscitation (Immediate Life Threat)</option><option value={2}>Level 2 — Emergent / Critical</option><option value={3}>Level 3 — Urgent / Serious</option><option value={4}>Level 4 — Less Urgent / Stable</option><option value={5}>Level 5 — Non-Urgent</option></select></label>
        <label>Chief Complaint<input required value={edComplaint} onChange={(e) => setEdComplaint(e.target.value)} placeholder="e.g. Acute severe substernal chest pain" /></label>
        <label>Initial Vitals<input value={edVitals} onChange={(e) => setEdVitals(e.target.value)} placeholder="e.g. BP 160/95, HR 112, SpO2 94%" /></label>
        <label>Assigned Care Team<select value={edTeam} onChange={(e) => setEdTeam(e.target.value)}><option>Cardiac</option><option>Trauma</option><option>Stroke</option><option>Respiratory</option><option>General</option></select></label>
      </>}
      {type === 'health_metric' && <>
        <label>Metric Type<select value={metricType} onChange={(e) => setMetricType(e.target.value as typeof metricType)}><option value="steps">Steps (count)</option><option value="heart_rate">Heart Rate (bpm)</option><option value="sleep">Sleep (minutes)</option><option value="hydration">Hydration (Liters)</option><option value="blood_oxygen">Blood Oxygen (SpO2 %)</option><option value="weight">Weight (kg)</option></select></label>
        <div className="form-split"><label>Recorded Value<input required type="number" step="any" value={metricValue} onChange={(e) => setMetricValue(e.target.value)} /></label><label>Goal Target (Optional)<input type="number" step="any" value={metricGoal} onChange={(e) => setMetricGoal(e.target.value)} /></label></div>
      </>}
      {type === 'patient' && <>
        <label>Full Name<input autoFocus required value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Patient full legal name" /></label>
        <label>Department<select value={pDept} onChange={(e) => setPDept(e.target.value)}><option>General Medicine</option><option>Cardiology</option><option>Surgery</option><option>Pediatrics</option><option>Endocrinology</option></select></label>
        <div className="form-split"><label>Date of Birth<input type="date" value={pDob} onChange={(e) => setPDob(e.target.value)} /></label><label>Gender<select value={pGender} onChange={(e) => setPGender(e.target.value)}><option>Female</option><option>Male</option><option>Other</option></select></label></div>
        <div className="form-split"><label>Phone<input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="+1 555-0199" /></label><label>Blood Group<select value={pBlood} onChange={(e) => setPBlood(e.target.value)}><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label></div>
        <label>Allergies<input value={pAllergies} onChange={(e) => setPAllergies(e.target.value)} placeholder="e.g. Penicillin, Latex" /></label>
      </>}
      {type === 'prescription' && <>
        <label>Patient ID<input required value={rxPatient} onChange={(e) => setRxPatient(e.target.value)} placeholder="P-20391" /></label>
        <label>Medication Name<input required value={rxMedName} onChange={(e) => setRxMedName(e.target.value)} placeholder="Amoxicillin 500mg" /></label>
        <label>Dosage & Instructions<input required value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} placeholder="500mg three times daily with food" /></label>
        <div className="form-split"><label>Frequency<input value={rxFrequency} onChange={(e) => setRxFrequency(e.target.value)} placeholder="Daily" /></label><label>Duration<input value={rxDuration} onChange={(e) => setRxDuration(e.target.value)} placeholder="14 days" /></label></div>
      </>}
      {type === 'lab' && <>
        <label>Patient ID<input required value={labPatient} onChange={(e) => setLabPatient(e.target.value)} placeholder="P-20391" /></label>
        <label>Patient Name<input required value={labPatientName} onChange={(e) => setLabPatientName(e.target.value)} placeholder="Olivia Harris" /></label>
        <label>Diagnostic Test<select value={labTestType} onChange={(e) => setLabTestType(e.target.value)}><option>Complete Blood Count (CBC)</option><option>Troponin I (High Sensitivity)</option><option>Comprehensive Metabolic Panel</option><option>Lipid Panel</option><option>Chest X-Ray (2 Views)</option><option>Magnetic Resonance Imaging (MRI)</option></select></label>
        <label>Priority<select value={labPriority} onChange={(e) => setLabPriority(e.target.value as typeof labPriority)}><option value="Routine">Routine</option><option value="Urgent">Urgent</option><option value="Stat">Stat (Immediate)</option></select></label>
      </>}
      {type === 'admission' && <>
        <label>Patient ID<input required value={admPatient} onChange={(e) => setAdmPatient(e.target.value)} placeholder="P-20391" /></label>
        <label>Target Bed<select value={admBed} onChange={(e) => setAdmBed(e.target.value)}><option value="bed_a102">Ward A · Room 101 · Bed 2 (Standard)</option><option value="bed_c301">Ward C · Room 301 · Bed 1 (Standard)</option><option value="bed_icu2">ICU · Room ICU-2 · Bed 2 (Critical Care)</option></select></label>
        <label>Admitting Physician<input value={admDoctor} onChange={(e) => setAdmDoctor(e.target.value)} placeholder="Dr. Elena Ruiz" /></label>
        <label>Primary Diagnosis<input required value={admDiagnosis} onChange={(e) => setAdmDiagnosis(e.target.value)} placeholder="Inpatient care diagnosis" /></label>
      </>}
      {type === 'invoice' && <>
        <label>Patient ID<input required value={invPatient} onChange={(e) => setInvPatient(e.target.value)} placeholder="P-20391" /></label>
        <label>Patient Name<input required value={invPatientName} onChange={(e) => setInvPatientName(e.target.value)} placeholder="Olivia Harris" /></label>
        <label>Description of Services<input required value={invDesc} onChange={(e) => setInvDesc(e.target.value)} placeholder="Clinical consultation and diagnostics" /></label>
        <div className="form-split"><label>Total Amount ($)<input required type="number" step="any" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} /></label><label>Insurance Covered ($)<input type="number" step="any" value={invCoverage} onChange={(e) => setInvCoverage(e.target.value)} /></label></div>
      </>}
      <button className="button button-primary button-full" disabled={submitting} type="submit"><Icon name={submitting ? 'clock' : 'check'} size={17} />{submitting ? 'Processing…' : 'Submit & Save Record'}</button>
    </form>
  </section></div>
}

export default App
