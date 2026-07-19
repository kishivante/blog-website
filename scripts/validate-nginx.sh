#!/bin/sh
set -eu

export APP_DOMAIN=${APP_DOMAIN:-blog.example.invalid}
export NGINX_CLIENT_MAX_BODY_SIZE=${NGINX_CLIENT_MAX_BODY_SIZE:-20m}
export NGINX_PROXY_READ_TIMEOUT=${NGINX_PROXY_READ_TIMEOUT:-120s}

if ! command -v openssl >/dev/null 2>&1; then
  apk add --no-cache openssl >/dev/null
fi

mkdir -p "/etc/letsencrypt/live/$APP_DOMAIN"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=$APP_DOMAIN" \
  -keyout "/etc/letsencrypt/live/$APP_DOMAIN/privkey.pem" \
  -out "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" >/dev/null 2>&1

envsubst '${APP_DOMAIN} ${NGINX_CLIENT_MAX_BODY_SIZE} ${NGINX_PROXY_READ_TIMEOUT}' \
  < /templates/https.conf.template > /etc/nginx/conf.d/default.conf
nginx -t

envsubst '${APP_DOMAIN}' \
  < /templates/http.conf.template > /etc/nginx/conf.d/default.conf
nginx -t
