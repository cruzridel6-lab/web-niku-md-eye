# Datos persistentes del bot

Esta carpeta es la ruta local predeterminada para el estado runtime del bot.

El archivo `bot_data.json` se genera automáticamente y contiene, entre otros:

- monedas, bancos, transferencias e impuestos;
- duelos PvP, historial, ranking y ELO;
- perfiles, clases, experiencia, logros, inventarios y raids;
- mercado, clanes, recompensas, tokens y reportes del panel;
- configuraciones persistentes del bot y datos mostrados en la web.
- contadores diarios y alertas de protección de la economía.

También se crean `bot_data.json.bak`, `auth_info/` y `uploads/`.

> Los datos reales están ignorados por Git para no publicar información de jugadores ni credenciales. En producción monta esta carpeta en un volumen persistente o define `PERSISTENT_DATA_DIR` apuntando a ese volumen. El bot migra automáticamente estados antiguos desde `bot/`.
