#!/usr/bin/env node

var debugMode = false;
if (process.argv[1].replace(/.+\//, '').indexOf('debug') > -1) {
    debugMode = true;
};

const argv = process.argv.slice(2);

const pkg = require('./package.json');
var config = undefined;

const fs = require('fs');
const child_process = require('child_process');
const exec = require('child_process').exec;

// ----------------------------------------
// Utils
// ----------------------------------------

const c = {
    end: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m'
};

const debug = function (arg1, arg2) {
    if (debugMode) {
        console.log('\n[debug]--------- ' + arg1);
        console.log(arg2);
        console.log('------------------------------[/debug]\n');
    };
};

const ulog = function (str) {
    console.log(str);
    fs.appendFile('notty.log', str + '\n', function () {});
};

// ----------------------------------------
// Templates
// ----------------------------------------

const noteDefaultText = `Title: This is an optional title\nTags: sample-tag-01 sample-tag-02\n------\n\nUse 6 hyphens to declare metadata area. Omitting metadata is ok.`;

const commonSeperationLine = '\n--------------------------------\n';

// ----------------------------------------
// Core
// ----------------------------------------

var nottyDatabase = null;

const core = {};

core.loadConfig = function () {
    config = JSON.parse(fs.readFileSync('notty-config.json').toString());
};

core.loadDatabase = function () {
    if (!nottyDatabase) {
        nottyDatabase = JSON.parse(fs.readFileSync('notty-database.json').toString());
        nottyDatabase.index = Object.keys(nottyDatabase.notes).sort().map(key => nottyDatabase.notes[key]);
        debug('nottyDatabase.index', nottyDatabase.index);
    };
};

core.timenow = function () {
    // 2020-03-03-032020
    return (new Date()).toISOString().replace(/[^\dT-]/g, '').replace('T', '-').slice(0,17);
};

core.recordNoteInDatabase = function (noteId, noteText) {
    core.loadDatabase();
    var noteObj = core.parseNoteRawStr(noteText);
    nottyDatabase.notes[noteId] = {
        id: noteId,
        title: noteObj.title,
        md_Tags: noteObj.md_Tags
    };
    fs.writeFileSync('notty-database.json', JSON.stringify({
        notes: nottyDatabase.notes
    }, null, '\t'));
};

core.pullNoteLatestInfo = function (noteId) {
    var noteText = core.getNoteRawStr(noteId);
    core.recordNoteInDatabase(noteId, noteText);
    return core.parseNoteRawStr(noteText);
};

core.saveNoteInStorage = function (noteId, noteText) {
    fs.writeFileSync(`database/${noteId}.md`, noteText);
};

core.openNoteInEditor = function (noteId, callback) {
    var editor = config.myEditor || 'nano';
    var child = child_process.spawn(editor, [`database/${noteId}.md`], {
        stdio: 'inherit'
    });
    child.on('exit', function (e, code) {
        callback(e, code, noteId);
    });
};

core.getNoteRawStr = function (noteId) {
    var rawNote = fs.readFileSync(`database/${noteId}.md`).toString();
    return rawNote;
};

core.parseNoteDbInfoByObj = function (noteDbInfo) {
    return {
        hasMetadata: true,
        id: noteDbInfo.id,
        md_Tags: noteDbInfo.md_Tags,
        title: noteDbInfo.title
    };
};

core.parseNoteRawStr = function (noteText) {
    var slicer = '\n------\n\n';
    var hasMetadata = (noteText.indexOf(slicer) > -1) ? true : false;
    var noteObj = {
        hasMetadata: false,
        raw: noteText.trim(),
        md_Tags: [],
        content: noteText.trim(),
        title: noteText.trim().split('\n')[0].slice(0, 50)
    };
    if (hasMetadata) {
        noteObj.hasMetadata = true;
        noteObj.content = noteText.split(slicer)[1];
        var firstLine = noteObj.content.trim().split('\n')[0];
        noteObj.title = firstLine.slice(0, 50) + (firstLine.length > 49 ? '...' : '');
        noteText.split(slicer)[0].split('\n').map(function (x) {
            if (x.indexOf('Tags: ') === 0) {
                noteObj.md_Tags = x.slice(6).split(' ');
            };
            if (x.indexOf('Title: ') === 0) {
                noteObj.title = x.slice(7);
            };
        });
    };
    return noteObj;
};
debug('core.parseNoteRawStr(noteDefaultText)', core.parseNoteRawStr(noteDefaultText));

core.serializeNote = function (noteObj) {
    if (noteObj.hasMetadata) {
        return `Title: ${noteObj.title}\nTags: ${noteObj.md_Tags.join(' ')}\n------\n\n` + noteObj.content
    } else {
        return noteObj.content;
    };
};

core.noteSummaryStd = function (noteObj, noteId) {
    return [
        `[${noteId}]  ${c.green}${noteObj.title}${c.end}`,
        `Tags:    ${noteObj.md_Tags.map(x => c.yellow + x + c.end).join('  ')}\n`
    ].join('\n');
};

// ----------------------------------------
// Handlers
// ----------------------------------------

let app = {};

app.help = function () {
    console.log(
`
${c.green}Notty${c.end} (v${pkg.version})
-----------------------------------------------------------------
Copyright © 2020 Neruthes <i@neruthes.xyz>

    Notty is a free software (GNU AGPL 3.0). The source code is
    available at <https://github.com/neruthes/notty>. See license
    information in the source code repository.
-----------------------------------------------------------------

HOW TO USE

$ notty ${c.green}init${c.end}                Initialize project in the current directory.
$ notty ${c.green}ls${c.end}                  See the list of notes.
$ notty ${c.green}new${c.end}                 Create a new note.
$ notty ${c.green}edit${c.end} noteId         Edit a new note.
$ notty ${c.green}last${c.end}                Edit most recent note.
$ notty ${c.green}find${c.end} keyword        Filter notes by keyword (tag or title).
$ notty ${c.green}find${c.end} :tag-name      Filter notes by tag.
`
    );
};

app.init = function () {
    if (fs.existsSync('.notty-home')) {
        console.log('>\tProject already exists.');
        return 1;
    };
    var projName = process.cwd().replace(/^\//, '').split('/').reverse()[0];
    var randKey = (new Array(3)).fill(1).map(x => Math.random().toString(36).slice(2)).join('');
    exec(
        `touch .notty-home notty-config.json notty-database.json notty.log;
        mkdir database www;
        touch database/.gitkeep www/.gitkeep;
        echo "notty--${pkg.version}" > .notty-home`
    );
    fs.writeFileSync('notty-config.json', JSON.stringify({
        name: projName,
        deployKey: randKey,
        myEditor: 'nano'
    }, null, '\t'));
    var helloWorldNoteId = core.timenow();
    var initialDatabaseTemplate = { "notes": {} };
    initialDatabaseTemplate.notes[helloWorldNoteId] = {
        id: helloWorldNoteId,
        title: 'Sample Note',
        md_Tags: [ 'hello', 'world' ]
    };
    fs.writeFileSync('notty-database.json', JSON.stringify(initialDatabaseTemplate, null, '\t'));
    console.log(`>\tProject "${projName}" initialized.`);
    core.saveNoteInStorage(helloWorldNoteId, noteDefaultText);
    core.recordNoteInDatabase(helloWorldNoteId, noteDefaultText);
    core.pullNoteLatestInfo(helloWorldNoteId);
    console.log(`>\tUse "${c.green}notty new${c.end}" to create your first note.`);
};

app.ls = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadConfig();
    var noteId = core.timenow();
    core.loadDatabase();
    var result = nottyDatabase.index.map(function (x, i) {
        return core.noteSummaryStd(core.parseNoteDbInfoByObj(x), x.id);
    });
    var titleBar = `\n\n>\tFound ${c.green}${result.length}${c.end} notes as shown above.`
    console.log(commonSeperationLine + result.join('\n') + titleBar);
};

app.new = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadConfig();
    core.loadDatabase();
    var noteId = core.timenow();
    core.saveNoteInStorage(noteId, noteDefaultText);
    core.recordNoteInDatabase(noteId, noteDefaultText);
    core.openNoteInEditor(noteId, function (e, code) {
        debug('core.openNoteInEditor: e, code', {e: e, code: code});
        core.pullNoteLatestInfo(noteId);
        console.log(`>\tYour note [${noteId}]\n>\t"${c.green}${core.pullNoteLatestInfo(noteId).title}${c.end}" has been added.`);
    });
};

app._edit = function (noteId) {
    core.loadConfig();
    core.loadDatabase();
    core.openNoteInEditor(noteId, function (e, code) {
        debug('core.openNoteInEditor: e, code', {e: e, code: code});
        core.pullNoteLatestInfo(noteId);
        console.log(`>\tYour note [${noteId}]\n>\t"${c.green}${core.pullNoteLatestInfo(noteId).title}${c.end}" has been saved.`);
        console.log(core.noteSummaryStd(nottyDatabase.index.filter(x => x.id = noteId)[0], noteId));
    });
}

app.edit = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    var noteId = argv[1];
    app._edit(noteId);
};

app.last = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadDatabase();
    var noteId = nottyDatabase.index.slice(0).reverse()[0].id;
    app._edit(noteId);
};

app.find = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadDatabase();
    var crit = argv[1];
    var tag = crit.slice(1);
    var result = nottyDatabase.index.filter(function (x) {
        if (crit[0] === ':') { // Tag only
            if (x.md_Tags.indexOf(tag) !== -1) { return true; };
        } else { // Including title
            if (x.md_Tags.indexOf(crit) !== -1) { return true; };
            if (x.title.toLowerCase().indexOf(crit.toLowerCase()) !== -1) { return true; };
        };
    }).map(function (x) {
        return core.noteSummaryStd(x, x.id);
    });
    var titleBar = `\n\n>\tFound ${c.green}${result.length}${c.end} notes with criteria "${crit}" as shown above.`
    console.log(commonSeperationLine + result.join('\n') + titleBar);
};

app.update = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    var noteId = argv[1].replace('.md', '');
    var noteObj = core.pullNoteLatestInfo(noteId);
    console.log(`>\tUpdated:`);
    console.log(core.noteSummaryStd(noteObj, noteId));
};

// ----------------------------------------
// Entry
// ----------------------------------------

const subcommandMapTable = {
    help: 'help',
    init: 'init',
    ls: 'ls',

    new: 'new',
    n: 'new',

    edit: 'edit',
    e: 'edit',

    last: 'last',
    l: 'last',

    find: 'find',

    update: 'update'
};

if (argv[0]) {
    if (subcommandMapTable[argv[0]]) { // Subdommand exists
        app[subcommandMapTable[argv[0]]]();
    } else {
        app.help();
    };
} else {
    app.help();
};
