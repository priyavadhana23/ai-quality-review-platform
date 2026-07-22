# ── Frontend Dockerfile ───────────────────────────────────────────────────────
# Stage 1: build the Vite/React app
# Stage 2: serve via nginx on port 8080
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer-cache efficiency
COPY package.json package-lock.json ./

RUN npm ci --prefer-offline

# Copy the rest of the frontend source
COPY . ./

RUN npm run build


# ── Stage 2: nginx static server ──────────────────────────────────────────────
FROM nginx:1.25-alpine AS runtime

LABEL maintainer="AI Quality Review Platform"
LABEL description="React frontend — AI Quality Review Platform"

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx SPA config (handles client-side routing & backend proxying)
COPY spa.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
