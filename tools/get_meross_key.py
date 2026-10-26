#!/usr/bin/env python3
"""Retrieve the Meross cloud key for local device communication."""

import asyncio
import getpass
import sys

from meross_iot.http_api import MerossHttpClient

API_BASE_URL = "https://iotx-eu.meross.com"


async def main():
    email = input("Meross account email: ").strip()
    password = getpass.getpass("Meross account password: ")

    if not email or not password:
        print("Email and password are required.", file=sys.stderr)
        return 1

    client = None
    try:
        client = await MerossHttpClient.async_from_user_password(
            api_base_url=API_BASE_URL,
            email=email,
            password=password,
        )
        key = client.cloud_credentials.key

        if not key:
            print("No key was returned by the Meross cloud.", file=sys.stderr)
            return 1

        print("\nMeross key:")
        print(key)
        print("\nKeep this key secret. Do not commit it to Git.")
        return 0

    except Exception as exc:
        print(
            f"Meross login failed ({type(exc).__name__}): {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
