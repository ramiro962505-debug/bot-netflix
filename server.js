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

    console.log(`[+] Procesando URL: ${url}`);
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // 1. Si hay botón de "Obtener código" / "Continuar", hacer clic
        try {
            await page.evaluate(() => {
                const elementos = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                for (let el of elementos) {
                    const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                    if (txt.includes('obtener código') || txt.includes('get code') || txt.includes('enviar código') || txt.includes('continuar')) {
                        el.click();
                        break;
                    }
                }
            });
            await new Promise(r => setTimeout(r, 2500));
        } catch (e) {}

        // 2. Extraer el código ÚNICAMENTE de elementos clave
        const codigo = await page.evaluate(() => {
            // Descartar scripts, estilos y footers
            const clone = document.body.cloneNode(true);
            clone.querySelectorAll('script, style, footer, .site-footer, noscript').forEach(e => e.remove());

            // Buscar en títulos y números destacados
            const elementos = clone.querySelectorAll('h1, h2, h3, strong, b, .travel-code, [data-uia*="code"]');
            for (let el of elementos) {
                const txt = (el.innerText || el.textContent || '').trim();
                const m = txt.match(/^(?<!\d)[0-9]{4}(?!\d)$/);
                if (m && !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(m[0])) {
                    return m[0];
                }
            }

            // Buscar frases con "código"
            const bodyTxt = clone.innerText || clone.textContent || '';
            const mCerca = bodyTxt.match(/(?:c[oó]digo|code)[\s\S]{1,50}?(?<!\d)([0-9]{4})(?!\d)/i);
            if (mCerca && !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(mCerca[1])) {
                return mCerca[1];
            }

            return null;
        });

        console.log(`[i] Código extraído: ${codigo}`);
        await browser.close();

        if (codigo) {
            return res.json({ status: 'success', codigo: codigo });
        } else {
            return res.status(404).json({ status: 'error', message: 'No se generó código (posible enlace expirado)' });
        }
    } catch (err) {
        if (browser) await browser.close();
        console.error(`[!] Error: ${err.message}`);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
