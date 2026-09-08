FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY . .

VOLUME [ "/data" ]
EXPOSE 8443

CMD ["node","index.js"]
