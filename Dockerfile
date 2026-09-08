FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

VOLUME [ "/data" ]
EXPOSE 8443

CMD ["node","index.js"]
