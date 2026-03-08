#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Life OS Addon v2.0..."
bashio::log.info "Dashboard + Mail Bridge + Auto-Backup"

export PORT=8099

exec node /app/server.js
