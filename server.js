const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio Chromium activo' });
});

app.post('/extraer-temporal', async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // 1. Limpieza y decodificación completa de la URL
    try {
        url = decodeURIComponent(url.replace(/=3D/g, '='));
    } catch (e) {
        url = url.replace(/=3D/g, '=');
    }

    console.log(`[+] Procesando URL limpia: ${url}`);
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Bloquear recursos pesados innecesarios (imágenes, CSS pesado, fuentes) para máxima velocidad
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const tipo = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(tipo)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        // Carga rápida
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 2000));

        // 2. Dar clic automático si hay botón de confirmación o solicitud
        try {
            await page.evaluate(() => {
                const elementos = Array.from(document.querySelectorAll('button, a, div[role="button"], input[type="submit"]'));
                for (let el of elementos) {
                    const txt = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
                    if (txt.includes('obtener código') || txt.includes('get code') || txt.includes('enviar código') || txt.includes('continuar') || txt.includes('continue')) {
                        el.click();
                        break;
                    }
                }
            });
            await new Promise(r => setTimeout(r, 2500));
        } catch (e) {}

        // 3. Extraer el código numérico
        const codigo = await page.evaluate(() => {
            const body = document.body;
            if (!body) return null;

            const clone = body.cloneNode(true);
            clone.querySelectorAll('script, style, footer, noscript').forEach(el => el.remove());
            const textContent = clone.innerText || clone.textContent || '';

            // A. Buscar en títulos o etiquetas destacadas
            const tags = clone.querySelectorAll('h1, h2, h3, strong, b, div, span');
            for (let el of tags) {
                const txt = (el.innerText || el.textContent || '').trim();
                const m = txt.match(/^(?<!\d)[0-9]{4}(?!\d)$/);
                if (m && !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(m[0])) {
                    return m[0];
                }
            }

            // B. Buscar cerca de la palabra "código" o "code"
            const regexCerca = /(?:c[oó]digo|code)[\s\S]{1,60}?(?<!\d)([0-9]{4})(?!\d)/i;
            const matchCerca = textContent.match(regexCerca);
            if (matchCerca && !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(matchCerca[1])) {
                return matchCerca[1];
            }

            return null;
        });

        console.log(`[i] Código extraído: ${codigo}`);
        await browser.close();

        if (codigo) {
            return res.json({ status: 'success', codigo: codigo });
        } else {
            return res.status(404).json({ status: 'error', message: 'No se visualizó el código numérico' });
        }
    } catch (err) {
        if (browser) await browser.close();
        console.error(`[!] Error: ${err.message}`);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
