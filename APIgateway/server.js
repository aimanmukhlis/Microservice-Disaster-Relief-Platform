// index.js (API Gateway Microservice)
const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// 1. DYNAMIC GLOBAL CORS CONFIGURATION 
// Allows ALL frontends in your ecosystem to pass authorization contexts safely
const ALLOWED_ORIGINS = [
    'http://localhost:3010', // Auth UI
    'http://localhost:5010', // Reporting UI
    'http://localhost:6010', // Comms UI
    'http://localhost:7010', // Inventory UI
    'http://localhost:9010'  // Volunteer UI
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('CORS Policy Block: Origin not explicitly whitelisted.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Added PATCH for reporting updates
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Global traffic logging middleware
app.use((req, res, next) => {
    console.log(`[API GATEWAY] ${req.method} request intercepted routing to: ${req.url}`);
    next();
});

// =========================================================================
// ROUTING TABLES (Proxying traffic internally through disaster-relief-net)
// =========================================================================

// 🔐 ROUTE 1: Authentication Engine (Port 3020)
app.use('/api/login', proxy(process.env.AUTH_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/login${req.url}`
}));
app.use('/api/register', proxy(process.env.AUTH_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/register${req.url}`
}));

// 📊 ROUTE 2: Reporting Microservice (Port 5020)
app.use('/api/reports', proxy(process.env.REPORTING_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/reports${req.url}`
}));

// 📦 ROUTE 3: Admin & Public Inventory Systems (Port 7020)
app.use('/api/resources', proxy(process.env.RESOURCE_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/v1/admin${req.url}`
}));
app.use('/api/v1/public/inventory', proxy(process.env.RESOURCE_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/v1/public/inventory${req.url}`
}));

// 💬 ROUTE 4: Communication Microservice Logs (Port 6020)
app.use('/api/communications', proxy(process.env.COMMUNICATION_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/v1/communication${req.url}`
}));

// 🪪 ROUTE 5: Volunteer Portal Engine (Port 9020)
app.use('/api/v1/volunteers', proxy(process.env.VOLUNTEER_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/v1/volunteers${req.url}`
}));

// 🔔 ROUTE 6: Message Broker Pipeline for Notification Stream (Port 8020)
app.use('/api/notifications', proxy(process.env.NOTIFICATION_SERVICE_URL, {
    proxyReqPathResolver: (req) => `/api/notifications${req.url}`
}));

// =========================================================================

// Base health check path to ensure the gateway container is alive
app.get('/health', (req, res) => {
    res.status(200).json({ status: "UP", gateway: "Operational" });
});

app.listen(PORT, () => {
    console.log(`🚀 Central API Gateway microservice routing table online on port ${PORT}`);
});