/* ============================================
   Mock Data for Production Manager Test UI
   ============================================ */

const PHASES = ['bidding', 'awarded', 'preproduction', 'production', 'live', 'wrap', 'settled', 'archived'];

const PHASE_LABELS = {
  bidding: 'Bidding',
  awarded: 'Awarded',
  preproduction: 'Pre-Production',
  production: 'Production',
  live: 'Live',
  wrap: 'Wrap',
  settled: 'Settled',
  archived: 'Archived'
};

const DEPARTMENTS = [
  { id: 'd1', name: 'Audio', color: '#3b82f6' },
  { id: 'd2', name: 'Video', color: '#8b5cf6' },
  { id: 'd3', name: 'Lighting', color: '#f59e0b' },
  { id: 'd4', name: 'Staging', color: '#22c55e' },
  { id: 'd5', name: 'Production', color: '#ef4444' },
  { id: 'd6', name: 'Graphics', color: '#06b6d4' },
  { id: 'd7', name: 'Rigging', color: '#f97316' },
  { id: 'd8', name: 'Transport', color: '#ec4899' }
];

const CLIENTS = [
  { id: 'c1', name: 'NBC Sports', contact: 'Sarah Mitchell', email: 'sarah@nbc.com' },
  { id: 'c2', name: 'ESPN', contact: 'James Rodriguez', email: 'james@espn.com' },
  { id: 'c3', name: 'Live Nation', contact: 'Emily Chen', email: 'emily@livenation.com' },
  { id: 'c4', name: 'MSG Entertainment', contact: 'David Kim', email: 'david@msg.com' },
  { id: 'c5', name: 'AEG Presents', contact: 'Lisa Park', email: 'lisa@aeg.com' }
];

const VENUES = [
  { id: 'v1', name: 'Madison Square Garden', city: 'New York, NY' },
  { id: 'v2', name: 'SoFi Stadium', city: 'Los Angeles, CA' },
  { id: 'v3', name: 'AT&T Stadium', city: 'Arlington, TX' },
  { id: 'v4', name: 'Allegiant Stadium', city: 'Las Vegas, NV' },
  { id: 'v5', name: 'MetLife Stadium', city: 'East Rutherford, NJ' },
  { id: 'v6', name: 'State Farm Arena', city: 'Atlanta, GA' },
  { id: 'v7', name: 'United Center', city: 'Chicago, IL' },
  { id: 'v8', name: 'Chase Center', city: 'San Francisco, CA' }
];

const PERSONNEL = [
  { id: 'p1', name: 'Mike Thompson', dept: 'd1', role: 'A1 - Audio Engineer', rate: 850, avatar: '#3b82f6', initials: 'MT', status: 'available' },
  { id: 'p2', name: 'Sarah Lee', dept: 'd1', role: 'A2 - Audio Tech', rate: 550, avatar: '#8b5cf6', initials: 'SL', status: 'available' },
  { id: 'p3', name: 'Jake Wilson', dept: 'd2', role: 'TD - Technical Director', rate: 950, avatar: '#22c55e', initials: 'JW', status: 'on_event' },
  { id: 'p4', name: 'Emma Davis', dept: 'd2', role: 'Shader - Video Shader', rate: 700, avatar: '#f59e0b', initials: 'ED', status: 'available' },
  { id: 'p5', name: 'Chris Martinez', dept: 'd3', role: 'LD - Lighting Designer', rate: 900, avatar: '#ef4444', initials: 'CM', status: 'on_event' },
  { id: 'p6', name: 'Jessica Brown', dept: 'd3', role: 'Lighting Tech', rate: 500, avatar: '#06b6d4', initials: 'JB', status: 'available' },
  { id: 'p7', name: 'Ryan Taylor', dept: 'd4', role: 'Stage Manager', rate: 800, avatar: '#f97316', initials: 'RT', status: 'available' },
  { id: 'p8', name: 'Alex Johnson', dept: 'd5', role: 'Production Manager', rate: 1200, avatar: '#ec4899', initials: 'AJ', status: 'on_event' },
  { id: 'p9', name: 'Dan Roberts', dept: 'd6', role: 'Graphics Operator', rate: 650, avatar: '#3b82f6', initials: 'DR', status: 'available' },
  { id: 'p10', name: 'Olivia White', dept: 'd7', role: 'Head Rigger', rate: 750, avatar: '#8b5cf6', initials: 'OW', status: 'unavailable' },
  { id: 'p11', name: 'Nick Foster', dept: 'd2', role: 'Camera Op', rate: 600, avatar: '#22c55e', initials: 'NF', status: 'available' },
  { id: 'p12', name: 'Katie Young', dept: 'd1', role: 'RF Tech', rate: 550, avatar: '#f59e0b', initials: 'KY', status: 'available' }
];

const TRUCKS = [
  { id: 't1', name: 'A-Unit', type: '53ft Audio', status: 'deployed', location: 'New York, NY' },
  { id: 't2', name: 'B-Unit', type: '53ft Video', status: 'deployed', location: 'Los Angeles, CA' },
  { id: 't3', name: 'C-Unit', type: '48ft Lighting', status: 'available', location: 'Warehouse' },
  { id: 't4', name: 'D-Unit', type: '53ft Staging', status: 'maintenance', location: 'Shop' },
  { id: 't5', name: 'E-Unit', type: '28ft Support', status: 'available', location: 'Warehouse' },
  { id: 't6', name: 'F-Unit', type: '53ft Multi', status: 'in_transit', location: 'En route to Chicago' }
];

const TRUCK_ROUTES = [
  { id: 'r1', truck_id: 't1', event_id: 'e1', origin: 'Warehouse, Secaucus NJ', destination: 'SoFi Stadium, Los Angeles CA', waypoints: ['Nashville TN', 'Dallas TX'], distance_miles: 2820, driver: 'Mike D.', status: 'planned' },
  { id: 'r2', truck_id: 't2', event_id: 'e1', origin: 'Burbank CA', destination: 'SoFi Stadium, Los Angeles CA', waypoints: [], distance_miles: 18, driver: null, status: 'completed' },
  { id: 'r3', truck_id: 't1', event_id: 'e2', origin: 'SoFi Stadium', destination: 'State Farm Arena, Atlanta GA', waypoints: ['Phoenix AZ', 'El Paso TX'], distance_miles: 2120, driver: 'Mike D.', status: 'in_progress' },
  { id: 'r4', truck_id: 't5', event_id: 'e5', origin: 'Warehouse', destination: 'Allegiant Stadium, Las Vegas NV', waypoints: ['Barstow CA'], distance_miles: 412, driver: 'TBD', status: 'planned' },
];

const EVENTS = [
  {
    id: 'e1', name: 'Super Bowl LXI Pre-Show', client: 'c1', venue: 'v2',
    phase: 'preproduction', startDate: '2026-02-08', endDate: '2026-02-09',
    budget: 450000, spent: 125000, crew: ['p1', 'p3', 'p5', 'p8'],
    trucks: ['t1', 't2'], priority: 'high'
  },
  {
    id: 'e2', name: 'NBA All-Star Weekend', client: 'c2', venue: 'v6',
    phase: 'production', startDate: '2026-02-14', endDate: '2026-02-16',
    budget: 320000, spent: 215000, crew: ['p3', 'p4', 'p5', 'p6', 'p8'],
    trucks: ['t1', 't3'], priority: 'high'
  },
  {
    id: 'e3', name: 'Taylor Swift - Eras Tour (NYC)', client: 'c3', venue: 'v1',
    phase: 'awarded', startDate: '2026-03-15', endDate: '2026-03-18',
    budget: 580000, spent: 0, crew: [], trucks: [], priority: 'high'
  },
  {
    id: 'e4', name: 'Corporate Gala - Goldman Sachs', client: 'c4', venue: 'v1',
    phase: 'bidding', startDate: '2026-04-02', endDate: '2026-04-02',
    budget: 85000, spent: 0, crew: [], trucks: [], priority: 'medium'
  },
  {
    id: 'e5', name: 'UFC 310 - Championship Night', client: 'c4', venue: 'v4',
    phase: 'live', startDate: '2026-02-17', endDate: '2026-02-17',
    budget: 210000, spent: 198000, crew: ['p1', 'p2', 'p7', 'p11'],
    trucks: ['t5'], priority: 'critical'
  },
  {
    id: 'e6', name: 'Coachella Stage Build', client: 'c5', venue: 'v2',
    phase: 'bidding', startDate: '2026-04-10', endDate: '2026-04-20',
    budget: 780000, spent: 0, crew: [], trucks: [], priority: 'medium'
  },
  {
    id: 'e7', name: 'Chicago Marathon Broadcast', client: 'c2', venue: 'v7',
    phase: 'wrap', startDate: '2026-02-10', endDate: '2026-02-10',
    budget: 145000, spent: 138000, crew: ['p9', 'p11'],
    trucks: ['t6'], priority: 'low'
  },
  {
    id: 'e8', name: 'Grammy Awards 2026', client: 'c1', venue: 'v2',
    phase: 'settled', startDate: '2026-01-28', endDate: '2026-01-29',
    budget: 520000, spent: 498000, crew: [],
    trucks: [], priority: 'high'
  },
  {
    id: 'e9', name: 'NHL Winter Classic', client: 'c2', venue: 'v5',
    phase: 'archived', startDate: '2026-01-01', endDate: '2026-01-02',
    budget: 280000, spent: 265000, crew: [],
    trucks: [], priority: 'medium'
  },
  {
    id: 'e10', name: 'CES Keynote Stage', client: 'c3', venue: 'v4',
    phase: 'settled', startDate: '2026-01-07', endDate: '2026-01-10',
    budget: 195000, spent: 187000, crew: [],
    trucks: [], priority: 'medium'
  },
  {
    id: 'e11', name: 'NCAA Final Four', client: 'c2', venue: 'v3',
    phase: 'preproduction', startDate: '2026-04-04', endDate: '2026-04-06',
    budget: 350000, spent: 45000, crew: ['p4', 'p6'],
    trucks: [], priority: 'high'
  },
  {
    id: 'e12', name: 'Country Music Awards', client: 'c1', venue: 'v6',
    phase: 'bidding', startDate: '2026-05-01', endDate: '2026-05-02',
    budget: 290000, spent: 0, crew: [], trucks: [], priority: 'medium'
  }
];

const TRAVEL_RECORDS = [
  { id: 'tr1', personnel: 'p1', event: 'e5', type: 'flight', from: 'JFK', to: 'LAS', date: '2026-02-16', cost: 380, status: 'booked', airline: 'Delta', flight: 'DL1247' },
  { id: 'tr2', personnel: 'p2', event: 'e5', type: 'flight', from: 'LAX', to: 'LAS', date: '2026-02-16', cost: 180, status: 'booked', airline: 'Southwest', flight: 'WN892' },
  { id: 'tr3', personnel: 'p1', event: 'e5', type: 'hotel', from: 'Bellagio', to: '', date: '2026-02-16', cost: 450, status: 'confirmed', nights: 2 },
  { id: 'tr4', personnel: 'p3', event: 'e2', type: 'self_drive', from: 'Nashville', to: 'Atlanta', date: '2026-02-13', cost: 220, status: 'confirmed', miles: 250 },
  { id: 'tr5', personnel: 'p8', event: 'e2', type: 'flight', from: 'ORD', to: 'ATL', date: '2026-02-13', cost: 290, status: 'booked', airline: 'United', flight: 'UA456' },
  { id: 'tr6', personnel: 'p5', event: 'e1', type: 'flight', from: 'BOS', to: 'LAX', date: '2026-02-06', cost: 420, status: 'pending', airline: 'JetBlue', flight: 'B6890' }
];

const DOCUMENTS = [
  { id: 'doc1', name: 'Super Bowl LXI - Crew Pack', event: 'e1', type: 'crew_pack', format: 'pdf', size: '2.4 MB', updated: '2026-02-14', version: 3 },
  { id: 'doc2', name: 'NBA All-Star - Day Sheet Feb 14', event: 'e2', type: 'day_sheet', format: 'pdf', size: '1.1 MB', updated: '2026-02-13', version: 2 },
  { id: 'doc3', name: 'NBA All-Star - Day Sheet Feb 15', event: 'e2', type: 'day_sheet', format: 'pdf', size: '1.0 MB', updated: '2026-02-13', version: 1 },
  { id: 'doc4', name: 'UFC 310 - Trucking Manifest', event: 'e5', type: 'manifest', format: 'sheet', size: '340 KB', updated: '2026-02-15', version: 1 },
  { id: 'doc5', name: 'UFC 310 - Rooming List', event: 'e5', type: 'rooming_list', format: 'sheet', size: '120 KB', updated: '2026-02-14', version: 2 },
  { id: 'doc6', name: 'Taylor Swift NYC - Client Rider', event: 'e3', type: 'rider', format: 'pdf', size: '5.8 MB', updated: '2026-02-12', version: 1 },
  { id: 'doc7', name: 'Grammy Awards - Final Settlement', event: 'e8', type: 'settlement', format: 'pdf', size: '890 KB', updated: '2026-02-05', version: 1 },
  { id: 'doc8', name: 'Chicago Marathon - Travel Summary', event: 'e7', type: 'travel_summary', format: 'doc', size: '220 KB', updated: '2026-02-11', version: 1 }
];

const EMAIL_TEMPLATES = [
  { id: 'crew-confirm', name: 'Crew Confirmation', context: 'crew', subject: 'You\'re confirmed for {{eventName}}', body: 'Hi,\n\nYou\'re confirmed for {{eventName}}.\n\nDates: {{startDate}} – {{endDate}}\nVenue: {{venueName}}, {{venueCity}}\nCall time: TBD – check the crew pack for details.\n\nPlease confirm receipt.' },
  { id: 'schedule-update', name: 'Schedule Update', context: 'overview', subject: 'Schedule update: {{eventName}}', body: 'Hi everyone,\n\nThere has been a schedule update for {{eventName}} ({{startDate}} – {{endDate}}, {{venueName}}).\n\nPlease check the latest crew pack or day sheet for current call times and locations.\n\nThanks.' },
  { id: 'travel-itinerary', name: 'Travel Itinerary', context: 'travel', subject: 'Travel details for {{eventName}}', body: 'Hi,\n\nHere are your travel details for {{eventName}} ({{startDate}} – {{endDate}}, {{venueName}}).\n\nFlights, hotels, and ground transport are in the travel summary. Check the crew pack for full logistics.\n\nSafe travels.' },
  { id: 'client-update', name: 'Client Update', context: 'overview', subject: 'Update: {{eventName}}', body: 'Hi,\n\nQuick update on {{eventName}} ({{startDate}} – {{endDate}}, {{venueName}}).\n\n[Add your update here.]\n\nBest regards.' },
];

const RIDER_ITEMS = [
  { id: 'ri1', event_id: 'e1', document_id: null, category: 'Audio', description: '64-channel digital console (Yamaha CL5 or equivalent)', quantity: 1, department_id: 'd1', status: 'confirmed', assigned_to: 'p1', notes: '' },
  { id: 'ri2', event_id: 'e1', document_id: null, category: 'Audio', description: 'Wireless mic pack - 24 channels', quantity: 24, department_id: 'd1', status: 'in_progress', assigned_to: 'p2', notes: '' },
  { id: 'ri3', event_id: 'e1', document_id: null, category: 'Video', description: '4K broadcast switcher', quantity: 1, department_id: 'd2', status: 'pending', assigned_to: null, notes: 'Client to confirm model' },
  { id: 'ri4', event_id: 'e2', document_id: null, category: 'Lighting', description: 'Moving head fixtures - 48 units', quantity: 48, department_id: 'd3', status: 'completed', assigned_to: 'p5', notes: '' },
  { id: 'ri5', event_id: 'e2', document_id: null, category: 'Staging', description: 'Main stage 40\' x 24\'', quantity: 1, department_id: 'd4', status: 'confirmed', assigned_to: 'p7', notes: '' },
  { id: 'ri6', event_id: 'e2', document_id: null, category: 'Graphics', description: 'Lower-third templates - network branding', quantity: 1, department_id: 'd6', status: 'pending', assigned_to: null, notes: '' },
  { id: 'ri7', event_id: 'e3', document_id: 'doc6', category: 'Audio', description: 'Orchestra pit mics - 16 channels', quantity: 16, department_id: 'd1', status: 'pending', assigned_to: null, notes: 'From client rider' },
  { id: 'ri8', event_id: 'e3', document_id: 'doc6', category: 'Video', description: 'IMAG screens - 3 positions', quantity: 3, department_id: 'd2', status: 'pending', assigned_to: null, notes: '' },
  { id: 'ri9', event_id: 'e5', document_id: null, category: 'Audio', description: 'RF coordination - 32 wireless', quantity: 32, department_id: 'd1', status: 'completed', assigned_to: 'p2', notes: '' },
  { id: 'ri10', event_id: 'e5', document_id: null, category: 'Rigging', description: 'Truss - 20\' sections x 12', quantity: 12, department_id: 'd7', status: 'completed', assigned_to: 'p10', notes: '' },
];

const INVOICES = [
  { id: 'inv1', number: 'INV-2026-001', event: 'e2', client: 'c2', amount: 125000, status: 'paid', dueDate: '2026-02-01', sentDate: '2026-01-15', lineItems: [{ description: 'Production services - NBA All-Star Weekend', quantity: 1, unitPrice: 125000, total: 125000 }] },
  { id: 'inv2', number: 'INV-2026-002', event: 'e5', client: 'c4', amount: 198000, status: 'sent', dueDate: '2026-02-28', sentDate: '2026-02-10', lineItems: [{ description: 'UFC 310 - Full production', quantity: 1, unitPrice: 198000, total: 198000 }] },
  { id: 'inv3', number: 'INV-2026-003', event: 'e1', client: 'c1', amount: 450000, status: 'overdue', dueDate: '2026-01-15', sentDate: '2026-01-05', lineItems: [{ description: 'Super Bowl LXI Pre-Show - Deposit', quantity: 1, unitPrice: 225000, total: 225000 }, { description: 'Super Bowl LXI Pre-Show - Balance', quantity: 1, unitPrice: 225000, total: 225000 }] },
  { id: 'inv4', number: 'INV-2026-004', event: 'e7', client: 'c2', amount: 145000, status: 'draft', dueDate: '2026-03-15', sentDate: null, lineItems: [{ description: 'Chicago Marathon Broadcast', quantity: 1, unitPrice: 145000, total: 145000 }] },
];

const FINANCIAL_CATEGORIES = [
  { label: 'Labor', key: 'labor', color: 'blue' },
  { label: 'Travel', key: 'travel', color: 'purple' },
  { label: 'Equipment', key: 'equipment', color: 'amber' },
  { label: 'Vendor', key: 'vendor', color: 'green' },
  { label: 'Per Diem', key: 'per_diem', color: 'cyan' },
  { label: 'Other', key: 'other', color: 'red' }
];

const ACTIVITY_LOG = [
  { user: 'Alex Johnson', action: 'advanced', target: 'UFC 310', detail: 'to Live phase', time: '2 min ago', color: '#ef4444' },
  { user: 'Mike Thompson', action: 'confirmed', target: 'flight DL1247', detail: 'JFK → LAS', time: '15 min ago', color: '#3b82f6' },
  { user: 'System', action: 'detected conflict', target: 'Chris Martinez', detail: 'double-booked Feb 14', time: '28 min ago', color: '#ef4444' },
  { user: 'Jake Wilson', action: 'uploaded', target: 'NBA All-Star Day Sheet', detail: 'v2', time: '1 hr ago', color: '#8b5cf6' },
  { user: 'Emma Davis', action: 'updated budget', target: 'NBA All-Star Weekend', detail: '+$12,500 equipment', time: '2 hrs ago', color: '#f59e0b' },
  { user: 'Sarah Lee', action: 'joined crew', target: 'Super Bowl LXI Pre-Show', detail: 'as A2', time: '3 hrs ago', color: '#22c55e' },
  { user: 'Ryan Taylor', action: 'completed', target: 'Stage layout review', detail: 'for UFC 310', time: '4 hrs ago', color: '#06b6d4' },
  { user: 'System', action: 'generated', target: 'Crew Pack', detail: 'for Super Bowl LXI v3', time: '5 hrs ago', color: '#f97316' }
];

function getClient(id) { return CLIENTS.find(c => c.id === id); }
function getVenue(id) { return VENUES.find(v => v.id === id); }
function getPersonnel(id) { return PERSONNEL.find(p => p.id === id); }
function getDepartment(id) { return DEPARTMENTS.find(d => d.id === id); }
function getTruck(id) { return TRUCKS.find(t => t.id === id); }

function getPhaseCount(phase) { return EVENTS.filter(e => e.phase === phase).length; }

function formatCurrency(n) {
  return '$' + n.toLocaleString('en-US');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
