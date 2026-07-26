import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.resolve(__dirname, '../../database/labourlink_db.json');

const WORKERS_DATA = [
  { name: 'Ramesh Patel', skill: 'plumber', email: 'ramesh@labourlink.com', phone: '8000000001', trust: 95, rating: 4.9, exp: '8 Years', jobs: 124, resp: '~10 mins', verified: '2023', lat: 28.6139, lng: 77.2090 },
  { name: 'Suresh Yadav', skill: 'electrician', email: 'suresh@labourlink.com', phone: '8000000002', trust: 92, rating: 4.8, exp: '6 Years', jobs: 98, resp: '~12 mins', verified: '2023', lat: 28.5355, lng: 77.3910 },
  { name: 'Mahesh Sharma', skill: 'carpenter', email: 'mahesh@labourlink.com', phone: '8000000003', trust: 89, rating: 4.7, exp: '7 Years', jobs: 86, resp: '~15 mins', verified: '2024', lat: 28.7041, lng: 77.1025 },
  { name: 'Ajay Verma', skill: 'mason', email: 'ajay@labourlink.com', phone: '8000000004', trust: 94, rating: 4.9, exp: '10 Years', jobs: 142, resp: '~8 mins', verified: '2023', lat: 28.4595, lng: 77.0266 },
  { name: 'Deepak Singh', skill: 'painter', email: 'deepak@labourlink.com', phone: '8000000005', trust: 88, rating: 4.6, exp: '5 Years', jobs: 64, resp: '~18 mins', verified: '2024', lat: 28.6500, lng: 77.2300 },
  { name: 'Vikram Jadhav', skill: 'welder', email: 'vikram@labourlink.com', phone: '8000000006', trust: 91, rating: 4.8, exp: '6 Years', jobs: 78, resp: '~14 mins', verified: '2023', lat: 28.5800, lng: 77.2200 },
  { name: 'Rahul Pawar', skill: 'tile worker', email: 'rahul@labourlink.com', phone: '8000000007', trust: 87, rating: 4.5, exp: '4 Years', jobs: 52, resp: '~20 mins', verified: '2024', lat: 28.6200, lng: 77.1500 },
  { name: 'Naresh Kumar', skill: 'pop worker', email: 'naresh@labourlink.com', phone: '8000000008', trust: 90, rating: 4.7, exp: '5 Years', jobs: 60, resp: '~15 mins', verified: '2024', lat: 28.6300, lng: 77.2800 },
  { name: 'Ganesh Shinde', skill: 'steel fixer', email: 'ganesh@labourlink.com', phone: '8000000009', trust: 93, rating: 4.8, exp: '9 Years', jobs: 110, resp: '~10 mins', verified: '2023', lat: 28.5000, lng: 77.0800 },
  { name: 'Imran Sheikh', skill: 'helper', email: 'imran@labourlink.com', phone: '8000000010', trust: 86, rating: 4.5, exp: '3 Years', jobs: 44, resp: '~22 mins', verified: '2024', lat: 28.6800, lng: 77.1800 },
  { name: 'Prakash More', skill: 'plumber', email: 'prakash@labourlink.com', phone: '8000000011', trust: 96, rating: 5.0, exp: '11 Years', jobs: 180, resp: '~5 mins', verified: '2023', lat: 28.6100, lng: 77.2100 },
  { name: 'Amit Chavan', skill: 'electrician', email: 'amitchavan@labourlink.com', phone: '8000000012', trust: 90, rating: 4.7, exp: '5 Years', jobs: 72, resp: '~12 mins', verified: '2024', lat: 28.5500, lng: 77.2500 }
];

const CUSTOMERS_DATA = [
  { name: 'Amit Roy', email: 'amit.roy@labourlink.com', phone: '9000000101' },
  { name: 'Vijay Patel', email: 'vijay.patel@labourlink.com', phone: '9000000102' },
  { name: 'Priya Sharma', email: 'priya.sharma@labourlink.com', phone: '9000000103' },
  { name: 'Ananya Deshmukh', email: 'ananya.deshmukh@labourlink.com', phone: '9000000104' },
  { name: 'Rajesh Malhotra', email: 'rajesh.malhotra@labourlink.com', phone: '9000000105' },
  { name: 'Sunita Rao', email: 'sunita.rao@labourlink.com', phone: '9000000106' },
  { name: 'Kavita Nair', email: 'kavita.nair@labourlink.com', phone: '9000000107' },
  { name: 'Sanjay Kapoor', email: 'sanjay.kapoor@labourlink.com', phone: '9000000108' },
  { name: 'Neha Gupta', email: 'neha.gupta@labourlink.com', phone: '9000000109' },
  { name: 'Rohan Mehta', email: 'rohan.mehta@labourlink.com', phone: '9000000110' }
];

export function seedCleanFreshWorkers() {
  if (!fs.existsSync(dbPath)) return;
  const raw = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(raw);

  console.log('Cleaning old worker accounts and seeding 12 fresh aligned workers...');

  // Retain non-worker users (Admin, Customers, Contractors)
  db.users = (db.users || []).filter((u: any) => u.role !== 'WORKER');
  db.worker_profiles = [];
  db.verification_records = [];
  db.ratings = [];

  // Ensure Customers exist
  CUSTOMERS_DATA.forEach(c => {
    let existingCust = db.users.find((u: any) => u.email === c.email);
    if (!existingCust) {
      const uId = uuidv4();
      db.users.push({
        id: uId,
        role: 'CUSTOMER',
        full_name: c.name,
        phone: c.phone,
        email: c.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      db.customer_profiles.push({
        id: uuidv4(),
        user_id: uId,
        home_address: 'Connaught Place, Delhi',
        home_lat: 28.6139,
        home_lng: 77.2090,
        preferred_language: 'en',
        created_at: new Date().toISOString()
      });
    }
  });

  // Seed 12 Fresh Aligned Workers
  WORKERS_DATA.forEach(w => {
    const uId = uuidv4();
    const wpId = uuidv4();

    // User account
    db.users.push({
      id: uId,
      role: 'WORKER',
      full_name: w.name,
      phone: w.phone,
      email: w.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Worker Profile
    db.worker_profiles.push({
      id: wpId,
      user_id: uId,
      skills: JSON.stringify([w.skill, 'helper']),
      home_lat: w.lat,
      home_lng: w.lng,
      current_lat: w.lat,
      current_lng: w.lng,
      availability_status: 'AVAILABLE',
      verification_status: 'VERIFIED',
      trust_score: w.trust,
      trust_score_updated_at: new Date().toISOString(),
      trust_score_version: 1,
      experience_years: w.exp,
      jobs_completed_count: w.jobs,
      avg_response_time: w.resp,
      verified_since: w.verified,
      created_at: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString()
    });

    // Verification Record (Aadhaar Verified)
    db.verification_records.push({
      id: uuidv4(),
      worker_id: wpId,
      type: 'ID_DOCUMENT',
      status: 'VERIFIED',
      evidence_url: 'https://labourlink.s3.amazonaws.com/docs/aadhaar_verified.jpg',
      created_at: new Date().toISOString()
    });

    // Seed realistic star rating
    const firstCust = db.customer_profiles[0];
    if (firstCust) {
      db.ratings.push({
        id: uuidv4(),
        job_reference_type: 'CUSTOMER_BOOKING',
        job_reference_id: uuidv4(),
        rater_id: firstCust.user_id,
        ratee_id: uId,
        score: w.rating,
        comment: `Excellent ${w.skill} work! Professional and highly skilled.`,
        created_at: new Date().toISOString()
      });
    }
  });

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Successfully seeded 12 clean workers! Total users: ${db.users.length}, Total workers: ${db.worker_profiles.length}`);
}

if (require.main === module) {
  seedCleanFreshWorkers();
}
