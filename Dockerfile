FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=5000
EXPOSE 5000

CMD ["npx", "serve", "dist", "-s", "-l", "5000"]
