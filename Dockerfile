FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY . .
RUN cp vite.azure.config.ts vite.config.ts && AZURE_BUILD=1 npx vinext build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV RUNTIME_PLATFORM=azure
ENV HOST=0.0.0.0
ENV PORT=8080
COPY --from=build /app/dist/standalone ./
EXPOSE 8080
CMD ["node", "server.js"]
