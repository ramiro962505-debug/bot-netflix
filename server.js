const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio Chromium activo' });
});

app.post('/extraer-temporal', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

        await page.waitForFunction(() => {
            const text = document.body.innerText;
            return /(?<!\d)[0-9]{4}(?!\d)/.test(text);
        }, { timeout: 15000 });

        const codigo = await page.evaluate(() => {
            const matches = document.body.innerText.match(/(?<!\d)[0-9]{4}(?!\d)/g);
            if (!matches) return null;
            return matches.find(n => !['2024', '2025', '2026', '2027', '0000'].includes(n)) || null;
        });

        await browser.close();

        if (codigo) {
            return res.json({ status: 'success', codigo: codigo });
        } else {
            return res.status(404).json({ status: 'error', message: 'No se visualizó código numérico' });
        }
    } catch (err) {
        if (browser) await browser.close();
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
