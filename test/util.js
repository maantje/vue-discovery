const vscode = require('vscode');
const path = require('path');


function position(line, char) {
    return new vscode.Position(line, char);
}

function range(startLine, startChar, endLine, endChar) {
    return new vscode.Range(position(startLine, startChar), position(endLine, endChar));
}

function sameLineRange(line, startChar, endChar) {
    return new vscode.Range(position(line, startChar), position(line, endChar));
}

function location(uri, startLine, startChar, endLine, endChar) {
    return new vscode.Location(uri, range(startLine, startChar, endLine, endChar));
}

function sameLineLocation(uri, line, startChar, endChar) {
    return new vscode.Location(uri, sameLineRange(line, startChar, endChar));
}

const getDocPath = (p) => {
    return path.resolve(__dirname, 'fixture/src', p);
};

const getDocUri = (p) => {
    return vscode.Uri.file(getDocPath(p));
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function showFile(docUri) {
    const doc = await vscode.workspace.openTextDocument(docUri);
    return await vscode.window.showTextDocument(doc);
}

module.exports = {
    position,
    range,
    sameLineRange,
    sameLineLocation,
    location,
    getDocPath,
    getDocUri,
    sleep,
    showFile,
};