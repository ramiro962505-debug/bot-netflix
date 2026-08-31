const express = require('express');

const app = express();
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio extractor activo' });
});

app.post('/extraer-temporal', async (req, res) => {
    let { raw, html, url } = req.body;
    let textoAnalizar = (raw || '') + ' ' + (html || '') + ' ' + (url || '');

    if (!textoAnalizar.trim()) {
        return res.status(400).json({ error: 'Contenido vacío' });
    }

    // 1. Limpieza estricta de saltos de línea y quoted-printable
    let limpio = textoAnalizar
        .replace(/=\r\n/g, '')
        .replace(/=\n/g, '')
        .replace(/=\r/g, '')
        .replace(/=3D/gi, '=')
        .replace(/&amp;/gi, '&');

    // 2. Extraer el enlace de viaje/hogar con todo su token (soporta +, /, =, &, etc.)
    let patron = /https?:\/\/(?:www\.)?netflix\.com\/(?:[^\s"'<>]+)?(?:account\/travel\/verify|travel\/verify|update-primary-location)[^\s"'<>]+/i;
    let match = limpio.match(patron);

    if (!match) {
        let patronToken = /https?:\/\/(?:www\.)?netflix\.com\/[^\s"'<>]*nftoken=[^\s"'<>]+/i;
        match = limpio.match(patronToken);
    }

    if (match) {
        let enlaceFinal = match[0].trim();
        // Limpiar únicamente comillas o corchetes de cierre al final
        enlaceFinal = enlaceFinal.replace(/[>"';\)]+$/, '');

        console.log(`[+] Enlace completo extraído con éxito:\n${enlaceFinal}`);
        return res.json({
            status: 'success',
            codigo: enlaceFinal
        });
    } else {
        console.log('[-] No se detectó el enlace completo con nftoken');
        return res.status(404).json({
            status: 'error',
            message: 'No se encontró enlace válido de Netflix'
        });
    }
});

app.listen(PORT, () => console.log(`Extractor activo en puerto ${PORT}`));
