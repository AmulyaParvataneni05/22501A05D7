const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const cors = require('cors');
const app = express();
const PORT = 5000;
const urlDatabase = './urls.json';

if (!fs.existsSync(urlDatabase)) {
    fs.writeFileSync(urlDatabase, JSON.stringify([]));
}

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.static('public'));

function generateShortcode() {
    return crypto.randomBytes(3).toString('hex');
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

app.post('/api/shorten', (req, res) => {
    const { url, validity = 30, shortcode } = req.body;

    if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'Invalid URL' });
    if (isNaN(validity) || validity <= 0) return res.status(400).json({ error: 'Validity must be a positive integer' });

    const expiryDate = new Date(Date.now() + validity * 60000).toISOString();
    const shortUrl = shortcode || generateShortcode();
    const newUrl = {
        url,
        shortcode: shortUrl,
        createdDate: new Date().toISOString(),
        expiryDate,
        clicks: []
    };

    fs.readFile(urlDatabase, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch URL data' });

        let urls = [];
        try {
            urls = JSON.parse(data);
        } catch (parseErr) {
            return res.status(500).json({ error: 'Invalid URL data' });
        }

        if (urls.some(u => u.shortcode === shortUrl)) {
            return res.status(400).json({ error: 'Shortcode must be unique' });
        }

        urls.push(newUrl);
        fs.writeFile(urlDatabase, JSON.stringify(urls, null, 2), (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save URL data' });

            res.status(200).json({
                shortlink: `http://localhost:${PORT}/${shortUrl}`,
                expiry: expiryDate
            });
        });
    });
});

app.get('/api/statistics/:shortcode', (req, res) => {
    const { shortcode } = req.params;

    fs.readFile(urlDatabase, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch URL data' });

        let urls = [];
        try {
            urls = JSON.parse(data);
        } catch (parseErr) {
            return res.status(500).json({ error: 'Invalid URL data' });
        }

        const urlEntry = urls.find(u => u.shortcode === shortcode);
        if (!urlEntry) {
            return res.status(404).json({ error: 'URL not found' });
        }

        res.status(200).json(urlEntry);
    });
});

app.get('/:shortcode', (req, res) => {
    const { shortcode } = req.params;

    fs.readFile(urlDatabase, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch URL data' });

        let urls = [];
        try {
            urls = JSON.parse(data);
        } catch (parseErr) {
            return res.status(500).json({ error: 'Invalid URL data' });
        }

        const urlEntry = urls.find(u => u.shortcode === shortcode);
        if (!urlEntry) return res.status(404).json({ error: 'Short URL not found' });

        const clickData = {
            timestamp: new Date().toISOString(),
            source: req.headers.referer || 'direct',
            geo: geoip.lookup(req.ip)
        };
        urlEntry.clicks.push(clickData);

        if (!isValidUrl(urlEntry.url)) {
            return res.status(400).json({ error: 'Invalid redirect URL' });
        }

        fs.writeFile(urlDatabase, JSON.stringify(urls, null, 2), (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save click data' });
            res.redirect(urlEntry.url);
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
