// Configuration constants — declare all before use
const API_BASE = "https://dental-production-a97a.up.railway.app";

const APP_VERSION = '0.1.0';

const ROLE_PERMISSIONS = {
  admin: ['dashboard','patients','appointments','pharmacy','prescriptions','billing','staff','settings','treatment-plans','xrays'],
  dentist: ['dashboard','patients','appointments','dental-chart','medical-records','prescriptions','settings','treatment-plans','xrays'],
  receptionist: ['dashboard','patients','appointments','billing','settings','treatment-plans','xrays'],
  pharmacist: ['dashboard','pharmacy','prescriptions','settings'],
  assistant: ['dashboard','patients','appointments','medical-records','settings','xrays'],
  patient: ['patient-home','patient-appointments','patient-record','patient-billing','patient-treatment-plans','patient-xrays','settings']
};

const NAV_CONFIG = [
  {id:'dashboard',label:'Dashboard',icon:''},
  {id:'treatment-plans',label:'Treatment Plans',icon:''},
  {id:'patients',label:'Patients',icon:''},
  {id:'appointments',label:'Appointments',icon:''},
  {id:'dental-chart',label:'Dental Chart',icon:''},
  {id:'medical-records',label:'Medical Records',icon:''},
  {id:'prescriptions',label:'Prescriptions',icon:''},
  {id:'pharmacy',label:'Pharmacy',icon:''},
  {id:'billing',label:'Billing',icon:''},
  {id:'xrays',label:'X-Rays',icon:''},
  {id:'patient-treatment-plans',label:'My Treatment Plans',icon:''},
  {id:'patient-xrays',label:'My X-Rays',icon:''},
  {id:'patient-home',label:'My Dashboard',icon:''},
  {id:'patient-appointments',label:'My Appointments',icon:''},
  {id:'patient-record',label:'My Record',icon:''},
  {id:'patient-billing',label:'My Bills',icon:''},
  {id:'staff',label:'Staff',icon:''},
  {id:'settings',label:'Settings',icon:''}
];

const PAGE_TITLES = {
  'dashboard':'Dashboard',
  'patients':'Patients',
  'appointments':'Appointments',
  'dental-chart':'Dental Chart',
  'medical-records':'Medical Records',
  'prescriptions':'Prescriptions',
  'pharmacy':'Pharmacy',
  'billing':'Billing',
  'staff':'Staff',
  'treatment-plans':'Treatment Plans',
  'xrays':'X-Rays',
  'patient-treatment-plans':'My Treatment Plans',
  'patient-xrays':'My X-Rays',
  'settings':'Settings',
  'patient-home':'My Dashboard',
  'patient-appointments':'My Appointments',
  'patient-record':'My Record',
  'patient-billing':'My Bills'
};

const STATUS_BADGES = {
  healthy: {class:'healthy',label:'Healthy'},
  cavity: {class:'cavity',label:'Cavity'},
  filling: {class:'filling',label:'Filling'},
  crown: {class:'crown',label:'Crown'},
  'root-canal': {class:'root-canal',label:'Root Canal'},
  implant: {class:'implant',label:'Implant'},
  extraction: {class:'extraction',label:'Extraction'}
};
