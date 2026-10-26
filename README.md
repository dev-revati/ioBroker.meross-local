# ioBroker.meross-local

Control and monitor compatible Meross smart plugs locally over your network.

## Features

- Switch devices on and off
- Poll device status at configurable intervals
- Read current, voltage and power where supported
- Track device availability and last status update
- Clear measurement values when a device becomes unreachable
- Report overall adapter connectivity

## Configuration

Configure the Meross key credential, polling interval and devices with their names and IP addresses.

Example device configuration:

```json
[
  {
    "name": "coffee_machine",
    "ip": "10.0.30.52"
  }
]
```

Configuration changes require an adapter restart.

## States

Each device provides:

| State | Description |
|---|---|
| `state` | Switch state (read/write) |
| `online` | Device availability |
| `lastUpdate` | Last successful status update (Unix timestamp in ms) |
| `current` | Current in amperes (A) |
| `voltage` | Voltage in volts (V) |
| `power` | Power in watts (W) |

Measurement values are set to `null` when the device status request fails. `info.connection` is `true` when at least one device is reachable.

## Development

Run the isolated development instance:

```bash
./node_modules/.bin/dev-server watch default
```

Check JavaScript syntax:

```bash
node --check main.js
```

Tested with Meross MSS210P smart plugs. Other models may not be compatible.

## Python tools

The `tools/` directory contains two standalone scripts.

### Requirements

On Ubuntu/Debian, install Python and virtual-environment support if needed:

    sudo apt update
    sudo apt install python3 python3-venv

### Retrieve the Meross cloud key

`tools/get_meross_key.py` logs in to the Meross cloud and prints the key used for local device communication.

Create a virtual environment and install the dependency:

    python3 -m venv .venv
    .venv/bin/python -m pip install meross_iot

Run the script:

    .venv/bin/python tools/get_meross_key.py

Enter your Meross account email and password when prompted. The password is not displayed. The script currently uses the EU cloud endpoint.

**Keep the returned key and your account credentials secret. Never commit them to Git.**

### Test local device communication

`tools/meross_local_test.py` requests device status and electricity measurements directly from a local Meross device.

Edit the `IP` variable in the script to match your device, then run:

    python3 tools/meross_local_test.py

This script uses only the Python standard library. Enter the Meross key when prompted. The computer must be able to reach the device over the local network.
