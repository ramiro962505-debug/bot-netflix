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
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

        // 1. Si aparece el botón de confirmación/obtener código, darle clic automáticamente
        try {
            await page.evaluate(() => {
                const botones = Array.from(document.querySelectorAll('button, a'));
                const botonObjetivo = botones.find(b => {
                    const txt = (b.innerText || '').toLowerCase();
                    return txt.includes('obtener código') || 
                           txt.includes('get code') || 
                           txt.includes('enviar código') || 
                           txt.includes('send code') ||
                           txt.includes('continuar') ||
                           txt.includes('continue');
                });
                if (botonObjetivo) {
                    botonObjetivo.click();
                }
            });
            await new Promise(r => setTimeout(r, 2500));
        } catch (e) {
            // Continuar si no requiere clic previo
        }

        // 2. Extraer el código apuntando a los contenedores destacados de Netflix
        const codigo = await page.evaluate(() => {
            // A. Buscar en elementos grandes o cajas de código
            const selectores = [
                '[data-uia*="code"]',
                '[data-uia*="travel"]',
                '.travel-code',
                '.verification-code',
                'h1', 'h2', 'strong', 'b'
            ];

            for (let sel of selectores) {
                const elementos = document.querySelectorAll(sel);
                for (let el of elementos) {
                    const match = (el.innerText || '').match(/(?<!\d)[0-9]{4}(?!\d)/);
                    if (match && !['2023', '2024', '2025', '2026', '2027', '0000'].includes(match[0])) {
                        return match[0];
                    }
                }
            }

            // B. Si no está en selectores, buscar en el texto principal excluyendo el footer
            const bodyClone = document.body.cloneNode(true);
            const footers = bodyClone.querySelectorAll('footer, .site-footer, script, style');
            footers.forEach(f => f.remove());

            const matches = (bodyClone.innerText || '').match(/(?<!\d)[0-9]{4}(?!\d)/g);
            if (!matches) return null;

            return matches.find(n => !['2023', '2024', '2025', '2026', '2027', '0000', '7652'].includes(n)) || null;
        });

        await browser.close();

        if (codigo) {
            return res.json({ status: 'success', codigo: codigo });
        } else {
            return res.status(404).json({ status: 'error', message: 'No se visualizó el código de viaje' });
        }
    } catch (err) {
        if (browser) await browser.close();
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
