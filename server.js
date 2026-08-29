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

    // Limpieza segura de caracteres codificados
    url = url.replace(/=3D/g, '=').replace(/&amp;/g, '&').trim();

    console.log(`[+] Procesando URL de Netflix: ${url}`);
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

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 3000));

        // 1. Clic automático en los botones de confirmación / viaje / código
        try {
            const clickRealizado = await page.evaluate(() => {
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
                        txt.includes('estoy de viaje') ||
                        txt.includes('continuar') || 
                        txt.includes('continue')
                    ) {
                        el.click();
                        return txt;
                    }
                }
                return false;
            });

            if (clickRealizado) {
                console.log(`[+] Botón presionado: "${clickRealizado}". Esperando código...`);
                await new Promise(r => setTimeout(r, 4500));
            }
        } catch (e) {
            console.log('[-] No se requirió clic o no se encontró botón');
        }

        // 2. Extraer el código visible generado
        const codigo = await page.evaluate(() => {
            const body = document.body;
            if (!body) return null;

            const clone = body.cloneNode(true);
            clone.querySelectorAll('script, style, footer, noscript').forEach(e => e.remove());

            // Prioridad A: Buscar en etiquetas directas con exactamente 4 dígitos
            const tags = Array.from(clone.querySelectorAll('h1, h2, h3, strong, b, div, span, p'));
            for (let el of tags) {
                const txt = (el.innerText || el.textContent || '').trim();
                if (/^[0-9]{4}$/.test(txt)) {
                    if (!['2023', '2024', '2025', '2026', '2027', '0000', '7652', '1234'].includes(txt)) {
                        return txt;
                    }
                }
            }

            // Prioridad B: Buscar por contexto de texto
            const fullText = clone.innerText || clone.textContent || '';
            const matchCerca = fullText.match(/(?:c[oó]digo|code|temporal)[\s\S]{1,60}?(?<!\d)([0-9]{4})(?!\d)/i);
            if (matchCerca && !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(matchCerca[1])) {
                return matchCerca[1];
            }

            // Prioridad C: Coincidencia limpia de 4 dígitos aislados
            const matches = fullText.match(/(?<!\d)[0-9]{4}(?!\d)/g);
            if (matches) {
                for (let m of matches) {
                    if (!['2023', '2024', '2025', '2026', '2027', '0000', '7652', '1234', '5678'].includes(m)) {
                        return m;
                    }
                }
            }

            return null;
        });

        console.log(`[i] Código extraído por Render: ${codigo}`);
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
