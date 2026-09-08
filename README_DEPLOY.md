# control-proxy

A minimal control proxy for ZeroTier Planet: registration, invite and approval backend.

This repository contains an Express.js + SQLite prototype to implement an invite-based join flow with manual admin approval.

Security notes
- Do NOT commit or upload your authtoken.secret. Instead mount it into the container as a read-only file at /secrets/authtoken.secret with file permissions 600.
- Replace SERVER_SECRET in your environment with a long random value before production.

## Quick deploy (on the Planet host)

1. Clone repo and edit .env.example -> .env
2. Mount /var/lib/zerotier-one/authtoken.secret into the container at /secrets/authtoken.secret:ro
3. docker-compose up -d --build

