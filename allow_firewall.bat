@echo off
echo ========================================================
echo PatrolIQ - Allowing XAMPP Port 8080 in Windows Firewall
echo ========================================================
echo.
netsh advfirewall firewall add rule name="PatrolIQ XAMPP Apache 8080" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="PatrolIQ Vite Dev 5173" dir=in action=allow protocol=TCP localport=5173
echo.
echo ========================================================
echo SUCCESS! Firewall rules added for ports 8080 and 5173.
echo You can now connect your mobile phone.
echo ========================================================
pause
