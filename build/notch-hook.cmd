@rem Hook runner for installed Agent Notch: runs hook.js with the app exe in Node mode (about 2x faster than a full app start).
@set ELECTRON_RUN_AS_NODE=1
@"%~dp0agent-notch.exe" "%~dp0resources\app\hook.js" %*
