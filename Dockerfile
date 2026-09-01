# HAN — production image.
#
# One Node process; the data lives in Postgres, reached over DATABASE_URL, so
# the image itself is stateless — a deploy replaces the container and touches
# nothing that matters. bookworm-slim (glibc) keeps `pg`'s optional native
# accelerator working without putting a compiler in the final image, and it is
# where `postgresql-client` comes from for the backup script.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# pg_dump, for `npm run backup`. Nothing else in the image needs it, so it is
# the one package installed here rather than in the build stage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/db ./db
COPY --from=build /app/scripts/backup-db.mjs ./scripts/backup-db.mjs

# Backups are written here. Mount it if you want them to survive the container;
# the database itself is Postgres' own volume, not this one.
RUN mkdir -p /app/.backups
VOLUME /app/.backups

EXPOSE 3000
CMD ["npm", "run", "start"]
