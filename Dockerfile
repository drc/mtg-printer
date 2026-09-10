FROM oven/bun:1.4-debian AS build
WORKDIR /app

# canvas compiles a native module at install time; sharp (re)builds/installs its
# binaries on the installed platform unless prebuilts are available
# libexpat1: bun 1.4 dynamically links libexpat.so.1, absent from the base image
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run prepare && bun run build

FROM oven/bun:1.4-debian AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json

CMD ["bun", "build/index.js"]