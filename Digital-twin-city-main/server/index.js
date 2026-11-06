const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

// Mock data for utilities (Electricity, Water, Gas)
// Usually this would come from PostGIS
const utilities = {
  electricityLines: [
    // Mock GeoJSON-like structure
  ],
  waterPipes: [],
  gasLines: []
};

// In-memory persistent database for civic complaints
let citizenComplaints = [
  {
    id: 101,
    title: 'Broken Streetlight & Dark Corridor',
    category: 'Streetlighting',
    description: 'Streetlight pole broken near junction, creating a hazardous blindspot at night.',
    status: 'solved', // 'pending', 'in_progress', 'solved'
    coordinates: [76.6534, 12.3082],
    locationName: 'Devaraja Urs Road Junction',
    date: '2026-10-20 09:30 AM',
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400&q=80',
    officialNote: 'Muni maintenance unit replaced bulb & rewired transformer.'
  },
  {
    id: 102,
    title: 'Hazardous Deep Pothole on Highway Turn',
    category: 'Roads & Infrastructure',
    description: 'Deep trench-like pothole causing vehicle wheel damage and 2-wheeler skids.',
    status: 'in_progress',
    coordinates: [76.6450, 12.3160],
    locationName: 'Jhansi Lakshmi Bai Rd, Subbarayanakere',
    date: '2026-10-21 04:15 PM',
    image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=400&q=80',
    officialNote: 'Asphalt cold-patch dispatched by PWD Ward 7 team.'
  },
  {
    id: 103,
    title: 'Water Main Pipeline Leakage',
    category: 'Water & Utilities',
    description: 'High pressure drinking water pipe ruptured and flooding the pedestrian walkway.',
    status: 'pending',
    coordinates: [76.6380, 12.3015],
    locationName: 'Chamarajapuram 4th Main',
    date: '2026-10-22 06:10 AM',
    image: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=400&q=80',
    officialNote: 'Awaiting Mysuru City Corporation water board inspection.'
  }
];

// Civic Complaints API Endpoints
app.get('/api/complaints', (req, res) => {
  res.json(citizenComplaints);
});

app.post('/api/complaints', (req, res) => {
  const { title, category, description, coordinates, image, locationName } = req.body;
  if (!title || !coordinates) {
    return res.status(400).json({ error: 'Title and coordinates are required.' });
  }

  const newComplaint = {
    id: Date.now(),
    title: title.trim(),
    category: category || 'Roads & Infrastructure',
    description: description || '',
    status: 'pending',
    coordinates, // [lng, lat]
    locationName: locationName || `Mysuru Sector (${coordinates[1].toFixed(4)}°N, ${coordinates[0].toFixed(4)}°E)`,
    date: new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    image: image || '',
    officialNote: 'Assigned to Ward Grievance Response Desk.'
  };

  citizenComplaints.unshift(newComplaint);
  console.log(`[Civic Complaints] New complaint recorded #${newComplaint.id} at [${coordinates.join(', ')}]`);
  res.status(201).json(newComplaint);
});

app.patch('/api/complaints/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, officialNote } = req.body;

  const complaint = citizenComplaints.find(c => c.id == id);
  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found.' });
  }

  if (status) complaint.status = status;
  if (officialNote) complaint.officialNote = officialNote;

  console.log(`[Civic Complaints] Updated #${id} status to ${status}`);
  res.json(complaint);
});

const distPath = path.join(__dirname, '../client/dist');
console.log(`Serving static files from: ${distPath}`);
app.use(express.static(distPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Digital Twin Integrated Command listening at http://localhost:${port}`);
});
