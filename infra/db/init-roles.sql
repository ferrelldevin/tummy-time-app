-- Run by init-roles.sh, which checks the variables first. Values come from the environment.
\getenv db_name DB_NAME
\getenv app_user DB_APP_USER
\getenv app_password DB_APP_PASSWORD
\getenv migrator_user DB_MIGRATOR_USER
\getenv migrator_password DB_MIGRATOR_PASSWORD

-- The two users. Neither is a superuser, and neither can create databases or other users.
SELECT format('CREATE ROLE %I LOGIN', :'migrator_user')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_user') \gexec
SELECT format('CREATE ROLE %I LOGIN', :'app_user')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
ALTER ROLE :"migrator_user" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'migrator_password';
ALTER ROLE :"app_user" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'app_password';

-- The database belongs to the migrator. Nobody else may connect, except the app user.
-- TEMPLATE template0: lets us ask for UTF8 even on a server whose default template uses another
-- encoding (otherwise CREATE DATABASE fails with "new encoding is incompatible").
SELECT format('CREATE DATABASE %I OWNER %I TEMPLATE template0 ENCODING %L', :'db_name', :'migrator_user', 'UTF8')
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') \gexec
ALTER DATABASE :"db_name" OWNER TO :"migrator_user";
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
REVOKE ALL ON DATABASE :"db_name" FROM :"app_user";
-- CONNECT only: no CREATE (schemas) and no TEMPORARY (temporary tables).
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";

\connect :"db_name"
-- The migrator owns the schema the tables live in. Nobody else can create anything in it.
ALTER SCHEMA public OWNER TO :"migrator_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user";
-- Row access on the tables themselves is granted by `pnpm db:migrate` after each migration.
