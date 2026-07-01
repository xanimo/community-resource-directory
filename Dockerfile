# Single-stage, rootless. Node 22 for built-in node:sqlite.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY api ./api
COPY web ./web
COPY data ./data
# Run as the non-root 'node' user that ships with the image.
USER node
EXPOSE 8080
CMD ["node", "api/server.js"]
