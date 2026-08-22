// 'Request' aur 'Response' ke aage 'type' lagana zaroori hai modern TypeScript mein
import express, { type Request, type Response } from 'express';

const app = express();
const PORT = 3000;

// Middleware to parse JSON payloads
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ 
        status: "success", 
        message: "System operational. TraceLens API is running.",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`[Server]: API is running at http://localhost:${PORT}`);
});