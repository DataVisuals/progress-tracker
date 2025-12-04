#!/usr/bin/env python3

import json
import sys
import urllib.request
import websocket
from datetime import datetime

def main():
    # Get WebSocket URL
    try:
        response = urllib.request.urlopen('http://localhost:9222/json')
        data = json.loads(response.read())
        if not data:
            print("❌ Could not find Chrome debugging session")
            print("💡 Make sure Chrome is running with debug port 9222")
            print("   Run: open ~/Applications/Chrome\\ Debug.app")
            sys.exit(1)
        ws_url = data[0]['webSocketDebuggerUrl']
    except Exception as e:
        print(f"❌ Error connecting to Chrome: {e}")
        sys.exit(1)

    print("🔍 Connected to Chrome DevTools Protocol")
    print("📋 Watching console logs... (Ctrl+C to stop)")
    print("─" * 80)
    print()

    # Connect to WebSocket
    ws = websocket.create_connection(ws_url)

    # Enable console logging
    ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
    ws.send(json.dumps({"id": 2, "method": "Console.enable"}))
    ws.send(json.dumps({"id": 3, "method": "Log.enable"}))

    try:
        while True:
            message = ws.recv()
            data = json.loads(message)

            if data.get('method') == 'Runtime.consoleAPICalled':
                params = data.get('params', {})
                msg_type = params.get('type', 'log')
                args = params.get('args', [])

                # Extract message values
                messages = []
                for arg in args:
                    if 'value' in arg:
                        messages.append(str(arg['value']))
                    elif 'description' in arg:
                        messages.append(arg['description'])

                timestamp = datetime.now().strftime("%H:%M:%S")

                # Color codes
                colors = {
                    'error': '\033[31m',
                    'warn': '\033[33m',
                    'info': '\033[36m',
                    'debug': '\033[35m'
                }
                color = colors.get(msg_type, '\033[37m')
                reset = '\033[0m'

                print(f"{color}[{timestamp}] [{msg_type.upper()}]{reset} {' '.join(messages)}")

            elif data.get('method') == 'Runtime.exceptionThrown':
                exception = data.get('params', {}).get('exceptionDetails', {})
                text = exception.get('text', 'Unknown error')
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"\033[31m[{timestamp}] [EXCEPTION]\033[0m {text}")

    except KeyboardInterrupt:
        print("\n\n👋 Disconnecting...")
        ws.close()

if __name__ == '__main__':
    main()
