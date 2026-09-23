npm install
npm run prisma:generate

# Base de datos real (Supabase, la de backend/.env): SOLO aplicar migraciones ya escritas.
npm run prisma:migrate:deploy

# NUNCA contra Supabase:
#   npx prisma migrate reset   -> borra TODA la base de datos
#   npm run prisma:migrate     -> es `migrate dev`: ante cualquier drift propone un reset,
#                                 y al cambiar una columna de tipo genera DROP + ADD COLUMN (pierde datos)
# Esos comandos son solo para la BD Docker de pruebas (npm run test:db:up / test:db:prepare).
# Las migraciones que cambian tipos se escriben a mano (ALTER COLUMN ... USING ...) y se ensayan en Docker.
