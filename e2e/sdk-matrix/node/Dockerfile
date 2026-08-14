FROM node:24-alpine
WORKDIR /fixture
COPY package.json index.mjs ./
RUN npm install --omit=dev
CMD ["node", "index.mjs"]
