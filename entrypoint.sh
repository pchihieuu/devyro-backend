#!/bin/sh
set -e

echo "NODE_ENV: $NODE_ENV"
echo "Running database migrations..."
npm run migration:run

echo "Starting dev server..."
exec npm run dev