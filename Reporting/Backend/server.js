// index.js (Reporting Microservice)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to bypass local ISP blocks inside Docker
dns.setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const port = process.env.PORT || 5020;

app.use(cors());
app.use(express.json());

// Pull database string configuration from environment or use local cluster fallback
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://s74824_db_user:Ky6VdH5cVvay6wXa@cluster0.phluhfs.mongodb.net/?appName=Cluster0'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('📊 Reporting Service connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

const BROKER_URL = 'http://notification-app:8020/api/notifications/publish';

/**
 * Helper function to safely dispatch incidents and updates to the central Message Broker
 */
async function publishSystemAlert(message, priority = 'INFO') {
    try {
        await fetch(BROKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                priority,
                source: 'REPORTING_SERVICE'
            })
        });
        console.log(`[BROKER] Dispatched incident alert event log: "${message}"`);
    } catch (error) {
        console.error(`[BROKER ERROR] Could not stream logs to message broker:`, error.message);
    }
}

// --- MONGO SCHEMA ---
const reportSchema = new mongoose.Schema({
    type: String,
    location: String,
    riskLevel: String,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);


// --- API ENDPOINTS (ALL PUBLIC) ---

// 1. Submit a new report 
app.post('/api/reports', async (req, res) => {
    try {
        const newReport = new Report(req.body);
        await newReport.save(); 

        // 🔥 PUBLISH INCIDENT REPORT DISPATCH TO MESSAGE BROKER
        const priorityLevel = (newReport.riskLevel === 'High') ? 'HIGH' : 'INFO';
        publishSystemAlert(`NEW INCIDENT LOGGED: [${newReport.type}] reported at location [${newReport.location}] with ${newReport.riskLevel} threat context.`, priorityLevel);

        res.status(201).json({ 
            message: 'Report submitted successfully', 
            reportId: newReport._id 
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 2. Get all reports (With Prioritization Engine)
app.get('/api/reports', async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 }); 
        
        const riskWeights = { 'High': 3, 'Medium': 2, 'Low': 1 };
        reports.sort((a, b) => (riskWeights[b.riskLevel] || 0) - (riskWeights[a.riskLevel] || 0));

        res.json({
            message: 'success',
            data: reports
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Update report status
app.patch('/api/reports/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedReport = await Report.findByIdAndUpdate(req.params.id, { status: status }, { new: true });
        
        if (!updatedReport) {
            return res.status(404).json({ error: "Incident report file matching target ID not found." });
        }

        // 🔥 PUBLISH INCIDENT RECOVERY UPDATE TO MESSAGE BROKER
        publishSystemAlert(`Incident Lifecycle Update: Report file [${updatedReport.type}] at [${updatedReport.location}] transitioned status condition to [${status}].`, 'INFO');

        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Reporting Service backend running on port ${port}`);
});