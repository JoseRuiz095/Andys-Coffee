#!/usr/bin/env sh
# Generates a throwaway CA and a server certificate for localhost, used only by the
# integration-test PostgreSQL container. Output goes to test/db/certs (git-ignored).
set -e

cd "$(dirname "$0")"
mkdir -p certs
cd certs

if [ -f ca.crt ] && [ -f server.crt ] && [ -f server.key ]; then
  echo "Test certificates already exist in test/db/certs"
  exit 0
fi

# MSYS (Git Bash on Windows) rewrites arguments that start with "/"; disable that for -subj.
export MSYS_NO_PATHCONV=1

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout ca.key -out ca.crt -subj "/CN=Andys Coffee Test CA"

openssl req -newkey rsa:2048 -nodes \
  -keyout server.key -out server.csr -subj "/CN=localhost"

printf "subjectAltName=DNS:localhost,IP:127.0.0.1\n" > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 3650 -extfile server.ext

rm -f server.csr server.ext ca.srl
echo "Test certificates written to test/db/certs"
