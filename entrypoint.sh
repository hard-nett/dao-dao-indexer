#!/bin/sh

# Run database migrations and setup (with error handling)
npm run db:migrate:data || echo "Initial migration failed (expected)"
npm run db:setup

# Start the server in production mode
npm run serve:prod