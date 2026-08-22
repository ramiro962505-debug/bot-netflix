FROM ghcr.io/puppeteer/puppeteer:22.6.0

USER root
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD [ "node", "server.js" ]
