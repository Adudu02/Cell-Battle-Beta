FROM node:22

RUN apt-get update && \
    apt-get install -y \
    openssh-client \
    git && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /workspace

EXPOSE 3000 5173

CMD ["bash", "-lc", "npm ci && npm run dev"]
