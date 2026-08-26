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
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

        // Intentar dar clic si hay botón de confirmación
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
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.log('[-] Sin interacción previa:', e.message);
        }

        // Extraer texto y código
        const resultado = await page.evaluate(() => {
            const body = document.body;
            if (!body) return { codigo: null, texto: '' };

            const clone = body.cloneNode(true);
            clone.querySelectorAll('script, style, footer, noscript').forEach(el => el.remove());
            const textContent = clone.innerText || clone.textContent || '';

            // 1. Elementos destacados
            const tags = clone.querySelectorAll('h1, h2, h3, strong, b, div, span');
            for (let el of tags) {
                const txt = el.innerText || el.textContent || '';
                const m = txt.trim().match(/^(?<!\d)[0-9]{4}(?!\d)$/);
                if (m && !['2023', '2024', '2025', '2026', '2027', '0000'].includes(m[0])) {
                    return { codigo: m[0], texto: textContent.substring(0, 300) };
                }
            }

            // 2. Cercano a palabras clave
            const regexCerca = /(?:c[oó]digo|code)[\s\S]{1,60}?(?<!\d)([0-9]{4})(?!\d)/i;
            const matchCerca = textContent.match(regexCerca);
            if (matchCerca && !['2023', '2024', '2025', '2026', '2027', '0000'].includes(matchCerca[1])) {
                return { codigo: matchCerca[1], texto: textContent.substring(0, 300) };
            }

            // 3. Fallback en texto
            const matches = textContent.match(/(?<!\d)[0-9]{4}(?!\d)/g) || [];
            const cod = matches.find(n => !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(n));

            return { codigo: cod || null, texto: textContent.substring(0, 400) };
        });

        console.log(`[i] Texto extraído: ${resultado.texto.replace(/\n/g, ' ')}`);
        console.log(`[i] Código detectado: ${resultado.codigo}`);

        await browser.close();

        if (resultado.codigo) {
            return res.json({ status: 'success', codigo: resultado.codigo });
        } else {
            return res.status(404).json({ status: 'error', message: 'No se visualizó el código', preview: resultado.texto });
        }
    } catch (err) {
        if (browser) await browser.close();
        console.error(`[!] Error: ${err.message}`);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
