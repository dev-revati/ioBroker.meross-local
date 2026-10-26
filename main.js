'use strict';

/*
 * Created with @iobroker/create-adapter v3.1.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { getCredentials } = utils.Credentials;
const crypto = require('crypto');
const http = require('http');
const { randomUUID } = require('crypto');

// Load your modules here, e.g.:
// const fs = require('fs');


/**
 * Sendet eine signierte lokale Anfrage an ein Meross-Gerät.
 *
 * @param {string} ip Geräte-IP-Adresse
 * @param {string} key Lokaler Meross-Schlüssel
 * @param {string} namespace Meross-Namespace
 * @param {object} payload Anfrage-Payload
 * @returns {Promise<object>} Antwort des Geräts
 */
function merossRequest(ip, key, namespace, payload, method = 'GET') {
	return new Promise((resolve, reject) => {
		const messageId = randomUUID().replace(/-/g, '');
		const timestamp = Math.floor(Date.now() / 1000);
		const sign = crypto
			.createHash('md5')
			.update(`${messageId}${key}${timestamp}`)
			.digest('hex');

		const message = {
			header: {
				messageId,
				namespace,
				method,
				payloadVersion: 1,
				from: `http://${ip}/config`,
				timestamp,
				timestampMs: 0,
				sign,
			},
			payload,
		};

		const body = JSON.stringify(message);
		const req = http.request(
			{
				hostname: ip,
				port: 80,
				path: '/config',
				method: 'POST',
				timeout: 5000,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
				},
			},
			(res) => {
				let responseBody = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					responseBody += chunk;
				});
				res.on('end', () => {
					try {
						const result = JSON.parse(responseBody);
						if (res.statusCode < 200 || res.statusCode >= 300) {
							reject(new Error(`HTTP-Status ${res.statusCode}`));
							return;
						}
						resolve(result);
					} catch {
						reject(new Error('Ungültige JSON-Antwort vom Gerät'));
					}
				});
			},
		);

		req.on('timeout', () => {
			req.destroy(new Error('Zeitüberschreitung bei der Geräteanfrage'));
		});
		req.on('error', reject);
		req.end(body);
	});
}

class MerossLocal extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	constructor(options) {
		super({
			...options,
			name: 'meross-local',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.setStateAsync('info.connection', false, true);

		const credentialId = this.config.merossKey;
		const devices = Array.isArray(this.config.devices) ? this.config.devices : [];

		if (typeof credentialId !== 'string' || !credentialId.startsWith('system.credentials.')) {
			this.log.error('Kein gültiges Meross-Credential ausgewählt. Bitte in der Adapterkonfiguration einen Schlüssel auswählen.');
			return;
		}

		let credentials;
		try {
			credentials = await getCredentials(this, credentialId);
		} catch (error) {
			this.log.error(`Meross-Credential konnte nicht geladen werden: ${error.message}`);
			return;
		}

		const key = credentials.values?.key;
		if (typeof key !== 'string' || key.length === 0) {
			this.log.error('Das ausgewählte Credential enthält keinen gültigen Schlüssel.');
			return;
		}

		this.merossKey = key;

		const validDevices = devices.filter(device =>
			device &&
			typeof device.name === 'string' &&
			device.name.trim() !== '' &&
			typeof device.ip === 'string' &&
			/^(\d{1,3}\.){3}\d{1,3}$/.test(device.ip),
		);

		if (validDevices.length === 0) {
			this.log.warn('Keine gültigen Geräte konfiguriert. Bitte Gerätename und IP-Adresse eintragen.');
			return;
		}

		this.log.info(`Meross-Credential geladen. Gültige Geräteeinträge: ${validDevices.length}.`);
		this.log.debug(`Abfrageintervall: ${Number(this.config.pollInterval) || 5000} ms.`);


		this.devices = validDevices.map(device => ({
			...device,
			id: device.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
		}));

		for (const device of this.devices) {
			await this.setObjectNotExistsAsync(device.id, {
				type: 'channel',
				common: { name: device.name },
				native: { ip: device.ip },
			});

			await this.setObjectNotExistsAsync(`${device.id}.state`, {
				type: 'state',
				common: {
					name: 'Schaltzustand',
					type: 'boolean',
					role: 'switch',
					read: true,
					write: true,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(`${device.id}.online`, {
				type: 'state',
				common: {
					name: 'Online',
					type: 'boolean',
					role: 'indicator.reachable',
					read: true,
					write: false,
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(`${device.id}.lastUpdate`, {
				type: 'state',
				common: {
					name: 'Letzte Aktualisierung',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					unit: 'ms',
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(`${device.id}.current`, {
				type: 'state',
				common: {
					name: 'Strom',
					type: 'number',
					role: 'value.current',
					read: true,
					write: false,
					unit: 'A',
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(`${device.id}.voltage`, {
				type: 'state',
				common: {
					name: 'Spannung',
					type: 'number',
					role: 'value.voltage',
					read: true,
					write: false,
					unit: 'V',
				},
				native: {},
			});

			await this.setObjectNotExistsAsync(`${device.id}.power`, {
				type: 'state',
				common: {
					name: 'Leistung',
					type: 'number',
					role: 'value.power',
					read: true,
					write: false,
					unit: 'W',
				},
				native: {},
			});
		}

		this.subscribeStates('*');

		this.pollInterval = Math.max(1000, Number(this.config.pollInterval) || 5000);
		await this.pollDevices(key);

		this.pollTimer = setInterval(() => {
			this.pollDevices(key).catch(error => {
				this.log.error(`Fehler beim Aktualisieren der Geräte: ${error.message}`);
			});
		}, this.pollInterval);
	}

	async pollDevices(key) {
		if (this.polling) return;
		this.polling = true;

		try {
			for (const device of this.devices || []) {
				try {
					const result = await merossRequest(
						device.ip,
						key,
						'Appliance.System.All',
						{ all: {} },
					);

					const onoff = result.payload?.all?.digest?.togglex?.[0]?.onoff;
					if (onoff !== 0 && onoff !== 1) {
						throw new Error('Schaltzustand fehlt in der Geräteantwort');
					}

					await this.setStateAsync(`${device.id}.state`, onoff === 1, true);
					await this.setStateAsync(`${device.id}.online`, true, true);
					await this.setStateAsync(`${device.id}.lastUpdate`, Date.now(), true);
					try {
						const electricity = await merossRequest(
							device.ip,
							key,
							'Appliance.Control.Electricity',
							{ electricity: { channel: 0 } },
						);

						const values = electricity.payload?.electricity;
						if (
							!values ||
							typeof values.current !== 'number' ||
							typeof values.voltage !== 'number' ||
							typeof values.power !== 'number'
						) {
							throw new Error('Messwerte fehlen in der Geräteantwort');
						}

						await this.setStateAsync(`${device.id}.current`, values.current / 1000, true);
						await this.setStateAsync(`${device.id}.voltage`, values.voltage / 10, true);
						await this.setStateAsync(`${device.id}.power`, values.power / 1000, true);
					} catch (error) {
						this.log.warn(`Messwertabfrage für "${device.name}" (${device.ip}) fehlgeschlagen: ${error.message}`);
					}


					this.log.debug(`Meross-Gerät "${device.name}" (${device.ip}): Schaltzustand ${onoff ? 'EIN' : 'AUS'}.`);
				} catch (error) {
					await this.setStateAsync(`${device.id}.online`, false, true);
					await this.setStateAsync(`${device.id}.current`, null, true);
					await this.setStateAsync(`${device.id}.voltage`, null, true);
					await this.setStateAsync(`${device.id}.power`, null, true);
					this.log.warn(`Abfrage von "${device.name}" (${device.ip}) fehlgeschlagen: ${error.message}`);
				}
			}

			const onlineStates = await Promise.all(
				(this.devices || []).map(device => this.getStateAsync(`${device.id}.online`)),
			);
			const anyOnline = onlineStates.some(state => state?.val === true);
			await this.setStateAsync('info.connection', anyOnline, true);
		} finally {
			this.polling = false;
		}

	}
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param {() => void} callback - Callback function
	 */
	onUnload(callback) {
		try {
			if (this.pollTimer) {
				clearInterval(this.pollTimer);
				this.pollTimer = null;
			}

			callback();
		} catch (error) {
			this.log.error(`Error during unloading: ${error.message}`);
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 *
	 * @param {string} id - State ID
	 * @param {ioBroker.State | null | undefined} state - State object
	 */
	async onStateChange(id, state) {
		if (!state || state.ack !== false) return;

		const relativeId = id.startsWith(`${this.namespace}.`)
			? id.slice(this.namespace.length + 1)
			: id;
		const device = this.devices?.find(item => relativeId === `${item.id}.state`);
		if (!device) return;

		if (typeof state.val !== 'boolean') {
			this.log.warn(`Ungültiger Schaltwert für "${device.name}"; erwartet wird true oder false.`);
			return;
		}

		try {
			await merossRequest(
				device.ip,
				this.merossKey,
				'Appliance.Control.ToggleX',
				{ togglex: { channel: 0, onoff: state.val ? 1 : 0 } },
				'SET',
			);
			await this.setStateAsync(`${device.id}.state`, state.val, true);
			this.log.info(`Schaltbefehl für "${device.name}" gesendet: ${state.val ? 'EIN' : 'AUS'}.`);
		} catch (error) {
			this.log.error(`Schalten von "${device.name}" fehlgeschlagen: ${error.message}`);
		}
	}
	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	module.exports = options => new MerossLocal(options);
} else {
	// otherwise start the instance directly
	new MerossLocal();
}
