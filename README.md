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
