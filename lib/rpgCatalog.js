const CLASS_EQUIPMENT = {
    guerrero: [
        { id: 'mandoble_dragon', name: '⚔️ Mandoble del Dragón', price: 28000, bonus: 0.10, activities: ['work', 'dungeon', 'raid'] },
        { id: 'armadura_coloso', name: '🛡️ Armadura del Coloso', price: 32000, bonus: 0.12, activities: ['work', 'dungeon', 'raid'] },
        { id: 'lanza_titan', name: '🔱 Lanza del Titán', type: 'arma', price: 48000, bonus: 0.08, activities: ['work', 'dungeon', 'raid'], dungeonDrop: true },
        { id: 'escudo_abismal', name: '🛡️ Escudo Abismal', type: 'armadura', price: 52000, bonus: 0.08, activities: ['dungeon', 'raid'], dungeonDrop: true }
    ],
    mago: [
        { id: 'grimorio_arcano', name: '📖 Grimorio Arcano', price: 30000, bonus: 0.12, activities: ['work', 'explore', 'raid'] },
        { id: 'tunica_astral', name: '🔮 Túnica Astral', price: 35000, bonus: 0.12, activities: ['work', 'dungeon', 'raid'] },
        { id: 'baston_cometa', name: '☄️ Bastón del Cometa', type: 'arma', price: 49000, bonus: 0.08, activities: ['explore', 'dungeon', 'raid'], dungeonDrop: true },
        { id: 'corona_hechicero', name: '👑 Corona del Hechicero', type: 'armadura', price: 53000, bonus: 0.08, activities: ['work', 'dungeon', 'raid'], dungeonDrop: true }
    ],
    picaro: [
        { id: 'dagas_sombra', name: '🗡️ Dagas de la Sombra', price: 29000, bonus: 0.12, activities: ['work', 'crime', 'raid'] },
        { id: 'capa_niebla', name: '🥷 Capa de la Niebla', price: 34000, bonus: 0.10, activities: ['crime', 'steal', 'raid'] },
        { id: 'katana_fantasma', name: '👻 Katana Fantasma', type: 'arma', price: 47000, bonus: 0.08, activities: ['crime', 'dungeon', 'raid'], dungeonDrop: true },
        { id: 'anillo_sombra', name: '💍 Anillo de Sombra', type: 'reliquia', price: 51000, bonus: 0.08, activities: ['crime', 'steal', 'raid'], dungeonDrop: true }
    ],
    tirador: [
        { id: 'arco_fenix', name: '🏹 Arco del Fénix', price: 31000, bonus: 0.12, activities: ['work', 'hunt', 'raid'] },
        { id: 'visor_halcon', name: '🦅 Visor del Halcón', price: 36000, bonus: 0.12, activities: ['hunt', 'crime', 'raid'] },
        { id: 'ballesta_fenix', name: '🔥 Ballesta Fénix', type: 'arma', price: 50000, bonus: 0.08, activities: ['hunt', 'dungeon', 'raid'], dungeonDrop: true },
        { id: 'coraza_cazador', name: '🦅 Coraza del Cazador', type: 'armadura', price: 54000, bonus: 0.08, activities: ['hunt', 'work', 'raid'], dungeonDrop: true }
    ],
    paladin: [
        { id: 'maza_del_alba', name: '☀️ Maza del Alba', type: 'arma', price: 50000, bonus: 0.08, activities: ['work', 'dungeon', 'raid'], dungeonDrop: true },
        { id: 'egida_del_juramento', name: '🛡️ Égida del Juramento', type: 'armadura', price: 54000, bonus: 0.08, activities: ['dungeon', 'raid'], dungeonDrop: true }
    ]
};

const DUNGEON_LOOT = [
    { id: 'gema_lunar', name: '💎 Gema lunar', sellPrice: 4500 },
    { id: 'colmillo_dragon', name: '🦷 Colmillo de dragón', sellPrice: 6500 },
    { id: 'runa_antigua', name: '🔯 Runa antigua', sellPrice: 8000 },
    { id: 'corazon_golem', name: '🪨 Corazón de gólem', sellPrice: 10000 },
    { id: 'pergamino_perdido', name: '📜 Pergamino perdido', sellPrice: 12000 },
    { id: 'fragmento_abisal', name: '🌑 Fragmento abismal', sellPrice: 7200 },
    { id: 'escama_prismatica', name: '🐉 Escama prismática', sellPrice: 8600 },
    { id: 'polvo_estelar', name: '✨ Polvo estelar', sellPrice: 6800 },
    { id: 'reliquia_fantasma', name: '👻 Reliquia fantasma', sellPrice: 9400 },
    { id: 'semilla_ancestral', name: '🌱 Semilla ancestral', sellPrice: 10800 },
    { id: 'ojo_golem', name: '🔴 Ojo de gólem', sellPrice: 11500 }
];

const RPG_ITEMS = {
    potion: { name: '🧪 Poción de vida', type: 'consumible', minPrice: 100 },
    sword_iron: { name: '⚔️ Espada de hierro', type: 'arma', slot: 'weapon', power: 18, minPrice: 250 },
    armor_reinforced: { name: '🛡️ Armadura reforzada', type: 'armadura', slot: 'armor', defense: 12, minPrice: 500 },
    sword_abyss: { name: '🌑 Espada abismal', type: 'arma', slot: 'weapon', power: 48, minPrice: 2500 },
    armor_dragon: { name: '🐉 Armadura de escamas', type: 'armadura', slot: 'armor', defense: 25, minPrice: 3000 },
    amulet_lunar: { name: '🌙 Amuleto lunar', type: 'reliquia', slot: 'accessory', power: 14, defense: 8, minPrice: 1800 }
};

const RPG_MATERIALS = {
    hierba: { name: '🌿 Hierba', minPrice: 50 },
    agua: { name: '💧 Agua', minPrice: 30 },
    hierro: { name: '⛓️ Hierro', minPrice: 100 },
    carbon: { name: '🪨 Carbón', minPrice: 60 },
    piel: { name: '🦬 Piel', minPrice: 90 },
    escama: { name: '🦎 Escama', minPrice: 140 },
    runa: { name: '🔯 Runa', minPrice: 220 }
};

const RPG_GATHERING_LOOT = {
    'mine-carbón': { name: '🪨 Carbón de mina' },
    'mine-hierro': { name: '⛓️ Hierro de mina' },
    'mine-oro': { name: '🪙 Pepita de oro' },
    'mine-diamante': { name: '💎 Diamante' },
    'mine-redstone': { name: '🔴 Redstone' },
    'fish-bacalao': { name: '🐟 Bacalao' },
    'fish-salmón': { name: '🐠 Salmón' },
    'fish-pez globo': { name: '🐡 Pez globo' },
    'fish-tesoro': { name: '🧰 Tesoro submarino' },
    'fish-libro encantado': { name: '📘 Libro encantado' },
    'hunt-conejo': { name: '🐇 Conejo' },
    'hunt-jabalí': { name: '🐗 Jabalí' },
    'hunt-ciervo': { name: '🦌 Ciervo' },
    'hunt-zorro': { name: '🦊 Zorro' },
    'hunt-lobo salvaje': { name: '🐺 Lobo salvaje' }
};

const MERCHANT_ITEMS = {
    pico: { name: '⛏️ Pico', price: 2500, durability: 15, aliases: ['pico', 'pico minero', 'pickaxe'] },
    espada: { name: '⚔️ Espada de herramienta', price: 3000, durability: 12, aliases: ['espada', 'sword'] },
    cana: { name: '🎣 Caña de pescar', price: 2200, durability: 15, aliases: ['cana', 'caña', 'vara', 'rod'] }
};

module.exports = { CLASS_EQUIPMENT, DUNGEON_LOOT, RPG_ITEMS, RPG_MATERIALS, RPG_GATHERING_LOOT, MERCHANT_ITEMS };
