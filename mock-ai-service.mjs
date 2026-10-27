import http from 'node:http';

const PORT = 8787;

// Memory store to track attempt count per enquiryId
// Format: { [enquiryId]: number_of_attempts }
const attemptsMap = new Map();

const server = http.createServer(async (req, res) => {
  // Set CORS and JSON response headers
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && req.url === '/categorize') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { enquiryId, message } = JSON.parse(body || '{}');

        if (!enquiryId || !message) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'enquiryId and message are required' }));
        }

        // Track how many times this enquiry has called the mock service
        const attempts = (attemptsMap.get(enquiryId) || 0) + 1;
        attemptsMap.set(enquiryId, attempts);

        const lowerMessage = message.toLowerCase();

        // 1. Temporary Failure Test Case: [FAIL_ONCE]
        // First attempt returns HTTP 503; Retry returns "Billing"
        if (message.includes('[FAIL_ONCE]')) {
          if (attempts === 1) {
            res.writeHead(503);
            return res.end(JSON.stringify({ error: 'Service Temporarily Unavailable (mock 503)' }));
          }
          res.writeHead(200);
          return res.end(JSON.stringify({ category: 'Billing' }));
        }

        // 2. Invalid AI Output Test Case: [INVALID_ONCE]
        // First attempt returns "Unexpected"; Retry returns "Support"
        if (message.includes('[INVALID_ONCE]')) {
          if (attempts === 1) {
            res.writeHead(200);
            return res.end(JSON.stringify({ category: 'Unexpected' }));
          }
          res.writeHead(200);
          return res.end(JSON.stringify({ category: 'Support' }));
        }

        // 3. Normal categorization based on keywords
        let category = 'Other';
        if (lowerMessage.includes('price') || lowerMessage.includes('pricing') || lowerMessage.includes('sales') || lowerMessage.includes('quote') || lowerMessage.includes('automation')) {
          category = 'Sales';
        } else if (lowerMessage.includes('bill') || lowerMessage.includes('invoice') || lowerMessage.includes('payment') || lowerMessage.includes('refund')) {
          category = 'Billing';
        } else if (lowerMessage.includes('help') || lowerMessage.includes('broken') || lowerMessage.includes('login') || lowerMessage.includes('bug') || lowerMessage.includes('support')) {
          category = 'Support';
        }

        res.writeHead(200);
        return res.end(JSON.stringify({ category }));
      } catch (err) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock AI Service running at http://127.0.0.1:${PORT}`);
});
