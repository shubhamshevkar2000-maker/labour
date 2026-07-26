import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.resolve(__dirname, '../../database/labourlink_db.json');

const SKILLS = [
  'plumber', 'electrician', 'mason', 'painter', 'carpenter',
  'welder', 'helper', 'tile worker', 'pop worker', 'steel fixer'
];

const NAMES = [
  'Ramesh Prasad', 'Suresh Kumar', 'Akash Verma', 'Imran Khan', 'Vikas Singh',
  'Deepak Sharma', 'Sunil Yadav', 'Rajesh Gupta', 'Manoj Kumar', 'Vijay Carpenter',
  'Pankaj Welder', 'Santosh Helper', 'Anil Tile Worker', 'Dinesh POP Worker', 'Rakesh Steel Fixer',
  'Gopal Plumber', 'Mahesh Electrician', 'Kishan Mason', 'Sanjay Painter', 'Babu Lal',
  'Ravi Kumar', 'Sonu Singh', 'Amit Carpenter', 'Rohit Welder', 'Vishal Plumber',
  'Vikram Electrician', 'Sachin Mason', 'Arun Painter', 'Kunal Helper', 'Rahul Tile Worker',
  'Nitin POP Worker', 'Mohit Steel Fixer', 'Praveen Plumber', 'Naveen Electrician', 'Mukesh Mason',
  'Dharmendra Painter', 'Lokesh Carpenter', 'Ashok Welder'
];

const CUSTOMER_NAMES = [
  'Amit Roy', 'Vijay Patel', 'Priya Sharma', 'Ananya Deshmukh', 'Rajesh Malhotra',
  'Sunita Rao', 'Kavita Nair', 'Sanjay Kapoor', 'Neha Gupta', 'Rohan Mehta',
  'Divya Agarwal', 'Alok Verma'
];

export function seedExpandedData() {
  if (!fs.existsSync(dbPath)) return;
  const raw = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(raw);

  console.log('Seeding expanded 38 workers and 12 customers into database...');

  // Ensure 12 Customers
  db.users = db.users || [];
  db.customer_profiles = db.customer_profiles || [];
  db.worker_profiles = db.worker_profiles || [];
  db.verification_records = db.verification_records || [];
  db.ratings = db.ratings || [];

  CUSTOMER_NAMES.forEach((cName, idx) => {
    const existing = db.users.find((u: any) => u.full_name === cName && u.role === 'CUSTOMER');
    if (!existing) {
      const uId = uuidv4();
      const cpId = uuidv4();
      const phone = `9000000${101 + idx}`;
      const email = `${cName.toLowerCase().replace(/\s+/g, '.')}@labourlink.com`;

      db.users.push({
        id: uId,
        role: 'CUSTOMER',
        full_name: cName,
        phone,
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      db.customer_profiles.push({
        id: cpId,
        user_id: uId,
        home_address: 'Connaught Place, Delhi',
        home_lat: 28.6139 + (Math.random() - 0.5) * 0.1,
        home_lng: 77.209 + (Math.random() - 0.5) * 0.1,
        preferred_language: 'en',
        created_at: new Date().toISOString()
      });
    }
  });

  // Create 38 Workers across 10 skills
  NAMES.forEach((wName, idx) => {
    const skillName = SKILLS[idx % SKILLS.length];
    const existingUser = db.users.find((u: any) => u.full_name === wName && u.role === 'WORKER');

    let uId = existingUser ? existingUser.id : uuidv4();
    if (!existingUser) {
      const phone = `8000000${String(idx + 1).padStart(3, '0')}`;
      const email = `${wName.toLowerCase().replace(/\s+/g, '.')}@labourlink.com`;

      db.users.push({
        id: uId,
        role: 'WORKER',
        full_name: wName,
        phone,
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const existingWp = db.worker_profiles.find((w: any) => w.user_id === uId);
    if (!existingWp) {
      const wpId = uuidv4();
      const trustScore = 75 + Math.floor(Math.random() * 24);
      db.worker_profiles.push({
        id: wpId,
        user_id: uId,
        skills: JSON.stringify([skillName, 'helper']),
        home_lat: 28.6139 + (Math.random() - 0.5) * 0.15,
        home_lng: 77.209 + (Math.random() - 0.5) * 0.15,
        current_lat: 28.6139 + (Math.random() - 0.5) * 0.15,
        current_lng: 77.209 + (Math.random() - 0.5) * 0.15,
        availability_status: idx % 4 === 0 ? 'BUSY' : 'AVAILABLE',
        verification_status: 'VERIFIED',
        trust_score: trustScore,
        trust_score_updated_at: new Date().toISOString(),
        trust_score_version: 1,
        created_at: new Date(Date.now() - (idx + 1) * 30 * 24 * 3600 * 1000).toISOString()
      });

      // Verification Record
      db.verification_records.push({
        id: uuidv4(),
        worker_id: wpId,
        type: 'ID_DOCUMENT',
        status: 'VERIFIED',
        evidence_url: 'https://labourlink.s3.amazonaws.com/docs/aadhaar_verified.jpg',
        created_at: new Date().toISOString()
      });

      // Seed a 5 star rating
      const randomCust = db.customer_profiles[Math.floor(Math.random() * db.customer_profiles.length)];
      if (randomCust) {
        db.ratings.push({
          id: uuidv4(),
          job_reference_type: 'CUSTOMER_BOOKING',
          job_reference_id: uuidv4(),
          rater_id: randomCust.user_id,
          ratee_id: uId,
          score: 4.5 + Math.round(Math.random() * 5) / 10,
          comment: `Excellent ${skillName} work! Arrived on time and completed neatly.`,
          created_at: new Date().toISOString()
        });
      }
    }
  });

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Seed expansion complete! Total users:', db.users.length, 'Total workers:', db.worker_profiles.length);
}

if (require.main === module) {
  seedExpandedData();
}
