export type ApiStatus = 'checking' | 'connected' | 'offline'

export type ApiUser = {
  id: string
  email: string
  name: string
  role: 'Admin' | 'Doctor' | 'Staff' | 'Patient'
  createdAt: string
}

export type RemoteHealthMetric = {
  id: string
  metricType: 'steps' | 'heart_rate' | 'sleep' | 'hydration' | 'blood_oxygen' | 'weight'
  value: number
  unit: string
  goalValue: number | null
  recordedAt: string
}

export type ApiPatient = {
  id: string
  userId: string | null
  name: string
  department: string
  status: string
  dob?: string | null
  gender?: string | null
  phone?: string | null
  bloodGroup?: string | null
  allergies?: string | null
  createdAt: string
}

export type ApiAppointment = {
  id: string
  patientId: string
  patientName?: string
  clinicianName: string
  department: string
  appointmentAt: string
  room: string
  status: string
  notes?: string | null
}

export type ApiBed = {
  id: string
  ward: string
  roomNumber: string
  bedNumber: string
  bedType: string
  status: 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance'
  createdAt: string
}

export type ApiAdmission = {
  id: string
  patientId: string
  patientName?: string
  bedId: string
  ward?: string
  bedNumber?: string
  admittingDoctor: string
  diagnosis: string
  status: 'Admitted' | 'Discharged'
  admittedAt: string
  dischargedAt: string | null
}

export type ApiEmergencyCase = {
  id: string
  patientId: string | null
  patientName: string
  age: number | null
  triageAcuity: number
  chiefComplaint: string
  vitals: string | null
  assignedTeam: string
  status: 'Triage' | 'In Treatment' | 'Awaiting Bed' | 'Discharged'
  arrivalTime: string
}

export type ApiMedication = {
  id: string
  name: string
  code: string
  category: string
  stockQuantity: number
  unit: string
  reorderLevel: number
  unitPrice: number
  status: 'In stock' | 'Low stock' | 'Out of stock'
  createdAt: string
}

export type ApiPrescription = {
  id: string
  patientId: string
  patientName?: string
  doctorId: string | null
  doctorName: string
  medicationId: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  status: 'Active' | 'Dispensed' | 'Discontinued'
  prescribedAt: string
}

export type ApiLabOrder = {
  id: string
  patientId: string
  patientName: string
  orderedByName: string
  testType: string
  priority: 'Routine' | 'Urgent' | 'Stat'
  status: 'Ordered' | 'In Progress' | 'Completed' | 'Cancelled'
  resultSummary: string | null
  normalRange: string | null
  interpretation: string | null
  orderedAt: string
  completedAt: string | null
}

export type ApiInvoice = {
  id: string
  patientId: string
  patientName: string
  invoiceNumber: string
  description: string
  amount: number
  insuranceCoverage: number
  patientDue: number
  status: 'Draft' | 'Pending' | 'Paid' | 'Overdue' | 'Disputed'
  dueDate: string
  createdAt: string
}

export type ApiInsuranceClaim = {
  id: string
  invoiceId: string
  patientId: string
  patientName?: string
  providerName: string
  policyNumber: string
  claimAmount: number
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected'
  submittedAt: string
}

export type ApiClinicalNote = {
  id: string
  patientId: string
  patientName?: string
  authorId: string | null
  authorName: string
  noteType: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  createdAt: string
}

export type ApiNotification = {
  id: string
  title: string
  body: string
  kind: 'info' | 'alert' | 'success'
  readAt: string | null
  createdAt: string
}

export type ApiDashboardSummary = {
  patients: number
  appointments: number
  openEmergency: number
  criticalEmergency?: number
  totalBeds?: number
  occupiedBeds?: number
  bedOccupancyRate?: number
  pendingLabs?: number
  monthlyRevenue?: number
  lowStockMeds?: number
  activePrescriptions?: number
  outstandingBalance?: number
  database: 'sqlite'
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export async function checkApiHealth(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/health`, { signal, credentials: 'include' })
  if (!response.ok) throw new Error(`API health check failed with ${response.status}`)
  const health = await response.json() as { service: string; status: string; database: string; timestamp: string }
  if (health.status !== 'ok') throw new Error('MediNexus API is offline')
  return health
}

type ApiEnvelope<T> = T | { error?: { message?: string } }

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload ? payload.error?.message : undefined
    throw new Error(message ?? `MediNexus API request failed with ${response.status}`)
  }
  return payload as T
}

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/* Authentication & Profile */
export async function getCurrentUser() {
  const result = await request<{ user: ApiUser | null }>('/api/auth/session')
  return result.user
}

export function login(email: string, password: string) {
  return request<{ user: ApiUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then((result) => result.user)
}

export function register(name: string, email: string, password: string) {
  return request<{ user: ApiUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }).then((result) => result.user)
}

export function logout() {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function updateProfile(data: { name: string; email: string }) {
  return request<{ user: ApiUser }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.user)
}

export function changePassword(data: { currentPassword: string; newPassword: string }) {
  return request<{ ok: boolean; message: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) })
}

/* Dashboard Summary */
export function getDashboard() {
  return request<{ user: ApiUser; summary: ApiDashboardSummary; appointments: ApiAppointment[] }>('/api/dashboard')
}

/* Patients */
export function getPatients(search = '', department = '', status = '') {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (department) params.set('department', department)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ patients: ApiPatient[] }>(`/api/patients${qs}`).then((res) => res.patients)
}

export function getPatient(id: string) {
  return request<{ patient: ApiPatient }>(`/api/patients/${id}`).then((res) => res.patient)
}

export function createPatient(data: {
  name: string
  department: string
  status?: string
  dob?: string
  gender?: string
  phone?: string
  bloodGroup?: string
  allergies?: string
}) {
  return request<{ patient: ApiPatient }>('/api/patients', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.patient)
}

export function updatePatient(id: string, data: Partial<ApiPatient>) {
  return request<{ patient: ApiPatient }>(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.patient)
}

/* Appointments */
export function getAppointments(filters?: { department?: string; status?: string; date?: string }) {
  const params = new URLSearchParams()
  if (filters?.department) params.set('department', filters.department)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.date) params.set('date', filters.date)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ appointments: ApiAppointment[] }>(`/api/appointments${qs}`).then((res) => res.appointments)
}

export function createAppointment(data: {
  patientId?: string
  department: string
  appointmentAt: string
  clinicianName?: string
  room?: string
  status?: string
  notes?: string
}) {
  return request<{ appointment: ApiAppointment }>('/api/appointments', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.appointment)
}

export function updateAppointment(id: string, data: Partial<ApiAppointment>) {
  return request<{ appointment: ApiAppointment }>(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.appointment)
}

/* Beds & Inpatient Care */
export function getBeds(ward = '', status = '') {
  const params = new URLSearchParams()
  if (ward) params.set('ward', ward)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ beds: ApiBed[] }>(`/api/beds${qs}`).then((res) => res.beds)
}

export function createBed(data: { ward: string; roomNumber: string; bedNumber: string; bedType?: string }) {
  return request<{ bed: ApiBed }>('/api/beds', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.bed)
}

export function updateBedStatus(id: string, status: ApiBed['status']) {
  return request<{ bed: ApiBed }>(`/api/beds/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }).then((res) => res.bed)
}

export function getAdmissions(status = '') {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return request<{ admissions: ApiAdmission[] }>(`/api/admissions${qs}`).then((res) => res.admissions)
}

export function createAdmission(data: { patientId: string; bedId: string; admittingDoctor: string; diagnosis: string }) {
  return request<{ admission: ApiAdmission }>('/api/admissions', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.admission)
}

export function dischargeAdmission(id: string) {
  return request<{ admission: ApiAdmission }>(`/api/admissions/${id}/discharge`, { method: 'POST' }).then((res) => res.admission)
}

/* Emergency Department */
export function getEmergencyCases(status = '', acuity?: number) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (acuity !== undefined) params.set('acuity', String(acuity))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ cases: ApiEmergencyCase[] }>(`/api/emergency${qs}`).then((res) => res.cases)
}

export function createEmergencyCase(data: {
  patientId?: string
  patientName: string
  age?: number
  triageAcuity: number
  chiefComplaint: string
  vitals?: string
  assignedTeam: string
}) {
  return request<{ case: ApiEmergencyCase }>('/api/emergency', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.case)
}

export function updateEmergencyCase(id: string, data: Partial<ApiEmergencyCase>) {
  return request<{ case: ApiEmergencyCase }>(`/api/emergency/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.case)
}

/* Pharmacy & Prescriptions */
export function getMedications(search = '', status = '') {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ medications: ApiMedication[] }>(`/api/medications${qs}`).then((res) => res.medications)
}

export function createMedication(data: {
  name: string
  code: string
  category: string
  stockQuantity: number
  unit: string
  reorderLevel: number
  unitPrice: number
}) {
  return request<{ medication: ApiMedication }>('/api/medications', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.medication)
}

export function updateMedicationStock(id: string, stockQuantity: number) {
  return request<{ medication: ApiMedication }>(`/api/medications/${id}`, { method: 'PATCH', body: JSON.stringify({ stockQuantity }) }).then((res) => res.medication)
}

export function getPrescriptions(patientId = '') {
  const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''
  return request<{ prescriptions: ApiPrescription[] }>(`/api/prescriptions${qs}`).then((res) => res.prescriptions)
}

export function createPrescription(data: {
  patientId: string
  medicationId: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
}) {
  return request<{ prescription: ApiPrescription }>('/api/prescriptions', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.prescription)
}

export function dispensePrescription(id: string) {
  return request<{ prescription: ApiPrescription }>(`/api/prescriptions/${id}/dispense`, { method: 'PATCH' }).then((res) => res.prescription)
}

/* Labs & Diagnostics */
export function getLabs(patientId = '', status = '') {
  const params = new URLSearchParams()
  if (patientId) params.set('patientId', patientId)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ labs: ApiLabOrder[] }>(`/api/labs${qs}`).then((res) => res.labs)
}

export function createLabOrder(data: {
  patientId: string
  patientName: string
  testType: string
  priority?: 'Routine' | 'Urgent' | 'Stat'
  resultSummary?: string
}) {
  return request<{ lab: ApiLabOrder }>('/api/labs', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.lab)
}

export function updateLabOrder(id: string, data: Partial<ApiLabOrder>) {
  return request<{ lab: ApiLabOrder }>(`/api/labs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.lab)
}

/* Billing & Insurance */
export function getInvoices(patientId = '', status = '') {
  const params = new URLSearchParams()
  if (patientId) params.set('patientId', patientId)
  if (status) params.set('status', status)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request<{ invoices: ApiInvoice[] }>(`/api/billing${qs}`).then((res) => res.invoices)
}

export function createInvoice(data: {
  patientId: string
  patientName: string
  description: string
  amount: number
  insuranceCoverage?: number
  dueDate: string
}) {
  return request<{ invoice: ApiInvoice }>('/api/billing', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.invoice)
}

export function payInvoice(id: string) {
  return request<{ invoice: ApiInvoice }>(`/api/billing/${id}/pay`, { method: 'POST' }).then((res) => res.invoice)
}

export function getInsuranceClaims() {
  return request<{ claims: ApiInsuranceClaim[] }>('/api/insurance').then((res) => res.claims)
}

export function createInsuranceClaim(data: {
  invoiceId: string
  patientId: string
  providerName: string
  policyNumber: string
  claimAmount: number
}) {
  return request<{ claim: ApiInsuranceClaim }>('/api/insurance', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.claim)
}

/* Clinical Notes */
export function getClinicalNotes(patientId: string) {
  return request<{ notes: ApiClinicalNote[] }>(`/api/clinical-notes?patientId=${encodeURIComponent(patientId)}`).then((res) => res.notes)
}

export function createClinicalNote(data: {
  patientId: string
  noteType: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}) {
  return request<{ note: ApiClinicalNote }>('/api/clinical-notes', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.note)
}

/* Notifications */
export function getNotifications() {
  return request<{ notifications: ApiNotification[] }>('/api/notifications').then((res) => res.notifications)
}

export function markNotificationRead(id: string) {
  return request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' })
}

/* Health Metrics */
export function getHealthMetrics() {
  return request<{ metrics: RemoteHealthMetric[] }>('/api/health-metrics').then((result) => result.metrics)
}

export function logHealthMetric(data: {
  metricType: 'steps' | 'heart_rate' | 'sleep' | 'hydration' | 'blood_oxygen' | 'weight'
  value: number
  unit: string
  goalValue?: number
  recordedAt?: string
}) {
  return request<{ metric: RemoteHealthMetric }>('/api/health-metrics', { method: 'POST', body: JSON.stringify(data) }).then((res) => res.metric)
}

/* CSV Data Export */
export async function downloadExport(table: string) {
  const response = await fetch(apiUrl(`/api/export/${table}`), { credentials: 'include' })
  if (!response.ok) throw new Error(`Export failed with status ${response.status}`)
  const blob = await response.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `medinexus-${table}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
