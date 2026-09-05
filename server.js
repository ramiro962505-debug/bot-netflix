const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio extractor de 4 dígitos activo' });
});

app.post('/obtener-4-digitos', async (req, res) => {
    const { link } = req.body;

    if (!link || !link.startsWith('http')) {
        return res.status(400).json({ status: 'error', message: 'Enlace inválido' });
    }

    let browser = null;
    try {
        console.log(`[+] Abriendo enlace en segundo plano para extraer 4 dígitos...`);
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(link, { waitUntil: 'networkidle2', timeout: 25000 });

        // Esperar a que renderice la página con el código
        await new Promise(r => setTimeout(r, 4000));

        // Extraer el texto completo renderizado
        const textoPagina = await page.evaluate(() => document.body.innerText);

        // Buscar patrón de 4 dígitos en el texto renderizado
        let match = textoPagina.match(/(?<!\d)[0-9]{4}(?!\d)/);

        if (match) {
            const cuatroDigitos = match[0];
            console.log(`[OK] Código de 4 dígitos capturado con éxito: ${cuatroDigitos}`);
            await browser.close();
            return res.json({ status: 'success', codigo: cuatroDigitos });
        } else {
            console.log('[-] No se detectaron 4 dígitos en la pantalla.');
            await browser.close();
            return res.status(404).json({ status: 'error', message: 'No se visualizó el código de 4 dígitos' });
        }

    } catch (error) {
        if (browser) await browser.close();
        console.error('[-] Error en Puppeteer:', error.message);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

app.listen(PORT, () => console.log(`Extractor corriendo en puerto ${PORT}`));
