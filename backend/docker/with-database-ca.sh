#!/bin/sh

set -eu

readonly ca_file="/tmp/allied-autotech-secrets/database-ca.pem"

cleanup() {
  if [ -n "${temporary_ca_file:-}" ]; then
    rm -f -- "$temporary_ca_file"
  fi
}

if [ "${DB_SSL_MODE:-disable}" = "verify-full" ]; then
  if [ "${DB_SSL_CA_FILE:-}" != "$ca_file" ]; then
    echo "Database CA destination is not configured correctly" >&2
    exit 1
  fi

  if [ -z "${DB_SSL_CA_CERT:-}" ]; then
    echo "Database CA material is required" >&2
    exit 1
  fi

  umask 077
  mkdir -p -- "$(dirname "$ca_file")"
  temporary_ca_file="${ca_file}.tmp.$$"
  trap cleanup EXIT HUP INT TERM

  printf '%s\n' "$DB_SSL_CA_CERT" >"$temporary_ca_file"

  ca_size="$(wc -c <"$temporary_ca_file" | tr -d '[:space:]')"
  if [ "$ca_size" -lt 1 ] || [ "$ca_size" -gt 1048576 ]; then
    echo "Database CA material is invalid" >&2
    exit 1
  fi

  if ! grep -q -- '-----BEGIN CERTIFICATE-----' "$temporary_ca_file" \
    || ! grep -q -- '-----END CERTIFICATE-----' "$temporary_ca_file" \
    || grep -q -- 'PRIVATE KEY' "$temporary_ca_file"; then
    echo "Database CA material is invalid" >&2
    exit 1
  fi

  chmod 0400 "$temporary_ca_file"
  mv -f -- "$temporary_ca_file" "$ca_file"
  temporary_ca_file=""
  trap - EXIT HUP INT TERM
fi

unset DB_SSL_CA_CERT

exec "$@"
