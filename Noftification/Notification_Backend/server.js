require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Message Broker Storage Queue (Acts as our event log history topic)
const messageBrokerQueue = [];

// Middlewares to simulate asynchronous ingestion broker logs
const brokerIngestLog = (req, res, next) => {
    console.log(`[MESSAGE BROKER] Ingesting message stream topic: ${req.method} on ${req.url}`);
    next();
};
app.use(brokerIngestLog);

/**
 * TOPIC EXPOSURE: PUBLISH ALERTS
 * Other microservices (Inventory, Comms) POST messages here to publish events
 */
app.post('/api/notifications/publish', (req, res) => {
    const { message, priority, source } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Broker message body content cannot be empty." });
    }

    const eventPayload = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        message,
        priority: priority || 'INFO',
        source: source || 'UNKNOWN_SERVICE',
        timestamp: new Date()
    };

    // Push into message queue loop pipeline
    messageBrokerQueue.unshift(eventPayload);
    
    // Cap event cache log length to avoid container memory overflows
    if (messageBrokerQueue.length > 100) messageBrokerQueue.pop();

    console.log(`[BROKER SUCCESS] Dispatched event topic ID: ${eventPayload.id} [${eventPayload.priority}]`);
    
    // Acknowledge receipt instantly (Asynchronous fire-and-forget Broker pattern)
    res.status(202).json({ status: "PUBLISHED", eventId: eventPayload.id });
});

/**
 * TOPIC EXPOSURE: CONSUME HISTORY
 * Frontends pull from this endpoint to consume the message logs
 */
app.get('/api/notifications/history', (req, res) => {
    // Returns the current state of the message queue
    res.status(200).json(messageBrokerQueue);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "UP", queueSize: messageBrokerQueue.length });
});

const PORT = process.env.PORT || 8020;
app.listen(PORT, () => {
    console.log(`📟 Notification Message Broker Brokerage Engine active on port ${PORT}`);
});