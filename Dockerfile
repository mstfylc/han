# HAN — production image.
#
# Single Node process, SQLite on a volume. bookworm-slim (glibc) is deliberate:
# better-sqlite3 ships prebuilt bindings for it, so no compiler in the image.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./

# the database lives here; mount it as a volume so deploys never touch data
RUN mkdir -p /app/.data
VOLUME /app/.data

EXPOSE 3000
CMD ["npm", "run", "start"]
