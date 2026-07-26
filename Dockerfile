FROM twentycrm/twenty@sha256:45d4220dbafb7a6cfdd9112c2a46303f8e8087f5f1cac9f22483ad17572ace9d

USER root

COPY railway/patch-preserve-null-record-updates.js /tmp/patch-preserve-null-record-updates.js
RUN node /tmp/patch-preserve-null-record-updates.js \
  && rm /tmp/patch-preserve-null-record-updates.js

USER 1000
