FROM node:18-alpine AS builder

LABEL org.opencontainers.image.source=https://github.com/bokub/ha-linky
LABEL org.opencontainers.image.description="HA Linky Builder"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /linky

# Install dependencies and build
COPY package.json package-lock.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# Remove devDependencies to keep node_modules production-only
RUN npm prune --production --silent

FROM node:18-alpine AS runner

LABEL org.opencontainers.image.source=https://github.com/bokub/ha-linky
LABEL org.opencontainers.image.description="HA Linky Standalone"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /linky
ENV NODE_ENV=production

# Copy built artifacts and production node_modules from the builder stage
COPY --from=builder /linky/dist ./dist
COPY --from=builder /linky/node_modules ./node_modules

# Copy runtime config if present
COPY config.yaml ./config.yaml

CMD [ "node", "--experimental-modules", "dist/index.js" ]

