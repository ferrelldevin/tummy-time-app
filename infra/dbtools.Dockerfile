# NOT YET RUN. The command-line tools for backups, restores and creating database users, run
# next to the production database (infra/docker-compose.prod.yml, service "dbtools").
# The database is not reachable from the server's own network, so these scripts (infra/backup.sh,
# infra/restore.sh, infra/db/init-roles.sh) run in a container on the database's private network.
# The scripts need bash, which the Alpine postgres image does not include. This adds only that.
# Same base image and digest as the database itself, so pg_dump matches the server's version.
FROM postgres:17.11-alpine@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac
RUN apk add --no-cache bash
