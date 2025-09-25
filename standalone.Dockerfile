FROM alpine:latest

LABEL org.opencontainers.image.source=https://github.com/J-Phiz/ha-apsystems
LABEL org.opencontainers.image.description="HA APSystems Standalone"
LABEL org.opencontainers.image.licenses=ISC

RUN apk add --no-cache nodejs npm

WORKDIR /apsystems

# Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm ci --ignore-scripts

# Copy add-on code
COPY . .

# Transpile TypeScript
RUN npm run build

CMD [ "node", "--experimental-modules", "dist/index.js" ]

