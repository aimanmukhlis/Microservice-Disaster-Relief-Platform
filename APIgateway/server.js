const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// 1. GLOBAL CORS CONFIGURATION - Handles port 7010 requests for ALL downstream services
app.use(cors({
    origin: 'http://localhost:7010',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logger middleware to track incoming traffic through the entry point
app.use((req, res, next) => {
    console.log(`[API GATEWAY] ${req.method} request intercepted routing to: ${req.url}`);
    next();
});

// 2. ROUTING RULE 1: Forward inventory traffic to the Resource Management Service (Port 7020)
app.use('/api/resources', proxy(process.env.RESOURCE_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
        return `/api/v1/admin${req.url}`;
    }
}));

// 3. ROUTING RULE 2: Forward emergency triggers to the Notification Engine (Port 8020)
app.use('/api/notifications', proxy(process.env.NOTIFICATION_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
        return `/api/notifications${req.url}`;
    }
}));

// 4. ROUTING RULE 3: Forward PUBLIC inventory requests to Resource Management Service
app.use('/api/v1/public/inventory', proxy(process.env.RESOURCE_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
        // This takes the incoming request and passes it perfectly to the backend
        return `/api/v1/public/inventory${req.url}`;
    }
}));

// Base health check path to ensure the gateway container is alive
app.get('/health', (req, res) => {
    res.status(200).json({ status: "UP", gateway: "Operational" });
});

app.listen(PORT, () => {
    console.log(`🚀 Central API Gateway microservice routing table online on port ${PORT}`);
});