const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json()); // Middleware to parse incoming JSON payloads

const PORT = process.env.PORT || 8020;

// Setup the mock email transporter (Mocking an external channel provider)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * POST /api/notifications/send
 * Triggered internally by Reporting Service or Communication Service
 */
app.post('/api/notifications/send', async (req, res) => {
    const { type, recipient, message, priority } = req.body;

    // 1. Basic validation
    if (!recipient || !message || !type) {
        return res.status(400).json({ error: 'Missing required fields: type, recipient, or message.' });
    }

    try {
        console.log(`[Notification Service] Processing ${priority || 'NORMAL'} priority ${type} alert...`);

        // 2. Route alert to the appropriate external channel
        if (type === 'EMAIL') {
            await transporter.sendMail({
                from: '"Disaster Relief Platform" <alerts@disaster-relief.gov.my>',
                to: recipient,
                subject: priority === 'HIGH' ? '🚨 CRITICAL EMERGENCY ALERT' : 'Platform Notification',
                text: message
            });
            console.log(`[Notification Service] Email successfully sent to ${recipient}`);
        } 
        
        else if (type === 'SMS') {
            // Mocking an external SMS Gateway API dispatch (e.g., Twilio)
            console.log(`[SMS Gateway Redirect] Blasting text to ${recipient}: "${message}"`);
        }

        // 3. Stateless confirmation response sent back to the triggering service
        return res.status(200).json({
            status: 'SUCCESS',
            message: `Notification successfully dispatched via ${type}.`
        });

    } catch (error) {
        console.error('[Notification Service Error]:', error.message);
        return res.status(500).json({ error: 'Failed to dispatch notification to external channel.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Stateless Notification Backend running on port ${PORT}`);
});