
Backend : 

pm2 start dist/src/main.js --name gyomu-api
pm2 save

Frontend : 

pm2 start npm --name gyomu-web -- start    # ← ダブルダッシュ --name に注意
pm2 save