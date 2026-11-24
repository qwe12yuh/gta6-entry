export const WORLD = { west: -380, east: 140, north: -400, south: 390 };
export const AVENUES = [-302, -216, -128, -38, 58];
export const STREETS = [-332, -244, -156, -68, 20, 108, 196, 284, 372];
export const DISTRICTS = [
  { name: 'Coral Strand', street: 'Oceanlight Boulevard', id: '01', color: '#ffb578', x: 74, z: 125, description: 'Hotels, tide pools and a boulevard built for trouble.' },
  { name: 'Vela Downtown', street: 'Exchange Avenue', id: '02', color: '#83d6ee', x: -150, z: -151, description: 'Glass towers hide the Exchange and its private traffic network.' },
  { name: 'Barrio Palma', street: 'Mosaic Way', id: '03', color: '#f4c087', x: -223, z: 201, description: 'Night markets, crew hideouts and the Paloma respray garage.' },
  { name: 'Miramar Pier', street: 'Marina Walk', id: '04', color: '#ffa586', x: 234, z: -68, description: 'Boardwalk lights, a marina and a very busy horizon.' },
  { name: 'Arco Causeway', street: 'Arco Crossing', id: '05', color: '#93d8e6', x: 236, z: -244, description: 'The link between the mainland and Calypso Freeport.' },
  { name: 'Port Calypso', street: 'Freeport Road', id: '06', color: '#fbcb62', x: 435, z: -241, description: 'Cranes, shipping manifests and a helipad above the customs yard.' },
];

export const VEHICLES = {
  apex: { name: 'Solaris Apex GT', style: 'apex', max: 57, grip: 1.3, accel: 17, color: 0xf84323 },
  coupe: { name: 'Riptide Sabre', style: 'coupe', max: 43, grip: 1, accel: 12, color: 0x789bd0 },
  taxi: { name: 'Sunbird Taxi', style: 'coupe', max: 36, grip: 1.1, accel: 10, color: 0xfac444 },
  suv: { name: 'Marlin LX', style: 'suv', max: 39, grip: 0.89, accel: 10, color: 0x669d87 },
  police: { name: 'SKPD Interceptor', style: 'police', max: 49, grip: 1.16, accel: 15, color: 0x22364b },
  swat: { name: 'SKPD Sentinel', style: 'suv', max: 35, grip: 0.92, accel: 10, color: 0x364550 },
  moto: { name: 'Halcyon 800', style: 'moto', max: 48, grip: 1.5, accel: 18, color: 0xdb6f39 },
  heli: { name: 'Kestrel-X Helicopter', style: 'heli', max: 69, grip: 1, accel: 13, color: 0xe89d45 },
  falcon: { name: 'Falcon-1', style: 'heli', max: 69, grip: 1, accel: 13, color: 0x314859 },
};

export const WEAPONS = [
  { name: 'Fists', icon: 'fist', range: 2.5, power: 30, delay: .38, capacity: 0 },
  { name: 'Baton', icon: 'baton', range: 3.2, power: 42, delay: .48, capacity: 0 },
  { name: '9mm Pistol', icon: 'pistol', range: 72, power: 35, delay: .26, capacity: 12 },
  { name: 'Compact SMG', icon: 'smg', range: 85, power: 22, delay: .09, capacity: 30 },
  { name: 'Pump Shotgun', icon: 'shotgun', range: 38, power: 78, delay: .62, capacity: 8 },
  { name: 'Assault Rifle', icon: 'rifle', range: 105, power: 44, delay: .13, capacity: 30 },
  { name: 'RPG-7', icon: 'rpg', range: 120, power: 115, delay: 1.15, capacity: 3 },
];

export const CREW = {
  Mira: { job: 'SIGNAL CONTROL', color: '#ffad79', ink: '#432441' },
  Tariq: { job: 'FIELD OPERATIONS', color: '#83d9d8', ink: '#292b3c' },
  Vega: { job: 'TRANSPORT', color: '#e9ba69', ink: '#343758' },
};

export const HOME = { x: -38, z: 196 };
export const GARAGE = { x: -205, z: 196 };
export const ARMORY = { x: -118, z: 20 };
export const RADIO = ['Off air', '88.4  Tide FM', '96.2  Palma Pulse', '103.7  Night Ferry'];
export const RANKS = ['Runner', 'Coastline Local', 'Prime Operative', 'Harbor Phantom', 'Keys Legend'];

export const CAMPAIGN = [
  { name: 'Low Tide', crew: 'Vega', reward: 950, district: 2, stages: [
    ['meet', 'Meet Vega at the Palma safehouse', -38, 196, 'Mateo. They locked us out of our own harbor. Let’s get my car back first.'],
    ['drive', 'Take the Apex parked by Oceanlight', 58, 124, 'Red paint. Under the palms. You’ll know it when you see it.'],
    ['visit', 'Deliver the car to Miramar Pier', 219, -68, 'Pier office has a fresh manifest. Trade me the keys for a look.'],
  ] },
  { name: 'Paper Harbor', crew: 'Tariq', reward: 1550, district: 3, stages: [
    ['meet', 'Find Tariq on the Miramar boardwalk', 221, -68, 'The Freeport books have names written over other names. I marked a crate.'],
    ['collect', 'Recover the sealed manifest', 430, -244, 'Use Arco Crossing. The manifest is in the marked container row.'],
    ['visit', 'Bring the manifest to the Palma garage', -205, 196, 'Vega has a scanner and no love for Customs. Back to Palma.'],
  ] },
  { name: 'Glass Frequency', crew: 'Mira', reward: 2200, district: 1, stages: [
    ['meet', 'Contact Mira at Exchange Avenue', -128, -156, 'Every impounded car has a beacon. We can use their network to clear the harbor.'],
    ['disable', 'Take the Exchange relay offline', -109, -149, 'That violet relay is our way in. Once it drops, so does their quiet.'],
    ['evade', 'Disappear from the police grid', -38, -68, 'Move. You can lose the pursuit in the side streets.'],
  ] },
  { name: 'Heat on the Coast', crew: 'Mira', reward: 3900, district: 0, stages: [
    ['meet', 'Take Mira’s call at the Strand', 58, 196, 'Arco Control is about to close the gate. Copy the patrol key first.'],
    ['collect', 'Collect the copied patrol key', 71, 112, 'The box behind the curb has the key. Grab it before they find the tap.'],
    ['escape', 'Break the cordon at Arco Crossing', 241, -244, 'Air unit is up. Take Arco Crossing and keep the key moving.'],
    ['visit', 'Hand off the key at the Pier office', 220, -68, 'The air unit lost the signal. Boardwalk. I’ll meet you under the lights.'],
  ] },
  { name: 'Goods in the Sky', crew: 'Vega', reward: 4600, district: 5, stages: [
    ['meet', 'Meet Vega at the Calypso helipad', 467, -214, 'Their last copy is in an air courier’s box. The Kestrel is fueled.'],
    ['fly', 'Take off in the Kestrel-X', 470, -211, 'Space to lift. Control to descend. Take her above the cranes.'],
    ['flyby', 'Cross the Miramar beacon above the bay', 235, -69, 'Hold altitude over the wheel. The beacon will sync our copy.'],
    ['visit', 'Return to the Calypso helipad', 469, -212, 'Bring it home and set down under ten meters.'],
  ] },
  { name: 'Open the Keys', crew: 'Tariq', reward: 8000, district: 4, stages: [
    ['meet', 'Rendezvous at the Arco control point', 236, -244, 'We have every page. Bring them to the city transmitter.'],
    ['collect', 'Unlock the Exchange transmitter', -128, -156, 'The gate crew will lock us out when you touch it. Do it anyway.'],
    ['evade', 'Clear the final SKPD pursuit', -216, 108, 'The manifests are public. Just make it back to Vega.'],
    ['visit', 'Return to the Palma safehouse', -38, 196, 'The keys belong to the people who live here. Always did.'],
  ] },
];

export function districtAt(x, z) {
  if (x > 373 && z < -167) return 5;
  if (x > 136 && z < -186) return 4;
  if (x > 147 && z < 156) return 3;
  if (x >= -3) return 0;
  if (z < -63) return 1;
  return 2;
}

export function tideLine(z) {
  return 144 + 8 * Math.sin(z * .016) + 3.8 * Math.sin(z * .037);
}

export function avenueHasGreen(x,z,time){
  return (time+(Math.round((x+302)/86)+Math.round((z+332)/88))*7)%14 < 7;
}

export function isGround(x, z) {
  return (x > WORLD.west && x < tideLine(z) - 1 && z > WORLD.north && z < WORLD.south)
    || (x >= 128 && x < 362 && Math.abs(z + 68) < 19)
    || (x >= 128 && x < 386 && Math.abs(z + 244) < 14)
    || (x >= 379 && x < 530 && z > -308 && z < -163);
}

export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const headingTo = (x, z) => Math.atan2(x, -z);
export const angleDelta = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
