FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache bash curl

COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=80

EXPOSE 80

CMD ["node", "api/server.js"]
