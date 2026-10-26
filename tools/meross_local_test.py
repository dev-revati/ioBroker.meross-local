import hashlib
import json
import time
import uuid
import urllib.request
import urllib.error
from getpass import getpass

IP = "10.0.30.51"
URL = f"http://{IP}/config"

key = getpass("Meross-Schlüssel: ").strip()
if not key:
    raise SystemExit("Kein Schlüssel eingegeben.")

def request(namespace, payload):
    message_id = uuid.uuid4().hex
    timestamp = int(time.time())

    # Meross-Nachrichtensignatur
    sign = hashlib.md5(
        f"{message_id}{key}{timestamp}".encode()
    ).hexdigest()

    message = {
        "header": {
            "messageId": message_id,
            "namespace": namespace,
            "method": "GET",
            "payloadVersion": 1,
            "from": URL,
            "timestamp": timestamp,
            "timestampMs": 0,
            "sign": sign,
        },
        "payload": payload,
    }

    data = json.dumps(message).encode("utf-8")
    req = urllib.request.Request(
        URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(f"\n--- {namespace} ---")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return result
    except urllib.error.HTTPError as e:
        print(f"\n{namespace}: HTTP-Fehler {e.code}")
        print(e.read().decode("utf-8", errors="replace"))
    except Exception as e:
        print(f"\n{namespace}: {type(e).__name__}: {e}")

print(f"Teste Meross-Steckdose {IP}")
request("Appliance.System.All", {"all": {}})
request("Appliance.Control.Electricity", {"electricity": {"channel": 0}})
