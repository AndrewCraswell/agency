FROM node:24-alpine

WORKDIR /app
COPY receiver.mjs ./receiver.mjs

USER node
EXPOSE 8080
CMD ["node", "receiver.mjs"]
