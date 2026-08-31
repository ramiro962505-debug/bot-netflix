const express = require('express');

const app = express();
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ status: 'ok', mensaje: 'Servicio extractor activo' });
});

app.post('/extraer-temporal', async (req, res) => {
    let { raw, html, url } = req.body;
    let contenido = (raw || '') + ' ' + (html || '') + ' ' + (url || '');

    if (!contenido.trim()) {
        return res.status(400).json({ error: 'Contenido vacío' });
    }

    // 1. Limpiar completamente la codificación Quoted-Printable de IMAP
    let textoLimpio = contenido
        .replace(/=\r\n/g, '')
        .replace(/=\n/g, '')
        .replace(/=\r/g, '')
        .replace(/=3D/gi, '=')
        .replace(/&amp;/gi, '&');

    // 2. Buscar exclusivamente el enlace con nftoken o travel/verify
    let patron = /https?:\/\/(?:www\.)?netflix\.com\/(?:[a-zA-Z0-9_-]+\/)?(?:account\/travel\/verify|travel\/verify|update-primary-location)\?[^\s"'<>]+/i;
    let match = textoLimpio.match(patron);

    // Fallback: si viene en otro formato pero contiene nftoken
    if (!match) {
        let patronToken = /https?:\/\/(?:www\.)?netflix\.com\/[^\s"'<>]*nftoken=[a-zA-Z0-9_-]+/i;
        match = textoLimpio.match(patronToken);
    }

    if (match) {
        let enlaceFinal = match[0].trim();
        // Quitar caracteres sobrantes al final
        enlaceFinal = enlaceFinal.replace(/["'<>]+$/, '').replace(/=+$/, '');

        console.log(`[+] Enlace legítimo extraído: ${enlaceFinal}`);
        return res.json({
            status: 'success',
            codigo: enlaceFinal
        });
    } else {
        console.log('[-] No se encontró enlace con token de verificación');
        return res.status(404).json({
            status: 'error',
            message: 'No se encontró enlace válido de verificación'
        });
    }
});

app.listen(PORT, () => console.log(`Servicio corriendo en puerto ${PORT}`));
