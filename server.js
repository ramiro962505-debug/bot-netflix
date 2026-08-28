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

    // Limpieza de URL codificada
    try {
        url = decodeURIComponent(url.replace(/=3D/g, '='));
    } catch (e) {
        url = url.replace(/=3D/g, '=');
    }

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
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        // Carga de la página con suficiente margen
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 3000));

        // 1. Clic automático en botones de confirmación de Netflix
        try {
            const botonClickeado = await page.evaluate(() => {
                const elementos = Array.from(document.querySelectorAll('button, a, div[role="button"], input[type="submit"]'));
                for (let el of elementos) {
                    const txt = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
                    if (
                        txt.includes('obtener código') || 
                        txt.includes('get code') || 
                        txt.includes('enviar código') || 
                        txt.includes('send code') ||
                        txt.includes('actualizar hogar') ||
                        txt.includes('update household') ||
                        txt.includes('sí, soy yo') ||
                        txt.includes('yes, it was me') ||
                        txt.includes('continuar') || 
                        txt.includes('continue')
                    ) {
                        el.click();
                        return true;
                    }
                }
                return false;
            });

            if (botonClickeado) {
                console.log('[+] Botón presionado. Esperando generación de código...');
                await new Promise(r => setTimeout(r, 4000));
            }
        } catch (e) {
            console.log('[-] No se requirió clic o no se encontró botón');
        }

        // 2. Extraer el código visible generado
        const codigo = await page.evaluate(() => {
            const body = document.body;
            if (!body) return null;

            // Prioridad A: Buscar en elementos destacados o títulos
            const tags = Array.from(body.querySelectorAll('h1, h2, h3, strong, b, div, span, p'));
            for (let el of tags) {
                const txt = (el.innerText || el.textContent || '').trim();
                // Si el elemento contiene SOLO 4 dígitos
                if (/^[0-9]{4}$/.test(txt)) {
                    if (!['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(txt)) {
                        return txt;
                    }
                }
            }

            // Prioridad B: Buscar texto completo en el cuerpo
            const fullText = body.innerText || body.textContent || '';
            const regexCerca = /(?:c[oó]digo|code|temporal)[\s\S]{1,60}?(?<!\d)([0-9]{4})(?!\d)/i;
            const matchCerca = fullText.match(regexCerca);
            if (matchCerca && !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(matchCerca[1])) {
                return matchCerca[1];
            }

            // Prioridad C: Cualquier coincidencia de 4 dígitos aislados
            const matches = fullText.match(/(?<!\d)[0-9]{4}(?!\d)/g);
            if (matches) {
                for (let m of matches) {
                    if (!['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(m)) {
                        return m;
                    }
                }
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
