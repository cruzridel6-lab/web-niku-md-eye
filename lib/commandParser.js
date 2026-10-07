'use strict';

function normalizeActionCommand(text, prefix = '.') {
    const value = String(text || '');
    if (value.startsWith('menu_')) return `${prefix}${value.slice(5)}`;
    if (value.startsWith('cmd_')) return `${prefix}${value.slice(4)}`;
    return value;
}

function parseCommandInput(text, prefix = '.') {
    const value = String(text || '');
    if (!prefix || !value.toLowerCase().startsWith(String(prefix).toLowerCase())) return null;
    const commandBody = value.slice(String(prefix).length).trimStart();
    const commandText = `${prefix}${commandBody}`;
    const args = commandBody ? commandBody.split(/\s+/) : [];
    return {
        commandBody,
        commandText,
        cmd: commandText.toLowerCase(),
        args,
        commandName: String(args[0] || '').toLowerCase(),
        q: args.slice(1).join(' ')
    };
}

module.exports = { normalizeActionCommand, parseCommandInput };
