import {BattleStream} from "./battle-stream";
import {Dex} from "./dex";
import * as Net from "net";
import { Species } from "./dex-species";
import * as CobblemonCache from "./cobblemon-cache";

export function startServer(port: number): void {
	const server = Net.createServer();
	const battleMap = new Map<string, BattleStream>();

	server.listen(port, () => {
		console.log('Server listening for connection requests on socket localhost: ' + port);
	});

	server.on('connection', socket => onConnection(socket, battleMap));
}

function onData(socket: Net.Socket, chunk: Buffer, battleMap: Map<string, BattleStream>) {
	const data = chunk.toString();
	const lines = data.split('\n');
	lines.forEach(line => {
		console.log('Data received from client: ' + line.toString());
		if (line.startsWith('>startbattle')) {
			const battleId = line.split(' ')[1];
			battleMap.set(battleId, new BattleStream());
		} else if (line === '>getCobbledMoves') {
			getCobbledMoves(socket);
		} else if (line === '>getCobbledAbilityIds') {
			getCobbledAbilityIds(socket);
		} else if (line === '>getCobbledItemIds') {
			getCobbledItemIds(socket);
		} else if (line === '>resetSpeciesData') {
			CobblemonCache.resetSpecies();
		} else if (line.startsWith('>receiveSpeciesData')) {
			const speciesJson = line.replace(`>receiveSpeciesData `, '');
			const species = JSON.parse(speciesJson) as Species;
			CobblemonCache.registerSpecies(species);
			console.log('Received', species.id);
			socket.write('ACK');
		} else {
			const [battleId, showdownMsg] = line.split('~');
			const battleStream = battleMap.get(battleId);
			if (battleStream) {
				try {
					void battleStream.write(showdownMsg);
				} catch (err: any) {
					console.error(err.stack);
				}

				writeBattleOutput(socket, battleStream);
			}
		}
	});
}

function writeBattleOutput(socket: Net.Socket, battleStream: BattleStream) {
	const messages = battleStream.buf;
	if (messages.length !== 0) {
		socket.write(padNumber(messages.length, 8));
		for (const message of messages) {
			socket.write(padNumber(message.length, 8) + message);
		}
	} else {
		writeVoid(socket);
	}
	battleStream.buf = [];
}

function writeVoid(socket: Net.Socket) {
	socket.write('00000000');
}

function onConnection(socket: Net.Socket, battleMap: Map<string, BattleStream>) {
	socket.on('data', (chunk) => onData(socket, chunk, battleMap));
	socket.on('end', () => console.log('Closing connection with the client'));
	socket.on('error', (err) => console.error(err.stack));
}

function getCobbledMoves(socket: Net.Socket) {
	const payload = JSON.stringify(Dex.mod(CobblemonCache.MOD_ID).moves.all());
	socket.write(padNumber(payload.length, 8) + payload);
}

function getCobbledAbilityIds(socket: Net.Socket) {
	const payload = JSON.stringify(Dex.mod(CobblemonCache.MOD_ID).abilities.all().map(ability => ability.id));
	socket.write(padNumber(payload.length, 8) + payload);
}

function getCobbledItemIds(socket: Net.Socket) {
	const payload = JSON.stringify(Dex.mod(CobblemonCache.MOD_ID).items.all().map(item => item.id));
	socket.write(padNumber(payload.length, 8) + payload);
}

function padNumber(num: number, size: number): string {
	let numStr = num.toString();
	while (numStr.length < size) numStr = "0" + numStr;
	return numStr;
}
