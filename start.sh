#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v clisp >/dev/null 2>&1; then
  echo 'CLISP is required. On macOS: brew install clisp' >&2
  exit 1
fi
: "${MEND_DB_USER:?Set MEND_DB_USER to your local database username before starting Mend.}"
umask 077
mkdir -p .runtime
chmod 700 .runtime
# The MySQL client reads MYSQL_PWD from the environment, never process arguments.
if [ -n "${MEND_DB_PASSWORD:-}" ]; then export MYSQL_PWD="$MEND_DB_PASSWORD"; fi
exec clisp -q -q start.lisp "$@"
