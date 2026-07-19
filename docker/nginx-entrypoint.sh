#!/bin/sh
set -eu

render_config() {
  if [ -f "/etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem" ] &&
     [ -f "/etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem" ]; then
    template=/etc/nginx/scarlet-templates/https.conf.template
  else
    template=/etc/nginx/scarlet-templates/http.conf.template
  fi
  envsubst '${APP_DOMAIN} ${NGINX_CLIENT_MAX_BODY_SIZE} ${NGINX_PROXY_READ_TIMEOUT}' \
    < "$template" > /etc/nginx/conf.d/default.conf
}

render_config
nginx -t
nginx -g 'daemon off;' &
nginx_pid=$!

while kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 300
  render_config
  nginx -t && nginx -s reload
done

wait "$nginx_pid"
