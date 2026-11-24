import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { usuarios, ubicaciones } from '../src/lib/server/schema.js';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const seedUsuarios = [
	{ nombre: 'JA', iniciales: 'JA', rol: 'cliente' },
	{ nombre: 'Rosa', iniciales: 'R', rol: 'cliente' },
	{ nombre: 'Carmen', iniciales: 'C', rol: 'conductora' }
];

const seedUbicaciones = [
	{ nombre: 'Sambil Chacao' },
	{ nombre: 'Sambil La Candelaria' },
	{ nombre: 'San Ignacio' },
	{ nombre: 'Cerro Verde' },
	{ nombre: 'CCCT' },
	{ nombre: 'Las Mercedes' },
	{ nombre: 'Altamira' },
	{ nombre: 'Los Palos Grandes' },
	{ nombre: 'El Picacho' },
	{ nombre: 'El Retiro' },
	{ nombre: 'Líder' },
	{ nombre: 'Millenium' },
	{ nombre: 'El Limón' },
	{ nombre: 'El Rocío' },
	{ nombre: 'Rosalito' },
	{ nombre: 'Bello Monte' },
	{ nombre: 'Prime' },
	{ nombre: 'El 93' },
	{ nombre: 'Galerías Las Américas' },
	{ nombre: 'Ferretotal' },
	{ nombre: 'El Coliseo' },
	{ nombre: 'La Casona' },
	{ nombre: 'La Superior' },
	{ nombre: 'Los Altos' },
	{ nombre: 'La Redoma' }
];

async function seed() {
	console.log('Insertando usuarios...');
	await db.insert(usuarios).values(seedUsuarios).onConflictDoNothing();

	console.log('Insertando ubicaciones...');
	await db.insert(ubicaciones).values(seedUbicaciones).onConflictDoNothing();

	console.log('✓ Seed completado');
	process.exit(0);
}

seed().catch((err) => {
	console.error('Error en seed:', err);
	process.exit(1);
});
