FROM ghcr.io/puppeteer/puppeteer:22.6.0

# Indicar la ruta del ejecutable preinstalado en la imagen
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código del proyecto
COPY . .

# Usar el usuario interno no-root para que Chrome corra sin restricciones de seguridad
USER pptruser

EXPOSE 3000
CMD [ "node", "server.js" ]
