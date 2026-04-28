# React (webpack-dev-server) — ใช้กับ docker-compose service `frontend`
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start"]
