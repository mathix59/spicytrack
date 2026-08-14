FROM node:24-alpine AS build
WORKDIR /fixture
COPY package.json index.html app.js ./
RUN npm install --omit=dev && npm run build

FROM nginx:1.27-alpine
COPY --from=build /fixture/index.html /usr/share/nginx/html/index.html
COPY --from=build /fixture/dist/ /usr/share/nginx/html/
