ARG BUILD_FROM
FROM $BUILD_FROM

RUN \
  apk add --no-cache \
    nodejs npm

WORKDIR /linky

# Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy add-on code
COPY . .
RUN chmod a+x ./run.sh

# Transpile TypeScript
RUN npm run build

CMD [ "./run.sh" ]

