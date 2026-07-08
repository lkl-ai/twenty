FROM twentycrm/twenty:latest

USER root

COPY railway/patch-ai-dedupe.js /tmp/patch-ai-dedupe.js
RUN node /tmp/patch-ai-dedupe.js && rm /tmp/patch-ai-dedupe.js

USER 1000
