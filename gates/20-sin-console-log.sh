#!/usr/bin/env bash
# src/cli.ts is the only place allowed to print; logic and tests must return values instead.
bad="$(git diff "$FACTORY_BASE" -- . ':(exclude)src/cli.ts' ':(exclude)gates' \
  | grep -E '^\+[^+]' | grep -E 'console\.(log|info|debug)\(' || true)"
if [ -n "$bad" ]; then
  echo "El cambio agrega console.log fuera de src/cli.ts (solo la interfaz imprime):"
  echo "$bad"
  exit 1
fi
echo "Sin console.log fuera de src/cli.ts."
