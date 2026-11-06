@echo off
title DriNet local server
echo.
echo DriNet is starting at http://127.0.0.1:5500/index.html
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.
echo.
npx --yes http-server -p 5500 -c-1
pause