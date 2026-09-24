# Included by default.conf for every location that Laravel answers.
proxy_pass         http://api:8000;
proxy_http_version 1.1;
proxy_set_header   Host              $host;
proxy_set_header   X-Real-IP         $remote_addr;
# Overwritten, never appended: Laravel trusts this header (TRUSTED_PROXIES), and an
# appended value would carry whatever the client sent — letting it pick its own IP and
# walk past the login throttle (NFR3a).
proxy_set_header   X-Forwarded-For   $remote_addr;
proxy_set_header   X-Forwarded-Proto https;
proxy_set_header   X-Forwarded-Host  $host;
proxy_set_header   X-Forwarded-Port  443;
