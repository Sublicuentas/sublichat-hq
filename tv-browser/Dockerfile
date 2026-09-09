FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app/tv-browser
ENV NODE_ENV=production
COPY tv-browser/package.json tv-browser/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=pwuser:pwuser tv-browser/ ./
COPY --chown=pwuser:pwuser activar-tv-platforms.js /app/activar-tv-platforms.js
USER pwuser
EXPOSE 8080
CMD ["node", "server.js"]
