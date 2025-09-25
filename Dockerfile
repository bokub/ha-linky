ARG BUILD_FROM
FROM $BUILD_FROM

LABEL org.opencontainers.image.source=https://github.com/J-Phiz/ha-apsystems
LABEL org.opencontainers.image.description="HA APSystems Add-on"
LABEL org.opencontainers.image.licenses=ISC

RUN apk add --no-cache nodejs npm

WORKDIR /apsystems

# Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm ci --ignore-scripts

# Copy add-on code
COPY . .
RUN chmod a+x ./run.sh

# Transpile TypeScript
RUN npm run build

CMD [ "./run.sh" ]

