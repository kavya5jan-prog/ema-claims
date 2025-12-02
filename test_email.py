#!/usr/bin/env python3
"""
Simple script to test email sending functionality.
Usage: python test_email.py <recipient_email>
"""
import sys
import json
import urllib.request
import urllib.parse
import urllib.error

def send_test_email(recipient_email, base_url='http://localhost:5000'):
    """Send a test email via the API."""
    url = f'{base_url}/send-test-email'
    
    payload = {
        'to': recipient_email
    }
    
    print(f"Sending test email to: {recipient_email}")
    print(f"API endpoint: {url}")
    print("-" * 50)
    
    try:
        # Use urllib (built-in, no installation needed)
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            result = json.loads(response.read().decode('utf-8'))
        
        if status_code == 200:
            print("✅ SUCCESS!")
            print(f"Message: {result.get('message', 'N/A')}")
            print(f"Message ID: {result.get('message_id', 'N/A')}")
            print(f"Sent at: {result.get('sent_at', 'N/A')}")
            print(f"Status Code: {result.get('status_code', 'N/A')}")
        else:
            print("❌ ERROR!")
            print(f"Status Code: {status_code}")
            print(f"Error: {result.get('error', 'Unknown error')}")
            if 'message' in result:
                print(f"Details: {result.get('message')}")
    
    except urllib.error.URLError as e:
        print("❌ ERROR: Could not connect to the server.")
        print(f"Make sure the Flask app is running on {base_url}")
        print(f"Error details: {str(e)}")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_email.py <recipient_email> [base_url]")
        print("\nExample:")
        print("  python test_email.py test@example.com")
        print("  python test_email.py test@example.com http://localhost:5000")
        sys.exit(1)
    
    recipient = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:5000'
    
    send_test_email(recipient, base_url)

