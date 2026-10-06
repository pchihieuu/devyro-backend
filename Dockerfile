FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["./entrypoint.sh"]