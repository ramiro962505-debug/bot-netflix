const express = require('express');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio de extracción de enlaces activo' });
});

app.post('/extraer-temporal', async (req, res) => {
    let { url, html } = req.body;
    let urlFinal = null;

    // Caso A: Si enviaron el HTML completo para buscar el link limpio
    if (html) {
        let limpio = html.replace(/=\r\n/g, '').replace(/=\n/g, '').replace(/=\r/g, '').replace(/=3D/g, '=');
        let regex = /https?:\/\/[^\s"'<>]+(?:travel\/verify|account\/travel|update-primary-location|nftoken=[^\s"'<>]+)/i;
        let match = limpio.match(regex);
        if (match) {
            urlFinal = match[0].replace(/&amp;/g, '&').trim();
        }
    }

    // Caso B: Si enviaron la URL cruda directamente
    if (!urlFinal && url) {
        urlFinal = url.replace(/=\r\n/g, '').replace(/=\n/g, '').replace(/=\r/g, '').replace(/=3D/g, '=').replace(/&amp;/g, '&').trim();
    }

    if (urlFinal) {
        console.log(`[+] Enlace de Netflix procesado con éxito: ${urlFinal}`);
        return res.json({ 
            status: 'success', 
            codigo: urlFinal 
        });
    } else {
        console.log('[-] No se encontró un enlace de Netflix válido');
        return res.status(404).json({ 
            status: 'error', 
            message: 'No se encontró enlace válido de Netflix' 
        });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
