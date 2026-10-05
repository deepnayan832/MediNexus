import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { checkApiHealth, getCurrentUser, getHealthMetrics, login as apiLogin, logout as apiLogout, register as apiRegister, type ApiStatus, type ApiUser, type RemoteHealthMetric } from './api'

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
}

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

const baseKpis: Record<Role, Kpi[]> = {
  Admin: [
    { label: 'Appointments', value: '48', delta: '+12%', deltaTone: 'positive', note: 'vs. last week', color: 'cyan', icon: 'calendar', points: '2,26 14,21 26,24 38,16 50,19 62,11 74,13 86,7 98,10' },
    { label: 'Patients in care', value: '136', delta: '+6%', deltaTone: 'positive', note: 'vs. yesterday', color: 'mint', icon: 'people', points: '2,28 14,24 26,25 38,18 50,20 62,13 74,14 86,5 98,8' },
    { label: 'Bed occupancy', value: '78%', delta: '+4%', deltaTone: 'negative', note: 'vs. yesterday', color: 'coral', icon: 'bed', points: '2,24 14,23 26,19 38,23 50,17 62,20 74,12 86,14 98,5' },
    { label: 'Revenue this month', value: '$2.4M', delta: '+18%', deltaTone: 'positive', note: 'vs. last month', color: 'violet', icon: 'reports', points: '2,28 14,22 26,25 38,19 50,20 62,13 74,15 86,7 98,9' },
  ],
  Doctor: [
    { label: "Today's appointments", value: '12', delta: '+2', deltaTone: 'positive', note: 'vs. average day', color: 'cyan', icon: 'calendar', points: '2,25 14,20 26,24 38,14 50,18 62,12 74,14 86,7 98,9' },
    { label: 'Patients in care', value: '24', delta: '+6%', deltaTone: 'positive', note: 'vs. yesterday', color: 'mint', icon: 'people', points: '2,28 14,25 26,26 38,21 50,19 62,14 74,16 86,8 98,7' },
    { label: 'Follow-up rate', value: '86%', delta: '+8%', deltaTone: 'positive', note: 'vs. last month', color: 'violet', icon: 'activity', points: '2,25 14,24 26,20 38,18 50,19 62,12 74,11 86,6 98,8' },
    { label: 'Notes to sign', value: '18', delta: '-4', deltaTone: 'positive', note: 'since yesterday', color: 'coral', icon: 'file', points: '2,7 14,12 26,9 38,17 50,16 62,20 74,18 86,25 98,22' },
  ],
  Staff: [
    { label: 'Check-ins today', value: '48', delta: '+12%', deltaTone: 'positive', note: 'vs. last week', color: 'cyan', icon: 'calendar', points: '2,26 14,21 26,24 38,16 50,19 62,11 74,13 86,7 98,10' },
    { label: 'Patients in care', value: '136', delta: '+6%', deltaTone: 'positive', note: 'vs. yesterday', color: 'mint', icon: 'people', points: '2,28 14,24 26,25 38,18 50,20 62,13 74,14 86,5 98,8' },
    { label: 'Bed occupancy', value: '78%', delta: '+4%', deltaTone: 'negative', note: 'vs. yesterday', color: 'coral', icon: 'bed', points: '2,24 14,23 26,19 38,23 50,17 62,20 74,12 86,14 98,5' },
    { label: 'Open tasks', value: '24', delta: '-18%', deltaTone: 'positive', note: 'vs. yesterday', color: 'violet', icon: 'check', points: '2,28 14,24 26,26 38,21 50,18 62,16 74,11 86,13 98,7' },
  ],
  Patient: [
    { label: 'Upcoming visits', value: '3', delta: '+1', deltaTone: 'neutral', note: 'this month', color: 'cyan', icon: 'calendar', points: '2,21 14,18 26,21 38,16 50,19 62,14 74,17 86,12 98,14' },
    { label: 'Active prescriptions', value: '1', delta: 'On track', deltaTone: 'positive', note: 'medication plan', color: 'mint', icon: 'pharmacy', points: '2,25 14,22 26,24 38,20 50,19 62,15 74,16 86,11 98,9' },
    { label: 'Recovery plan', value: '92%', delta: '+8%', deltaTone: 'positive', note: 'vs. last check-in', color: 'violet', icon: 'heart', points: '2,28 14,25 26,24 38,20 50,18 62,16 74,12 86,11 98,6' },
    { label: 'Outstanding balance', value: '$240', delta: 'Due Sep 18', deltaTone: 'neutral', note: 'billing overview', color: 'coral', icon: 'reports', points: '2,10 14,15 26,13 38,18 50,17 62,19 74,18 86,24 98,22' },
  ],
}

const schedule = [
  { time: '08:00', name: 'Sarah Kim', detail: 'Follow-up · Cardiology', room: 'Room 301', color: 'cyan' },
  { time: '08:30', name: 'James Patel', detail: 'New patient · Internal Medicine', room: 'Room 204', color: 'blue' },
  { time: '09:00', name: 'Maria Lopez', detail: 'Pre-op assessment · Surgery', room: 'Room 312', color: 'mint' },
  { time: '10:30', name: 'Robert Chen', detail: 'Follow-up · Endocrinology', room: 'Room 218', color: 'violet' },
  { time: '11:00', name: 'Aisha Rahman', detail: 'Consultation · Pulmonology', room: 'Room 305', color: 'cyan' },
  { time: '13:00', name: 'Thomas Wright', detail: 'Post-op follow-up · Orthopedics', room: 'Room 320', color: 'mint' },
  { time: '14:30', name: 'Emily Carter', detail: 'New patient · Pediatrics', room: 'Room 210', color: 'violet' },
  { time: '16:00', name: 'Daniel Park', detail: 'Follow-up · Neurology', room: 'Room 228', color: 'cyan' },
]

const activity = [
  { time: '2 min ago', name: 'Dr. Elena Ruiz', detail: 'Completed round for Room 305', initials: 'ER', tone: 'cyan', status: 'On track' },
  { time: '12 min ago', name: 'Nurse James Wilson', detail: 'Vitals updated for Room 218', initials: 'JW', tone: 'blue', status: 'On track' },
  { time: '28 min ago', name: 'Dr. Priya Shah', detail: 'New note added for Room 301', initials: 'PS', tone: 'violet', status: 'On track' },
  { time: '1 hour ago', name: 'Resp. Therapist Mark Lee', detail: 'Treatment completed for Room 320', initials: 'ML', tone: 'mint', status: 'On track' },
  { time: '2 hours ago', name: 'Pharmacist Olivia Brown', detail: 'Medication review completed', initials: 'OB', tone: 'coral', status: 'Needs attention' },
]

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

const moduleRows: Record<string, { label: string; meta: string; value: string; tone: 'cyan' | 'mint' | 'violet' | 'coral' }[]> = {
  Patients: [
    { label: 'Olivia Harris', meta: 'P-20391 · Cardiology', value: 'Stable', tone: 'mint' },
    { label: 'James Patel', meta: 'P-19402 · Internal Medicine', value: 'New intake', tone: 'cyan' },
    { label: 'Maria Lopez', meta: 'P-18841 · Surgery', value: 'Pre-op', tone: 'violet' },
    { label: 'Robert Chen', meta: 'P-17438 · Endocrinology', value: 'Follow-up', tone: 'cyan' },
  ],
  Appointments: schedule.slice(0, 5).map((item) => ({ label: item.name, meta: `${item.time} · ${item.detail}`, value: item.room, tone: item.color === 'coral' ? 'coral' : item.color === 'violet' ? 'violet' : item.color === 'mint' ? 'mint' : 'cyan' })),
  'Inpatient Care': [
    { label: 'Ward A · Cardiology', meta: '32 beds · 26 occupied', value: '81%', tone: 'cyan' },
    { label: 'Ward B · Surgery', meta: '28 beds · 22 occupied', value: '79%', tone: 'violet' },
    { label: 'Ward C · Recovery', meta: '24 beds · 15 occupied', value: '63%', tone: 'mint' },
    { label: 'ICU · Critical Care', meta: '12 beds · 11 occupied', value: '92%', tone: 'coral' },
  ],
  Emergency: [
    { label: 'ED-24018 · Trauma', meta: 'Arrived 08:42 · Bed request active', value: 'Critical', tone: 'coral' },
    { label: 'ED-24016 · Cardiac', meta: 'Arrived 08:21 · Treatment ongoing', value: 'Serious', tone: 'violet' },
    { label: 'ED-24012 · Respiratory', meta: 'Arrived 07:58 · Awaiting consult', value: 'Stable', tone: 'mint' },
    { label: 'ED-24008 · Fall', meta: 'Arrived 07:44 · Observation', value: 'Observation', tone: 'cyan' },
  ],
  Pharmacy: [
    { label: 'Amoxicillin 500mg', meta: 'Batch AMX-042 · 1,240 units', value: 'In stock', tone: 'mint' },
    { label: 'Insulin glargine', meta: 'Batch INS-117 · 42 units', value: 'Low stock', tone: 'coral' },
    { label: 'Atorvastatin 20mg', meta: 'Batch ATV-298 · 486 units', value: 'In stock', tone: 'mint' },
    { label: 'Salbutamol inhaler', meta: 'Batch SAL-081 · 180 units', value: 'Reorder', tone: 'violet' },
  ],
  'Lab & Diagnostics': [
    { label: 'CBC · Sarah Kim', meta: 'Ordered 08:12 · Hematology', value: 'Processing', tone: 'violet' },
    { label: 'Troponin · James Patel', meta: 'Ordered 07:51 · Urgent', value: 'Needs review', tone: 'coral' },
    { label: 'MRI · Maria Lopez', meta: 'Scheduled 11:30 · Radiology', value: 'Scheduled', tone: 'cyan' },
    { label: 'Lipid panel · Robert Chen', meta: 'Collected yesterday · Biochemistry', value: 'Ready', tone: 'mint' },
  ],
  'Billing & Revenue': [
    { label: 'October revenue', meta: 'Across 4 departments · Updated today', value: '$2.4M', tone: 'violet' },
    { label: 'Claims pending', meta: '32 submissions · Payer review', value: '$186K', tone: 'coral' },
    { label: 'Collected today', meta: 'Front desk and portal payments', value: '$42.8K', tone: 'mint' },
    { label: 'Insurance follow-ups', meta: '8 cases need documents', value: '8 open', tone: 'cyan' },
  ],
  Reports: [
    { label: 'Patient experience', meta: 'Monthly operating review · 92% response', value: '92%', tone: 'mint' },
    { label: 'Average ED wait time', meta: 'Live metric · Across all shifts', value: '36 min', tone: 'cyan' },
    { label: 'Readmission rate', meta: '30-day cohort · Quality review', value: '4.8%', tone: 'violet' },
    { label: 'Critical incidents', meta: 'Last 30 days · Safety review', value: '2', tone: 'coral' },
  ],
  Settings: [
    { label: 'Care team permissions', meta: 'Role-based access · 12 policies', value: 'Healthy', tone: 'mint' },
    { label: 'Data integrations', meta: 'EHR, lab, pharmacy · 4 connected', value: 'Connected', tone: 'cyan' },
    { label: 'Audit log', meta: 'Last export · Today at 06:12', value: 'Up to date', tone: 'violet' },
    { label: 'Backup status', meta: 'Encrypted snapshot · 3 hours ago', value: 'Protected', tone: 'mint' },
  ],
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

function Sparkline({ points, color }: { points: string; color: Kpi['color'] }) {
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
  const [remoteHealthMetrics, setRemoteHealthMetrics] = useState<RemoteHealthMetric[]>([])
  const [roleOpen, setRoleOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [modal, setModal] = useState<'appointment' | 'emergency' | null>(null)
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showAllSchedule, setShowAllSchedule] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('medinexus-theme', theme)
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    checkApiHealth(controller.signal).then(() => setApiStatus('connected')).catch(() => {
      if (!controller.signal.aborted) setApiStatus('offline')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    let active = true
    getCurrentUser().then((user) => {
      if (!active || !user) return
      setSessionUser(user)
      setRole(user.role)
      setActiveNav(navByRole[user.role][0].label)
    }).catch(() => {
      // Offline mode intentionally keeps the local demo workspace available.
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (sessionUser?.role !== 'Patient') {
      setRemoteHealthMetrics([])
      return
    }
    let active = true
    getHealthMetrics().then((metrics) => {
      if (active) setRemoteHealthMetrics(metrics)
    }).catch(() => {
      if (active) setRemoteHealthMetrics([])
    })
    return () => { active = false }
  }, [sessionUser])

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

  const profile = sessionUser ? { ...roleProfiles[role], name: sessionUser.name, initials: sessionUser.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() } : roleProfiles[role]
  const navItems = navByRole[role]
  const kpis = baseKpis[role]
  const workspaceRoles: Role[] = sessionUser ? [sessionUser.role] : (Object.keys(roleProfiles) as Role[])
  const isDashboard = activeNav === navItems[0].label
  const rows = moduleRows[activeNav] ?? moduleRows.Patients
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => `${row.label} ${row.meta} ${row.value}`.toLowerCase().includes(query))
  }, [rows, search])

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
      // Audio feedback is an enhancement; visual state remains the source of truth.
    }
  }

  const handleAction = (message: string, tone: FeedbackTone = 'success') => {
    triggerFeedback(tone)
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
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
    setActiveNav(navByRole[nextRole][0].label)
    setRoleOpen(false)
    handleAction(`${nextRole} workspace loaded`, 'tap')
  }

  const handleAuthenticated = (user: ApiUser) => {
    setSessionUser(user)
    setRole(user.role)
    setActiveNav(navByRole[user.role][0].label)
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
      setRoleOpen(false)
      handleAction('You have been safely signed out', 'success')
    }
  }

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
        {navItems.map((item) => <button key={item.label} className={`nav-item ${activeNav === item.label ? 'active' : ''}`} onClick={() => { setActiveNav(item.label); setMobileNavOpen(false); triggerFeedback('tap') }}><Icon name={item.icon} size={20} /><span>{item.label}</span>{item.label === 'Emergency' && <span className="nav-alert-dot" />}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="connection-card"><div className="connection-glow" /><span className="connection-line" /><strong>Connected care<br />for a healthier<br />tomorrow</strong><div className="connection-buildings" aria-hidden="true"><i /><i /><i /></div></div>
        <button className="sidebar-bottom-link" onClick={() => handleAction('Help center opened')}><Icon name="message" size={17} />Help & support</button>
        <button className="sidebar-bottom-link" onClick={() => { if (sessionUser) void handleSignOut(); else handleAction('Sign in to enable account sessions', 'tap') }}><Icon name="logout" size={17} />{sessionUser ? 'Sign out' : 'Sign in'}</button>
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
          <button className={`notification-button icon-button ${notificationsOpen ? 'active' : ''}`} aria-label="Open notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={21} /><span /></button>
          <div className="topbar-divider" />
          <button className="profile-trigger" aria-label={`Switch workspace, current ${profile.workspace}`} aria-expanded={roleOpen} onClick={() => setRoleOpen((open) => !open)}><span className={`avatar avatar-large avatar-${profile.initials.toLowerCase()}`}>{profile.initials}</span><span className="profile-copy"><strong>{profile.name}</strong><small>{profile.title}</small></span><Icon name="chevron" size={16} /></button>
        </div>
        {preferencesOpen && <PreferencesPanel theme={theme} soundEnabled={soundEnabled} hapticsEnabled={hapticsEnabled} onThemeChange={setTheme} onSoundChange={setSoundEnabled} onHapticsChange={setHapticsEnabled} onAction={handleAction} />}
        {notificationsOpen && <div className="notification-panel"><div className="panel-heading"><div><span className="eyebrow">Inbox</span><h2>Notifications</h2></div><button className="text-button" onClick={() => setNotificationsOpen(false)}>Mark all read</button></div><div className="notification-item unread"><span className="notification-symbol notification-symbol-coral"><Icon name="alert" size={17} /></span><div><strong>Critical care alert</strong><p>2 patients are waiting for an ICU bed.</p><small>4 min ago</small></div></div><div className="notification-item"><span className="notification-symbol notification-symbol-cyan"><Icon name="flask" size={17} /></span><div><strong>Lab result ready</strong><p>Robert Chen's lipid panel is ready to review.</p><small>18 min ago</small></div></div><div className="notification-item"><span className="notification-symbol notification-symbol-mint"><Icon name="check" size={17} /></span><div><strong>Shift handoff complete</strong><p>Ward B handoff was signed by James Wilson.</p><small>1 hour ago</small></div></div></div>}
      </header>

      <section className="page-content">
        {import.meta.env.PROD && <div className="prototype-notice" role="note">Prototype preview: dashboard examples are simulated and are not clinical records. Do not enter real patient information.</div>}
        {isDashboard ? <>
          <div className="page-heading">
            <div><h1>Good morning, {profile.name}</h1><p className="page-subtitle">{role === 'Patient' ? 'Your care plan, appointments, and next steps in one place.' : "Here is today's care overview"}</p></div>
            <div className="heading-actions"><button className="button button-primary" onClick={() => setModal('appointment')}><Icon name="calendar" size={18} />{role === 'Patient' ? 'Book appointment' : 'New appointment'}</button><button className="button button-danger" onClick={() => setModal('emergency')}><Icon name="alert" size={18} />Emergency access</button></div>
          </div>
          <div className="kpi-grid">{kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}</div>
          {role === 'Patient' ? <PatientDashboard remoteMetrics={remoteHealthMetrics} onAction={handleAction} onOpenDetail={openDetail} /> : <>
            <div className="main-grid">
              <section className="panel schedule-panel"><div className="panel-heading"><div><span className="eyebrow">{role === 'Doctor' ? 'Your day' : 'Live schedule'}</span><h2>Today's schedule</h2></div><button className="text-button" onClick={() => setShowAllSchedule((open) => !open)}>{showAllSchedule ? 'Show less' : 'View all'} <Icon name="arrow" size={15} /></button></div><div className="schedule-list">{schedule.slice(0, showAllSchedule ? schedule.length : 6).map((item) => <button key={`${item.time}-${item.name}`} className={`schedule-row ${selectedAppointment === item.name ? 'selected' : ''}`} onClick={() => { setSelectedAppointment(item.name); openDetail({ eyebrow: 'Appointment', title: item.name, meta: item.detail, tone: item.color === 'violet' ? 'violet' : item.color === 'mint' ? 'mint' : 'cyan', icon: 'calendar', facts: [{ label: 'Time', value: item.time }, { label: 'Room', value: item.room }, { label: 'Care team', value: item.detail.split(' · ')[1] ?? 'General care' }], timeline: [{ label: 'Status', value: 'Confirmed' }, { label: 'Last updated', value: 'Just now' }] }); handleAction(`${item.name}'s appointment selected`, 'tap') }}><span className="schedule-time">{item.time}</span><span className={`schedule-dot dot-${item.color}`} /><span className="schedule-connector" /><span className="schedule-patient"><strong>{item.name}</strong><small>{item.detail}</small></span><span className="schedule-room">{item.room}</span><Icon name="chevron" size={15} /></button>)}</div></section>
              <section className="panel flow-panel"><div className="panel-heading flow-heading"><div><span className="eyebrow">Throughput</span><h2>Patient flow</h2></div><div className="flow-actions"><div className="legend"><span><i className="legend-dot cyan" />Inpatients</span><span><i className="legend-dot violet" />ED visits</span><span><i className="legend-dot mint" />Discharges</span></div><span className="live-status"><i />Live</span></div></div><div className="flow-toolbar"><span className="flow-updated"><Icon name="activity" size={15} />Updated just now</span><div className="range-picker">{(['Today', '7d', '30d'] as const).map((item) => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div><FlowChart range={range} /><div className="flow-insights"><div><Icon name="people" size={22} /><strong>92<small>Currently in ED</small></strong><span className="insight-bad">▲ +8%</span></div><div><Icon name="bed" size={22} /><strong>14<small>Waiting for bed</small></strong><span className="insight-bad">▲ +27%</span></div><div><Icon name="clock" size={22} /><strong>36 min<small>Avg. ED wait time</small></strong><span className="insight-good">▲ −18%</span></div><div><Icon name="arrow" size={22} /><strong>28<small>Discharges today</small></strong><span className="insight-good">▲ +12%</span></div></div></section>
            </div>
            <div className="bottom-grid"><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">Across the network</span><h2>Care team activity</h2></div><button className="text-button" onClick={() => openDetail({ eyebrow: 'Care team activity', title: 'Network activity feed', meta: '5 recent care events', tone: 'cyan', icon: 'activity', facts: [{ label: 'Events today', value: '28' }, { label: 'On track', value: '26' }, { label: 'Needs attention', value: '2' }], timeline: activity.slice(0, 4).map((item) => ({ label: item.time, value: `${item.name} · ${item.detail}` })) })}>View all <Icon name="arrow" size={15} /></button></div><div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.name}><span className={`avatar avatar-${item.tone}`}>{item.initials}</span><span className="activity-time">{item.time}</span><div className="activity-copy"><strong>{item.name}</strong><small>{item.detail}</small></div><span className={`status status-${item.status === 'On track' ? 'success' : 'attention'}`}>{item.status}</span><button className="icon-button ghost" aria-label={`More options for ${item.name}`} onClick={() => openDetail({ eyebrow: 'Care team activity', title: item.name, meta: item.detail, tone: item.tone === 'coral' ? 'coral' : item.tone === 'violet' ? 'violet' : item.tone === 'mint' ? 'mint' : 'cyan', icon: 'activity', facts: [{ label: 'Status', value: item.status }, { label: 'Recorded', value: item.time }], actionLabel: 'Open care note' })}><Icon name="more" size={17} /></button></div>)}</div></section><EmergencyPanel onEmergency={() => setModal('emergency')} onOpenDetail={openDetail} /></div>
          </>}
        </> : <ModuleView activeNav={activeNav} rows={filteredRows} search={search} remoteMetrics={remoteHealthMetrics} onAction={handleAction} onEmergency={() => setModal('emergency')} onOpenDetail={openDetail} />}
      </section>
    </main>

    {mobileNavOpen && <button className="mobile-scrim" aria-label="Dismiss navigation overlay" onClick={() => setMobileNavOpen(false)} />}
    {authOpen && <AuthDialog mode={authMode} onClose={() => setAuthOpen(false)} onModeChange={setAuthMode} onAuthenticated={handleAuthenticated} />}
    {modal && <Modal type={modal} onClose={() => setModal(null)} onAction={(message) => { setModal(null); handleAction(message) }} />}
    {detailItem && <DetailsDrawer item={detailItem} onClose={() => setDetailItem(null)} onAction={(message) => { setDetailItem(null); handleAction(message) }} />}
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

function PatientDashboard({ remoteMetrics, onAction, onOpenDetail }: { remoteMetrics: RemoteHealthMetric[]; onAction: (message: string, tone?: FeedbackTone) => void; onOpenDetail: (item: DetailItem) => void }) {
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
    <div className="patient-grid"><section className="panel care-plan-panel"><div className="patient-hero"><div><span className="eyebrow">Care plan progress</span><h2>Your recovery is on track</h2><p>Keep following your care plan to stay ahead of your next milestone.</p></div><div className="progress-ring"><svg viewBox="0 0 80 80"><circle className="ring-track" cx="40" cy="40" r="32" /><circle className="ring-value" cx="40" cy="40" r="32" /></svg><strong>92<small>%</small></strong></div></div><div className="plan-steps"><div className="plan-step complete"><span><Icon name="check" size={15} /></span><div><strong>Medication plan</strong><small>Completed today at 08:12</small></div></div><div className="plan-step complete"><span><Icon name="check" size={15} /></span><div><strong>Daily health check-in</strong><small>Completed yesterday</small></div></div><div className="plan-step upcoming"><span><Icon name="calendar" size={15} /></span><div><strong>Cardiology follow-up</strong><small>Thursday · 10:30 AM</small></div><button className="text-button" onClick={() => onOpenDetail(appointmentDetail)}>Details <Icon name="arrow" size={15} /></button></div></div></section><section className="panel next-visit-panel"><div className="panel-heading"><div><span className="eyebrow">Next visit</span><h2>Cardiology follow-up</h2></div><button className="icon-button ghost" aria-label="More appointment options" onClick={() => onOpenDetail(appointmentDetail)}><Icon name="more" size={17} /></button></div><div className="visit-date"><span className="visit-day">18</span><div><strong>Thursday, September 18</strong><small>10:30 AM · Room 301</small></div></div><div className="doctor-line"><span className="avatar avatar-cyan">ER</span><div><strong>Dr. Elena Ruiz</strong><small>Cardiology</small></div><button className="icon-button ghost" aria-label="Message Dr. Elena Ruiz" onClick={() => onAction('Message composer opened', 'tap')}><Icon name="message" size={17} /></button></div><button className="button button-soft button-full" onClick={() => onOpenDetail(appointmentDetail)}>View appointment details <Icon name="arrow" size={16} /></button></section></div>
    <HealthTracker compact remoteMetrics={remoteMetrics} onAction={onAction} onOpenDetail={onOpenDetail} />
  </>
}

function HealthTracker({ compact = false, remoteMetrics, onAction, onOpenDetail }: { compact?: boolean; remoteMetrics?: RemoteHealthMetric[]; onAction: (message: string, tone?: FeedbackTone) => void; onOpenDetail: (item: DetailItem) => void }) {
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
    facts: [{ label: 'Current reading', value: metric.value }, { label: 'Target', value: metric.goal }, { label: 'Last synced', value: 'Just now' }],
    timeline: [{ label: 'Today', value: metric.meta }, { label: 'Trend', value: metric.progress >= 90 ? 'On track' : 'Moving toward goal' }],
    actionLabel: `Log ${metric.label.toLowerCase()}`,
  })
  return <section className={`panel health-tracker ${compact ? 'health-tracker-compact' : ''}`}><div className="panel-heading"><div><span className="eyebrow">Personal health data</span><h2>{compact ? "Today's health snapshot" : 'Health tracker'}</h2></div><div className="tracker-heading-actions"><span className="sync-status"><i />{remoteMetrics?.length ? 'API synced just now' : 'Demo snapshot'}</span>{compact && <button className="text-button" onClick={() => onAction('Health tracker opened', 'tap')}>Open full tracker <Icon name="arrow" size={15} /></button>}</div></div><div className="health-metric-grid">{displayMetrics.map((metric) => <button className={`health-metric health-metric-${metric.tone}`} key={metric.label} onClick={() => onOpenDetail(healthDetail(metric))}><span className="health-metric-icon"><Icon name={metric.icon} size={19} /></span><span className="health-metric-copy"><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.meta}</small></span><span className="metric-progress"><i style={{ width: `${metric.progress}%` }} /></span><Icon name="chevron" size={14} /></button>)}</div><div className="health-visuals"><div className="health-chart-block"><div className="health-block-heading"><span><strong>Heart rate trend</strong><small>Resting average · Last 7 days</small></span><b>72 <small>bpm</small></b></div><svg className="health-chart" viewBox="0 0 520 115" role="img" aria-label="Heart rate trend chart"><defs><linearGradient id="health-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#19c5d1" stopOpacity=".22" /><stop offset="1" stopColor="#19c5d1" stopOpacity="0" /></linearGradient></defs><path className="health-grid-line" d="M0 20h520M0 57h520M0 94h520" /><path className="health-chart-fill" d="M0 80 74 68 148 77 222 42 296 55 370 31 444 44 520 22V115H0Z" /><polyline className="health-line" points="0,80 74,68 148,77 222,42 296,55 370,31 444,44 520,22" />{[[0,80],[74,68],[148,77],[222,42],[296,55],[370,31],[444,44],[520,22]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} className="health-point" cx={cx} cy={cy} r="4" />)}</svg><div className="health-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div><div className="health-insight-block"><div className="health-block-heading"><span><strong>Daily goals</strong><small>Keep your care plan moving</small></span><Icon name="spark" size={20} /></div><div className="goal-row"><span><i className="goal-icon goal-icon-cyan"><Icon name="activity" size={15} /></i><strong>Steps</strong><small>6,842 / 8,000</small></span><b>86%</b></div><div className="goal-row"><span><i className="goal-icon goal-icon-violet"><Icon name="moon" size={15} /></i><strong>Sleep</strong><small>7h 42m / 8h</small></span><b>96%</b></div><div className="goal-row"><span><i className="goal-icon goal-icon-mint"><Icon name="spark" size={15} /></i><strong>Hydration</strong><small>1.6 L / 2.0 L</small></span><b>80%</b></div><button className="button button-soft tracker-log-button" onClick={() => onAction('Health log opened', 'tap')}><Icon name="plus" size={15} />Log health data</button></div></div></section>
}

function PreferencesPanel({ theme, soundEnabled, hapticsEnabled, onThemeChange, onSoundChange, onHapticsChange, onAction }: { theme: Theme; soundEnabled: boolean; hapticsEnabled: boolean; onThemeChange: (theme: Theme) => void; onSoundChange: (enabled: boolean) => void; onHapticsChange: (enabled: boolean) => void; onAction: (message: string, tone?: FeedbackTone) => void }) {
  return <div className="preferences-panel"><div className="preferences-heading"><div><span className="eyebrow">Interface</span><h2>Preferences</h2></div><span className="privacy-note"><Icon name="shield" size={13} />Stored on this device</span></div><div className="preference-row"><span className="preference-icon"><Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} /></span><span><strong>Theme</strong><small>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</small></span><button className="segmented-control" aria-label="Switch theme" onClick={() => { const nextTheme = theme === 'dark' ? 'light' : 'dark'; onThemeChange(nextTheme); onAction(`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme enabled`, 'tap') }}><span className={theme === 'light' ? 'active' : ''}>Light</span><span className={theme === 'dark' ? 'active' : ''}>Dark</span></button></div><label className="preference-row preference-toggle"><span className="preference-icon"><Icon name={soundEnabled ? 'volume' : 'volumeOff'} size={17} /></span><span><strong>Sound feedback</strong><small>Short confirmation tones after actions</small></span><input type="checkbox" checked={soundEnabled} onChange={(event) => { onSoundChange(event.target.checked); onAction(event.target.checked ? 'Sound feedback enabled' : 'Sound feedback muted', 'tap') }} /><i /></label><label className="preference-row preference-toggle"><span className="preference-icon"><Icon name="vibrate" size={17} /></span><span><strong>Vibration cues</strong><small>Use supported device haptics for feedback</small></span><input type="checkbox" checked={hapticsEnabled} onChange={(event) => { onHapticsChange(event.target.checked); onAction(event.target.checked ? 'Vibration cues enabled' : 'Vibration cues muted', 'tap') }} /><i /></label><button className="text-button preferences-test" onClick={() => onAction('Feedback test complete', 'success')}><Icon name="spark" size={15} />Test feedback</button></div>
}

function DetailsDrawer({ item, onClose, onAction }: { item: DetailItem; onClose: () => void; onAction: (message: string) => void }) {
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="details-drawer" role="dialog" aria-modal="true" aria-labelledby="details-title"><div className="drawer-topline"><span className={`drawer-symbol drawer-symbol-${item.tone}`}><Icon name={item.icon} size={21} /></span><button className="icon-button ghost" aria-label="Close details" onClick={onClose}><Icon name="close" size={18} /></button></div><span className="eyebrow">{item.eyebrow}</span><h2 id="details-title">{item.title}</h2><p className="drawer-meta">{item.meta}</p><div className="drawer-facts">{item.facts.map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div>{item.timeline && <div className="drawer-timeline"><h3>Activity</h3>{item.timeline.map((event) => <div key={`${event.label}-${event.value}`}><i /><span><strong>{event.label}</strong><small>{event.value}</small></span></div>)}</div>}<div className="drawer-actions"><button className="button button-primary button-full" onClick={() => onAction(item.actionLabel ?? 'Full record opened')}><Icon name="arrow" size={16} />{item.actionLabel ?? 'Open full record'}</button><button className="button button-soft button-full" onClick={onClose}>Close details</button></div></aside></div>
}

function PatientOverview({ onAction }: { onAction: (message: string) => void }) {
  return <div className="patient-grid"><section className="panel care-plan-panel"><div className="patient-hero"><div><span className="eyebrow">Care plan progress</span><h2>Your recovery is on track</h2><p>Keep following your care plan to stay ahead of your next milestone.</p></div><div className="progress-ring"><svg viewBox="0 0 80 80"><circle className="ring-track" cx="40" cy="40" r="32" /><circle className="ring-value" cx="40" cy="40" r="32" /></svg><strong>92<small>%</small></strong></div></div><div className="plan-steps"><div className="plan-step complete"><span><Icon name="check" size={15} /></span><div><strong>Medication plan</strong><small>Completed today at 08:12</small></div></div><div className="plan-step complete"><span><Icon name="check" size={15} /></span><div><strong>Daily health check-in</strong><small>Completed yesterday</small></div></div><div className="plan-step upcoming"><span><Icon name="calendar" size={15} /></span><div><strong>Cardiology follow-up</strong><small>Thursday · 10:30 AM</small></div><button className="text-button" onClick={() => onAction('Appointment details opened')}>Details <Icon name="arrow" size={15} /></button></div></div></section><section className="panel next-visit-panel"><div className="panel-heading"><div><span className="eyebrow">Next visit</span><h2>Cardiology follow-up</h2></div><button className="icon-button ghost" aria-label="More appointment options" onClick={() => onAction('Appointment menu opened')}><Icon name="more" size={17} /></button></div><div className="visit-date"><span className="visit-day">18</span><div><strong>Thursday, September 18</strong><small>10:30 AM · Room 301</small></div></div><div className="doctor-line"><span className="avatar avatar-cyan">ER</span><div><strong>Dr. Elena Ruiz</strong><small>Cardiology</small></div><button className="icon-button ghost" aria-label="Message Dr. Elena Ruiz" onClick={() => onAction('Message composer opened')}><Icon name="message" size={17} /></button></div><button className="button button-soft button-full" onClick={() => onAction('Appointment details opened')}>View appointment details <Icon name="arrow" size={16} /></button></section></div>
}

function EmergencyPanel({ onEmergency, onOpenDetail }: { onEmergency: () => void; onOpenDetail: (item: DetailItem) => void }) {
  const emergencyDetail: DetailItem = { eyebrow: 'Real-time triage', title: 'Emergency status', meta: '92 ED patients across 4 care priorities', tone: 'coral', icon: 'alert', facts: [{ label: 'Critical', value: '8' }, { label: 'Serious', value: '21' }, { label: 'Stable', value: '45' }, { label: 'Observation', value: '18' }], timeline: [{ label: 'ICU beds', value: '2 patients waiting' }, { label: 'Average ED wait', value: '36 minutes' }], actionLabel: 'Open emergency queue' }
  return <section className="panel emergency-panel"><div className="panel-heading"><div><span className="eyebrow">Real-time triage</span><h2>Emergency status</h2></div><button className="text-button" onClick={() => onOpenDetail(emergencyDetail)}>View all <Icon name="arrow" size={15} /></button></div><div className="emergency-summary"><div className="gauge"><svg viewBox="0 0 140 85"><path className="gauge-track" d="M12 74a58 58 0 0 1 116 0" /><path className="gauge-value" d="M12 74a58 58 0 0 1 116 0" /></svg><strong>92<small>ED patients</small></strong></div><div className="emergency-legend"><span><i className="severity critical" />Critical <b>8</b></span><span><i className="severity serious" />Serious <b>21</b></span><span><i className="severity stable" />Stable <b>45</b></span><span><i className="severity observation" />Observation <b>18</b></span></div></div><button className="critical-callout" onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Critical care queue', meta: '2 patients waiting for an ICU bed', actionLabel: 'Open emergency access' })}><span><Icon name="alert" size={18} /></span><strong>2 critical patients waiting for ICU bed</strong><Icon name="arrow" size={17} /></button><div className="emergency-teams"><button onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Trauma team', meta: 'Trauma response team · On track', tone: 'mint' })}><strong>Trauma</strong><span><i />On track</span></button><button onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Stroke team', meta: 'Stroke response team · On track', tone: 'mint' })}><strong>Stroke</strong><span><i />On track</span></button><button onClick={() => onOpenDetail({ ...emergencyDetail, title: 'Cardiac team', meta: 'Cardiac response team · Needs attention', tone: 'coral' })}><strong>Cardiac</strong><span className="attention"><i />Needs attention</span></button></div><button className="emergency-panel-action button button-danger" onClick={onEmergency}><Icon name="alert" size={15} />Emergency access</button></section>
}

function ModuleView({ activeNav, rows, search, remoteMetrics, onAction, onEmergency, onOpenDetail }: { activeNav: string; rows: { label: string; meta: string; value: string; tone: string }[]; search: string; remoteMetrics: RemoteHealthMetric[]; onAction: (message: string, tone?: FeedbackTone) => void; onEmergency: () => void; onOpenDetail: (item: DetailItem) => void }) {
  const isEmergency = activeNav === 'Emergency'
  if (activeNav === 'Health tracker') return <div className="module-page"><div className="page-heading"><div><p className="eyebrow">Personal health data</p><h1>Health tracker</h1><p className="page-subtitle">See your connected health signals, goals, and trends in one view.</p></div><div className="heading-actions"><button className="button button-primary" onClick={() => onAction('Health log opened', 'tap')}><Icon name="plus" size={18} />Log health data</button></div></div><HealthTracker remoteMetrics={remoteMetrics} onAction={onAction} onOpenDetail={onOpenDetail} /></div>
  return <div className="module-page"><div className="page-heading"><div><p className="eyebrow">Workspace module</p><h1>{activeNav}</h1><p className="page-subtitle">Manage connected care workflows with clarity and confidence.</p></div><div className="heading-actions"><button className="button button-primary" onClick={() => onAction(`${activeNav} creation flow opened`)}><Icon name="plus" size={18} />Create new</button>{isEmergency && <button className="button button-danger" onClick={onEmergency}><Icon name="alert" size={18} />Emergency access</button>}</div></div><div className="module-toolbar"><div className="module-count"><strong>{rows.length}</strong> active records {search && <span>matching “{search}”</span>}</div><div className="module-tools"><button className="button button-soft" onClick={() => onAction('Filters opened')}><Icon name="filter" size={17} />Filter</button><button className="button button-soft" onClick={() => onAction('Report export started')}><Icon name="download" size={17} />Export</button></div></div><section className="panel module-table"><div className="module-table-header"><span>Record</span><span>Details</span><span>Status / value</span><span /></div>{rows.length ? rows.map((row) => <button className="module-row" key={row.label} onClick={() => onOpenDetail({ eyebrow: activeNav, title: row.label, meta: row.meta, tone: row.tone === 'coral' ? 'coral' : row.tone === 'violet' ? 'violet' : row.tone === 'mint' ? 'mint' : 'cyan', icon: activeNav === 'Patients' ? 'people' : activeNav === 'Appointments' ? 'calendar' : activeNav === 'Emergency' ? 'alert' : 'activity', facts: [{ label: 'Status / value', value: row.value }, { label: 'Module', value: activeNav }, { label: 'Last updated', value: 'Just now' }], actionLabel: `Open ${row.label}` })}><span className="module-record"><span className={`module-symbol symbol-${row.tone}`}><Icon name={activeNav === 'Patients' ? 'people' : activeNav === 'Appointments' ? 'calendar' : activeNav === 'Emergency' ? 'alert' : 'activity'} size={18} /></span><strong>{row.label}</strong></span><span className="module-meta">{row.meta}</span><span className={`module-value module-value-${row.tone}`}><i />{row.value}</span><Icon name="chevron" size={16} /></button>) : <div className="empty-state"><span><Icon name="search" size={22} /></span><h2>No matching records</h2><p>Try a different search term or clear the global search.</p></div>}</section></div>
}

function Modal({ type, onClose, onAction }: { type: 'appointment' | 'emergency'; onClose: () => void; onAction: (message: string) => void }) {
  const emergency = type === 'emergency'
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`modal ${emergency ? 'modal-emergency' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button ghost" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={19} /></button><div className={`modal-symbol ${emergency ? 'modal-symbol-danger' : 'modal-symbol-primary'}`}><Icon name={emergency ? 'alert' : 'calendar'} size={23} /></div><span className="eyebrow">{emergency ? 'Priority access' : 'Schedule care'}</span><h2 id="modal-title">{emergency ? 'Open emergency access' : 'Create new appointment'}</h2><p>{emergency ? 'This will open the protected emergency workflow for triage, patient identification, and bed coordination.' : 'Start a new appointment request and route it to the right care team.'}</p>{emergency ? <div className="emergency-modal-options"><button onClick={() => onAction('Emergency triage workflow opened')}><span className="option-icon option-icon-danger"><Icon name="alert" size={19} /></span><div><strong>Start emergency triage</strong><small>Register a new emergency case</small></div><Icon name="arrow" size={17} /></button><button onClick={() => onAction('Critical patient queue opened')}><span className="option-icon option-icon-violet"><Icon name="bed" size={19} /></span><div><strong>Review critical queue</strong><small>See patients awaiting immediate care</small></div><Icon name="arrow" size={17} /></button></div> : <div className="appointment-form"><label>Patient or record<input autoFocus placeholder="Search by name or patient ID" /></label><label>Care team<select defaultValue=""><option value="" disabled>Select department</option><option>Cardiology</option><option>Internal Medicine</option><option>Orthopedics</option><option>Pediatrics</option></select></label><div className="form-split"><label>Date<input type="date" defaultValue="2026-09-18" /></label><label>Time<select defaultValue="10:30"><option>09:00</option><option>10:30</option><option>13:00</option><option>14:30</option></select></label></div><button className="button button-primary button-full" onClick={() => onAction('Appointment draft created')}>Continue to review <Icon name="arrow" size={17} /></button></div>}</section></div>
}

export default App

