# Infrastructure (EC2 + Nginx + PM2)

Reference configs for the post-Phase1 deployment on AWS EC2. None of this is
in use during Phase1 — Phase1 still ships on Vercel + Neon.

## Layout on the host

```
/opt/gyomu-navi/                ← repo checkout
├── backend/                    ← NestJS (PM2 process: gyomu-backend, :3001)
│   ├── dist/                   ← `npm run build` output
│   └── .env                    ← from backend/.env.example
├── node_modules/
├── .next/                      ← `npm run build` output (Next.js)
├── .env                        ← from .env.example
└── infra/
    ├── nginx.conf              ← copied to /etc/nginx/conf.d/gyomu-navi.conf
    └── ecosystem.config.js     ← loaded by PM2
```

## One-time host setup

```bash
# Amazon Linux 2023
sudo dnf install -y nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm i -g pm2

# Certbot (snap or pip; pip example):
python3 -m pip install --user certbot certbot-nginx
sudo certbot --nginx -d app.example.com
```

## Deploy

```bash
cd /opt/gyomu-navi
git pull
npm ci
npm run build                     # builds the Next.js SPA
(cd backend && npm ci && npm run build)
sudo cp infra/nginx.conf /etc/nginx/conf.d/gyomu-navi.conf
sudo nginx -t && sudo systemctl reload nginx
pm2 reload infra/ecosystem.config.js
```

## Roles & secrets

- **EC2 IAM role** attached to the instance must allow:
  - `s3:PutObject`, `s3:GetObject` on `arn:aws:s3:::<bucket>/reports/*`
  - (optional) `ssm:GetParameter` if you store `.env` in Parameter Store
- **RDS**: connect via username/password initially; switch to IAM auth as a
  hardening follow-up (token generator + 15-minute lifetime).
- **No long-lived AWS keys** in any `.env`. The SDK picks up creds from IMDS.
