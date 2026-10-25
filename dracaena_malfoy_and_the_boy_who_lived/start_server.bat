@echo off
echo Dang khoi dong Local Web Server tai http://localhost:8000/index.html ...
start http://localhost:8000/index.html
python -m http.server 8000
pause
