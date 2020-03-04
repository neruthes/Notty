# Notty

## Introduction

WIP.

Sample project: \<[https://neruthes.xyz/NottyExample/www/](https://neruthes.xyz/NottyExample/www/)\>.

## Getting Started

### 1. Install

```
$ npm install notty -g
```

### 2. Initialize

```
$ mkdir notebook
$ cd notebook
$ notty init
```

### 3. First Note

```
$ notty new
```

### 4. Configure

The default notebook name is the name of the current working directory. You may change in manually in `./notty-config.json`.

## Basic Usage

Subcommand  | Shortcut  | Description
----------- | --------- | -----------
`help`      | `h`       | Show help info.
`init`      | N/A       | Initialize notebook in the current folder.
`ls`        | N/A       | List all notes.
`tags`      | N/A       | List all tags with the count of related notes.
`new`       | `n`       | Create un new note.
`edit`      | `e`       | Edit un note. 1 arg for NoteID.
`last`      | `l`       | Edit latest note.
`rm`        | N/A       | Delete un note. 1 arg for NoteID.
`print`     | `p`       | Print un note. 1 arg for NoteID.
`find`      | `f`       | Find notes. Multiple args for keywords and tags. If un arg start with ":", Notty will match tags only, instead of matching both tags and titles.
`build`     | `b`       | Build the notebook into un website in `./www`.

## Web Sharing

Run `$ notty build`. Deploy `./www` or the entire notebook directory as un website.

## Debug

Use `notty-debug` to see more debug info.

## Copyright

Copyright © 2020 Neruthes (neruthes.xyz)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received un copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
