const express = require('express');

const app = express();
app.use(express.json({ limit: '15mb' }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio de extracción activo' });
});

app.post('/extraer-temporal', async (req, res) => {
    let { raw, html, url } = req.body;
    let textoAnalizar = (raw || '') + ' ' + (html || '') + ' ' + (url || '');

    if (!textoAnalizar.trim()) {
        return res.status(400).json({ error: 'No se envió contenido' });
    }

    // Limpieza de caracteres quoted-printable
    let limpio = textoAnalizar
        .replace(/=\r\n/g, '')
        .replace(/=\n/g, '')
        .replace(/=\r/g, '')
        .replace(/=3D/gi, '=')
        .replace(/&amp;/gi, '&');

    // Buscar el link de viaje / hogar
    let patronLink = /https?:\/\/(?:www\.)?netflix\.com\/(?:[^\s"'<>]+)?(?:travel\/verify|account\/travel|update-primary-location|nftoken=[^\s"'<>]+)[^\s"'<>]*/i;
    let match = limpio.match(patronLink);

    if (match) {
        let urlExtraida = match[0].trim().replace(/["'<>]+$/, '').replace(/=+$/, '');
        console.log(`[+] Enlace extraído: ${urlExtraida}`);
        return res.json({ status: 'success', codigo: urlExtraida });
    } else {
        return res.status(404).json({ status: 'error', message: 'No se encontró enlace' });
    }
});

app.listen(PORT, () => console.log(`Servicio activo en puerto ${PORT}`));
