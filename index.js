#!/usr/bin/env node

var debugMode = false;
if (process.argv[1].replace(/.+\//, '').indexOf('debug') > -1) {
    debugMode = true;
};

const argv = process.argv.slice(2);

const pkg = require('./package.json');
var config = undefined;

const fs = require('fs');
const crypto = require('crypto');
const child_process = require('child_process');
const exec = require('child_process').exec;

if (fs.existsSync('.notty-home')) {
    fs.writeFileSync('.notty-home', 'notty--' + pkg.version);
};

// ----------------------------------------
// Utils
// ----------------------------------------

const rightpad = function (str, len, pad) {
    return (str.length > len) ? str : ( str+(new Array(len-str.length)).fill(pad).join('') );
};

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

const noteDefaultText = `Title: Untitled\nTags: tag1 tag2\n------\n\nUse 6 hyphens to declare metadata area. Omitting metadata is ok.`;

const commonSeperationLine = '\n--------------------------------\n';

// ----------------------------------------
// Core
// ----------------------------------------

var nottyDatabase = null;

const core = {};

core.renderHtml = function (template, vars) {
    return template.replace(/__[_\w]+__/g, function (word) {
        return vars[word];
    });
};

core.loadConfig = function () {
    config = JSON.parse(fs.readFileSync('notty-config.json').toString());
};

core.loadDatabase = function () {
    if (!nottyDatabase) {
        nottyDatabase = JSON.parse(fs.readFileSync('notty-database.json').toString());
        nottyDatabase.notes_index = Object.keys(nottyDatabase.notes).sort().map(function (noteId) {
            nottyDatabase.notes[noteId].md_Tags = nottyDatabase.notes[noteId].md_Tags.map(function (tag) {
                return tag.toLowerCase();
            });
            return nottyDatabase.notes[noteId]
        });
        debug('nottyDatabase.notes_index', nottyDatabase.notes_index);
        nottyDatabase.tags = {};
        nottyDatabase.notes_index.map(function (obj) {
            obj.md_Tags.map(function (tag) {
                if (Object.keys(nottyDatabase.tags).indexOf(tag) > -1) {
                    nottyDatabase.tags[tag] = nottyDatabase.tags[tag] + 1;
                } else {
                    nottyDatabase.tags[tag] = 1;
                };
            })
        });
        debug('nottyDatabase.tags', nottyDatabase.tags);
        nottyDatabase.tags_index = Object.keys(nottyDatabase.tags).sort().map(function (x) {
            return {
                name: x,
                count: nottyDatabase.tags[x]
            };
        });
        debug('nottyDatabase.tags_index', nottyDatabase.tags_index);
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
        md_Tags: noteObj.md_Tags.map(x => x.toLowerCase())
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
                noteObj.md_Tags = x.slice(6).split(' ').map(x => x.toLowerCase());
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
        return `Title: ${noteObj.title}\nTags: ${noteObj.md_Tags.sort().join(' ')}\n------\n\n` + noteObj.content
    } else {
        return noteObj.content;
    };
};

core.sanitizeNote = function (noteId) {
    var noteObj = core.parseNoteRawStr(core.getNoteRawStr(noteId));
    var result = core.serializeNote(noteObj);
    fs.writeFileSync(`database/${noteId}.md`, result);
};

core.noteSummaryStd = function (noteObj, noteId) {
    return [
        `[${noteId}]  ${c.green}${noteObj.title}${c.end}`,
        `Tags:    ${noteObj.md_Tags.map(x => c.yellow + x + c.end).join('  ')}\n`
    ].join('\n');
};
core.noteSummaryPlain = function (noteObj, noteId) {
    return [
        `[${noteId}]  ${noteObj.title}`,
        `Tags:    ${noteObj.md_Tags.join('  ')}\n`
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
    available at <https://github.com/neruthes/Notty>. See license
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
    fs.writeFileSync('.gitignore', 'www');
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
    fs.writeFileSync('notty-database.json', JSON.stringify(initialDatabaseTemplate, null, '\t'));
    console.log(`>\tProject "${projName}" initialized.`);
    console.log(`>\tUse "${c.green}notty new${c.end}" to create your first note.`);
};

app.ls = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadConfig();
    var noteId = core.timenow();
    core.loadDatabase();
    var result = nottyDatabase.notes_index.map(function (x, i) {
        return core.noteSummaryPlain(core.parseNoteDbInfoByObj(x), x.id);
    });
    var titleBar = `\n\n>\tFound ${result.length} notes as shown below.`
    fs.writeFileSync('.notty-ls', titleBar + commonSeperationLine + result.join('\n') + commonSeperationLine + '[EOF]');
    var child = child_process.spawn('less', [`.notty-ls`], {
        stdio: 'inherit'
    });
    child.on('exit', function (e, code) {
        exec(`rm .notty-ls;`);
    });
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
        core.sanitizeNote(noteId);
        console.log(`\n>\tYour note [${noteId}]\n>\t"${c.green}${core.pullNoteLatestInfo(noteId).title}${c.end}" has been saved.\n` + commonSeperationLine);
        // console.log(core.noteSummaryStd(nottyDatabase.notes[noteId], noteId) + commonSeperationLine);
    });
};

app.edit = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    var noteId = argv[1];
    app._edit(noteId);
};

app.last = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadDatabase();
    var noteId = nottyDatabase.notes_index.slice(0).reverse()[0].id;
    app._edit(noteId);
};

app.rm = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    var noteId = argv[1];
    core.loadDatabase();
    var title = nottyDatabase.notes[noteId].title;
    delete nottyDatabase.notes[noteId];
    fs.writeFileSync('notty-database.json', JSON.stringify({notes: nottyDatabase.notes}, null, '\t'));
    fs.unlinkSync(`database/${noteId}.md`);
    console.log(`>\tDeleted [${noteId}] "${c.green}${title}${c.end}".`);
};

app.print = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    var noteId = argv[1];
    var txt = fs.readFileSync(`database/${noteId}.md`).toString();
    console.log(txt);
};

app.find = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadDatabase();
    var crits = argv.slice(1);
    var tmpResult = nottyDatabase.notes_index;
    for (var i = 0; i < crits.length; i++) {
        var crit = crits[i];
        tmpResult = tmpResult.filter(function (x) {
            if (crit[0] === ':') { // Tag only
                if (x.md_Tags.indexOf(crit.slice(1)) !== -1) { return true; };
            } else { // Including title
                if (x.md_Tags.indexOf(crit) !== -1) { return true; };
                if (x.title.toLowerCase().indexOf(crit.toLowerCase()) !== -1) { return true; };
            };
        });
    };
    var result = tmpResult.map(function (x) {
        return core.noteSummaryStd(x, x.id);
    });
    var titleBar = `\n\n>\tFound ${c.green}${result.length}${c.end} notes with criteria "${c.green}${crits.join(' ')}${c.end}" as shown above.`
    console.log(commonSeperationLine + result.join('\n') + commonSeperationLine + titleBar);
};

app.tags = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadDatabase();
    var result = nottyDatabase.tags_index.map(function (tagInfo) {
        return `${rightpad(tagInfo.name, 16, ' ')}${c.green}${tagInfo.count}${c.end}`;
    });
    var titleBar = `\n\n>\tFound ${c.green}${result.length}${c.end} tags as shown above.`
    console.log(`Tag             Count` + commonSeperationLine + result.join('\n') + commonSeperationLine + titleBar);
};

app.build = function () {
    if (!fs.existsSync('.notty-home')) { console.log(`>\t${c.red}Project does not exist.${c.end}`); return 1; };// Skip invalid dir
    core.loadConfig();
    core.loadDatabase();
    exec(`mkdir www/tags www/notes; touch www/tags/.gitkepp www/notes/.gitkepp`);
    fs.writeFileSync('www/custom.css', '');
    fs.writeFileSync('www/base.css', fs.readFileSync(`${__dirname}/html-templates/base.css`));

    const getKeyForNote = function (noteId) {
        return crypto.createHash('sha256').update(
            '7f71833a-370c-4729-be3e-5a460917231f--' +
            config.deployKey +
            noteId
        ).digest('base64').replace(/[\w\d]/g, '').slice(20);
    };
    const getTimeStringForNote = function (noteId) {
        return [noteId.slice(0, 10), noteId.slice(11).replace(/(\d{2})/g, ':$1').slice(1)].join(' ');
    };
    var html = {};
    ['index','tags','note','item_note','item_note_forIndex','tag','item_tag','inline_tag','inline_tag_forIndex'].map(function (x) {
        html[x] = fs.readFileSync(`${__dirname}/html-templates/${x}.html`).toString();
    });
    // Note
    nottyDatabase.notes_index.map(function (noteInfo) {
        var noteId = noteInfo.id;
        var noteObj = core.parseNoteRawStr(core.getNoteRawStr(noteId));
        var noteHtml = core.renderHtml(html.note, {
            __VER__: pkg.version,
            __ID__: noteId,
            __TIME__: getTimeStringForNote(noteId),
            __TITLE__: noteObj.title,
            __SITENAME__: config.name,
            __TAGS__: noteObj.md_Tags.map(tag => core.renderHtml(html.inline_tag, {__TAG__: tag.toLowerCase()})).join(''),
            __CONTENT__: require('markdown-it')().render(noteObj.content.trim())
        });
        fs.writeFileSync(`www/notes/${noteId}.html`, noteHtml);
    });
    // Index
    var noteItemsInIndexPage = nottyDatabase.notes_index.slice(0).reverse().map(function (noteInfo) {
        var noteId = noteInfo.id;
        var noteHtml = core.renderHtml(html.item_note_forIndex, {
            __ID__: noteId,
            __TIME__: getTimeStringForNote(noteId),
            __TITLE__: noteInfo.title,
            __TAGS__: noteInfo.md_Tags.map(tag => core.renderHtml(html.inline_tag_forIndex, {__TAG__: tag.toLowerCase()})).join(''),
        });
        return noteHtml;
    }).join('');
    fs.writeFileSync(`www/index.html`, core.renderHtml(html.index, {
        __VER__: pkg.version,
        __SITENAME__: config.name,
        __CONTENT__: noteItemsInIndexPage
    }));
    // Tags
    var tagItemsInTagsPage = nottyDatabase.tags_index.map(function (tagObj) { // tagObj = { name: 'tag', count: 1 }
        var tagDetailPageContent = nottyDatabase.notes_index.slice(0).reverse().filter(noteObj => noteObj.md_Tags.indexOf(tagObj.name) > -1).map(function (noteInfo) {
            var noteHtml = core.renderHtml(html.item_note, {
                __ID__: noteInfo.id,
                __TIME__: getTimeStringForNote(noteInfo.id),
                __TITLE__: noteInfo.title,
                __TAGS__: noteInfo.md_Tags.map(tag => core.renderHtml(html.inline_tag, {__TAG__: tag.toLowerCase()})).join(''),
            });
            return noteHtml;
        }).join('');
        fs.writeFileSync(`www/tags/${tagObj.name}.html`, core.renderHtml(html.tag, {
            __VER__: pkg.version,
            __SITENAME__: config.name,
            __TAG__: tagObj.name.toLowerCase(),
            __COUNT__: tagObj.count,
            __CONTENT__: tagDetailPageContent,
        }));
        return core.renderHtml(html.item_tag, {
            __TAG__: tagObj.name.toLowerCase(),
            __COUNT__: tagObj.count
        });
    }).join('');
    fs.writeFileSync(`www/tags.html`, core.renderHtml(html.tags, {
        __VER__: pkg.version,
        __SITENAME__: config.name,
        __CONTENT__: tagItemsInTagsPage
    }));
    console.log(`>\tNotebook built. See ${c.green}"/www"${c.end} directory.`);
};

// ----------------------------------------
// Entry
// ----------------------------------------

const subcommandMapTable = {
    help: 'help',
    h: 'help',

    init: 'init',
    ls: 'ls',
    tags: 'tags',

    new: 'new',
    n: 'new',

    edit: 'edit',
    e: 'edit',

    last: 'last',
    l: 'last',

    rm: 'rm',

    print: 'print',
    p: 'print',

    find: 'find',
    f: 'find',

    build: 'build',
    b: 'build'
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
