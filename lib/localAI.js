'use strict';

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const intents = [
    {
        test: text => /hola|buenas|saludos|hey|ola/.test(text),
        answer: '👋 ¡Hola, aventurero! Puedo ayudarte con comandos, clases, monedas, misiones, herramientas, duelos y mazmorras. Escribe *.ai ayuda* para ver ejemplos.'
    },
    {
        test: text => /comando|menu|ayuda|que puedo hacer|funciones/.test(text),
        answer: '📚 Comandos principales:\n\n• *.perfil* — Ver tu personaje\n• *.clase guerrero* — Elegir clase\n• *.work* — Ganar monedas y XP\n• *.mercader* — Comprar herramientas\n• *.misiones* — Ver objetivos\n• *.mazmorra* — Explorar y obtener botín\n• *.inventario* — Ver tus objetos\n• *.baltop* — Ver el ranking\n\nTambién puedes usar *.rpg* para abrir el menú RPG.'
    },
    {
        test: text => /nivel|experiencia|xp|subir/.test(text),
        answer: '⭐ Para subir de nivel consigue XP usando *.work*, *.combate*, *.explorar*, *.minar*, *.pescar*, *.cazar* y *.mazmorra*. Revisa tu progreso con *.nivel*.'
    },
    {
        test: text => /moneda|dinero|oro|coin|ganar|rico|plata/.test(text),
        answer: '🪙 Puedes ganar monedas con *.daily*, *.work*, *.explorar*, *.minar*, *.pescar*, *.cazar* y *.mazmorra*. Guarda parte de tu saldo con *.deposit <cantidad>*.'
    },
    {
        test: text => /clase|guerrero|mago|picaro|tirador|personaje/.test(text),
        answer: '⚔️ Las clases disponibles son:\n\n• *.clase guerrero* — Resistencia y combate\n• *.clase mago* — Poder arcano\n• *.clase picaro* — Botín y sigilo\n• *.clase tirador* — Cacería y distancia\n\nLa clase se elige una sola vez, así que elígela con cuidado.'
    },
    {
        test: text => /mazmorra|dungeon|monstruo|botin|botin/.test(text),
        answer: '🏰 Para entrar a la mazmorra necesitas una ⚔️ espada. Cómprala con *.mercader espada* y luego usa *.mazmorra*. Tienes hasta 3 entradas diarias y la mazmorra puede necesitar reparación con *.reparar*.'
    },
    {
        test: text => /pico|minar|mineria/.test(text),
        answer: '⛏️ Compra un pico con *.mercader pico* y después usa *.minar*. El pico tiene durabilidad y se rompe después de varios usos.'
    },
    {
        test: text => /pescar|cana|pesca/.test(text),
        answer: '🎣 Compra una caña con *.mercader cana* y luego usa *.pescar*. La caña se desgasta con cada uso.'
    },
    {
        test: text => /cazar|espada|herramienta|mercader|tienda/.test(text),
        answer: '🧑‍🌾 Usa *.mercader* para ver la tienda. Compra *.mercader pico* para minar, *.mercader espada* para cazar o entrar a la mazmorra y *.mercader cana* para pescar.'
    },
    {
        test: text => /mision|objetivo|diaria/.test(text),
        answer: '📜 Usa *.misiones* para ver tus objetivos diarios y semanales. Las actividades se actualizan automáticamente y entregan monedas y XP al completarlas.'
    },
    {
        test: text => /duelo|pvp|apostar|retar/.test(text),
        answer: '⚔️ Para retar a alguien usa *.duelo @usuario 200*. La otra persona puede pulsar Aceptar o escribir *.duelo aceptar*. También puede rechazarlo o tú puedes cancelarlo.'
    },
    {
        test: text => /inventario|bolsa|objetos|equipo/.test(text),
        answer: '🎒 Usa *.inventario* para ver consumibles, materiales, botín y equipo. Usa *.mercader* para comprar herramientas y equipamiento de tu clase.'
    },
    {
        test: text => /clan|guerra/.test(text),
        answer: '⚔️ Usa *.clan* para ver clanes. Puedes crear uno con *.clan crear <nombre>*, unirte con *.clan unirse <nombre>* y consultar guerras desde el menú del clan.'
    }
];

function answerLocal(prompt, memories = []) {
    const text = normalize(prompt).trim();
    if (!text) return '❌ Escribe una pregunta para la IA local.';
    const match = intents.find(intent => intent.test(text));
    const base = match
        ? match.answer
        : '🤖 Soy la IA local de NIKU MD. Todavía no tengo una respuesta para eso, pero puedo ayudarte con comandos RPG, clases, monedas, misiones, herramientas, duelos y mazmorras. Prueba *.ai ¿cómo gano monedas?* o escribe *.rpg*.';
    const tokens = text.split(/[^a-z0-9ñ]+/).filter(token => token.length >= 4);
    const related = [...new Set((memories || []).filter(Boolean).map(String))].filter(memory => {
        const normalizedMemory = normalize(memory);
        return tokens.some(token => normalizedMemory.includes(token));
    }).slice(0, 2);
    return related.length ? `${base}\n\n🧠 *Recuerdo relacionado:*\n${related.map(item => `• ${item}`).join('\n')}` : base;
}

module.exports = { answerLocal };
