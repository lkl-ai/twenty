FROM twentycrm/twenty:latest

USER root

COPY railway/patch-ai-dedupe.js /tmp/patch-ai-dedupe.js
COPY railway/patch-preserve-null-record-updates.js /tmp/patch-preserve-null-record-updates.js
RUN node /tmp/patch-ai-dedupe.js \
  && node /tmp/patch-preserve-null-record-updates.js \
  && rm /tmp/patch-ai-dedupe.js /tmp/patch-preserve-null-record-updates.js

USER 1000
