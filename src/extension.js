const vscode = require('vscode');
const glob = require('glob');
var fs = require('fs');

let jsFiles = [];

const { CompletionItemKind, CompletionItem, SnippetString } = vscode;
/**
 * Finds all .vue files in the src directory
 */
function getVueFiles() {
    return new Promise((resolve, reject) => {
        glob(getRootPath() + '/src/**/*.vue', (err, res) => {
            if (err) {
                return reject(err);
            }

            resolve(res);
        });
    });
}

/**
 * Finds all .js files in the src directory
 */
function getJsFiles() {
    return new Promise((resolve, reject) => {
        glob(getRootPath() + '/src/**/*.js', (err, res) => {
            if (err) {
                return reject(err);
            }

            resolve(res);
        });
    });
}



/**
 * Retrieve the component name from a path
 * eg src/components/Table.vue returns Table
 * @param {String} file
 */
function retrieveComponentNameFromFile(file) {
    const parts = file.split('/');

    return parts[parts.length - 1].split('.')[0];
}

/**
 * Retrieve the component name with directory
 * eg src/components/Table.vue returns components/Table.vue
 * @param {String} file
 */
function retrieveWithDirectoryInformationFromFile(file) {
    const parts = file.split('/');

    return parts.slice(parts.length - 2, parts.length).join('/');
}

/**
 * Creates a completion item for a components from a path
 * @param {String} file
 */
function createComponentCompletionItem(file) {
    const fileName = retrieveComponentNameFromFile(file);
    const snippetCompletion = new CompletionItem(fileName, CompletionItemKind.Constructor);

    snippetCompletion.detail = retrieveWithDirectoryInformationFromFile(file);
    snippetCompletion.command = { title: 'Import file', command: 'vueDiscovery.importFile', arguments: [file, fileName] };

    // We don't want to insert anything here since this will be done in the importFile command
    snippetCompletion.insertText = '';

    return snippetCompletion;
}

function createPropCompletionItem(prop) {
    const snippetCompletion = new CompletionItem(prop, CompletionItemKind.Variable);

    snippetCompletion.insertText = new SnippetString(`${prop}="$0"`);

    return snippetCompletion;
}


function hasScriptTagInactiveTextEditor() {
    const text = vscode.window.activeTextEditor.document.getText();

    const scriptTagMatch = /<script/.exec(text);
    return scriptTagMatch && scriptTagMatch.index > -1;
}

function config(key) {
    return vscode.workspace
        .getConfiguration()
        .get(`vueDiscovery.${key}`);
}

/**
 * Parses the props from a SFC and returns them as an object
 * @param {String} content
 */
function parseMixinsFromContent(content) {
    const mixinsStart = /mixins: \[/.exec(content);

    if (!mixinsStart || mixinsStart.index === -1) {
        return false;
    }

    const toSearch = content.substring(mixinsStart.index, content.length);

    let foundEnd = false;

    let index = 0;

    while (!foundEnd) {
        ++index;

        if (toSearch[index] === ']') {
            foundEnd = true;
        }
    }

    return toSearch.substring(9, index).split(',').map(mixin => mixin.trim());
}


/**
 * Parses the props from a SFC and returns them as an object
 * @param {String} file
 */
function parsePropsFromSFC(file) {
    console.log(file);
    const content = fs.readFileSync(file,'utf8');
    console.log(content);

    const mixins = parseMixinsFromContent(content);
    let mixinProps = {};

    if (mixins) {
        mixinProps = mixins.reduce((accumulator, mixin) => {
            const file = jsFiles.find(file => file.includes(mixin));

            if (!file) {
                return accumulator;
            }

            return { ...accumulator, ...parsePropsFromSFC(file) };
        }, {});
    }


    const propsStartIndex = /props: {/.exec(content);
    console.log('propstartindex', propsStartIndex);
    if (!propsStartIndex || propsStartIndex.index === -1) {
        console.log('not found');
        return mixinProps;
    }

    const toSearch = content.substring(propsStartIndex.index, content.length);
    console.log('toSearch', toSearch);

    let hasNotFoundStart = true;
    let openingBrace = 0;
    let index = 0;

    while (openingBrace !== 0 || hasNotFoundStart) {
        if (toSearch[index] === '{') {
            hasNotFoundStart = false;
            ++openingBrace;
        }
        if (toSearch[index] === '}') {
            --openingBrace;
        }
        ++index;
    }

    console.log('props', { ...mixinProps,...eval(`({${toSearch.substring(0, index)}})`).props });

    // parseMixinsFromContent(content)
    return { ...mixinProps,...eval(`({${toSearch.substring(0, index)}})`).props };
}

/**
 * Returns an array of required props from a SFC
 * @param {String} file
 */
function parseRequiredPropsFromSfc(file) {
    const props = parsePropsFromSFC(file);

    if (!props) {
        return;
    }

    return Object.keys(props).filter(prop => {
        return props[prop].required;
    });
}

/**
 * Inserts the snippet for the component in the template section
 * @param {Object} editor
 * @param {String} file
 * @param {String} fileName
 */
function insertSippet(editor, file, fileName) {
    const requiredProps = parseRequiredPropsFromSfc(file);

    let tabStop = 1;

    let snippetString = requiredProps.reduce((accumulator, prop) => {
        return accumulator += ` :$${tabStop++}${prop}="$${tabStop++}"`;
    }, '');

    snippetString = `<${fileName}${snippetString}>$0</${fileName}>`;

    editor.insertSnippet(new SnippetString(snippetString));
}

/**
 * Inserts the import in the scripts section
 * @param {Object} editor
 * @param {String} file
 * @param {String} fileName
 */
async function insertImport(editor, file, fileName) {
    const document = editor.document;
    const text = document.getText();

    const match = /<script/.exec(text);

    const fileWithoutRootPath = file.replace(getRootPath() + '/', '');

    const aliases = findAliases();
    const aliasKey = Object.keys(aliases).find(alias => fileWithoutRootPath.startsWith(aliases[alias][0].replace('*', '')));

    let alias = null;

    if (aliasKey) {
        alias = { value: aliasKey.replace('*', ''), path: aliases[aliasKey][0].replace('*', '') };
    }

    let importPath = null;

    const path = require('path');
    const path2 = fileWithoutRootPath;
    const path3 = vscode.window.activeTextEditor.document.uri.fsPath.replace(getRootPath() + '/', '');

    const relativePath = path.relative(path.dirname(path3), path.dirname(path2));

    if (alias) {
        importPath = fileWithoutRootPath.replace(`${alias.path}`, alias.value);
    } else {
        importPath = `${relativePath}/${fileName}.vue`;
    }



    if (text.indexOf(`import ${fileName} from '${importPath}`) === -1) {
        const scriptTagPosition = document.positionAt(match.index);
        const insertPosition = new vscode.Position(scriptTagPosition.line + 1, 0);
        await editor.edit(edit => {
            edit.insert(insertPosition, `import ${fileName} from '${importPath}'\n`);
        });
    }
}

/**
 * Inserts the component in a new components section
 * @param {Object} editor
 * @param {String} text
 * @param {String} componentName
 */
async function insertComponents(editor, text, componentName) {
    const document = editor.document;
    const indentBase = editor.options.insertSpaces
        ? ' '.repeat(editor.options.tabSize)
        : '\t';
    const indent = indentBase.repeat(2);
    const match = /export[\s]*default[\s]*\{/.exec(text);

    if (match && match.index > -1) {
        const insertIndex = match.index + match[0].length;

        const propIndent = indentBase.repeat(1);
        let componentString = '';

        componentString = `\n${propIndent}components: {\n${indent}${componentName},\n${propIndent}},`;

        const position = document.positionAt(insertIndex);

        await editor.edit(edit => {
            edit.insert(position, componentString);
        });
    }
}

/**
 * Inserts the component in an existing components section
 * @param {Object} editor
 * @param {Object} match
 * @param {String} componentName
 */
async function insertInExistingComponents(editor, match, componentName) {
    const document = editor.document;
    const indentBase = editor.options.insertSpaces
        ? ' '.repeat(editor.options.tabSize)
        : '\t';
    const indent = indentBase.repeat(2);

    let matchInsertIndex = match[0].length;

    let found = false;

    while (!found) {
        matchInsertIndex--;

        if (/[\S]/.test(match[0].charAt(matchInsertIndex))) {
            found = true;
        }
    }

    const insertIndex = match.index + matchInsertIndex + 1;
    const insertPosition = document.positionAt(insertIndex);

    const componentString = `\n${indent}${componentName},`;

    await editor.edit(edit => {
        edit.insert(insertPosition, componentString);
    });
}

/**
 * Checks whether to create a new components section or append to an existing one and appends it
 * @param {Object} editor
 * @param {String} componentName
 */
async function insertComponent(editor, componentName) {
    const document = editor.document;
    const text = document.getText();
    const indentBase = editor.options.insertSpaces
        ? ' '.repeat(editor.options.tabSize)
        : '\t';
    const indent = indentBase.repeat(2);

    // Component already registered
    if (text.indexOf(`\n${indent}${componentName}`) !== -1) {
        return;
    }

    const match = /components( )*:( )*{[\s\S]*?(?=})/.exec(text);

    // Components not yet defined add section with component
    if (!match || match.index === -1) {
        return insertComponents(editor, text, componentName);
    }

    // Add the component to components
    insertInExistingComponents(editor, match, componentName);
}
function getLine(line) {
    const editor = vscode.window.activeTextEditor;
    const document = editor.document;
    const text = document.getText();


    return text.split('\n')[line];
}
function isPositionInBetweenTag(selector, position) {
    const editor = vscode.window.activeTextEditor;
    const document = editor.document;
    const text = document.getText();

    const start = text.indexOf(`<${selector}>`);
    const end = text.indexOf(`</${selector}>`);

    if (start === -1 || end === -1) {
        return false;
    }

    const startLine = document.positionAt(start).line;
    const endLine = document.positionAt(end).line;

    return position.line > startLine && position.line < endLine;
}
function isCursorInBetweenTag(selector) {
    const editor = vscode.window.activeTextEditor;
    return isPositionInBetweenTag(selector, editor.selection.active);
}

function getActiveEditorPosition() {
    const editor = vscode.window.activeTextEditor;

    return editor.selection.active;
}

function isCursorInTemplateSection() {
    return isCursorInBetweenTag('template');
}
function findAliases() {
    try {
        const { compilerOptions } = require(getRootPath() + '/jsconfig.json');

        return compilerOptions.paths;
    } catch (e) {
        return [];
    }
}
function getRootPath() {
    return config('rootDirectory')
        ? config('rootDirectory')
        : vscode.workspace.rootPath;
}
function getComponentNameForLine(line, character = null) {
    const matchTagName = (markup) => {
        const pattern = /<([^\s></]+)/;

        const match = markup.match(pattern);

        if (match) {
            return match[1];
        }

        return false;
    };

    let component = false;
    let lineToCheck = line;

    do {
        let lineContent = getLine(lineToCheck);

        if (lineToCheck === line && character) {
            lineContent = lineContent.substring(0, character);
        }

        component = matchTagName(lineContent);

        if (lineContent.includes('>') && lineContent.includes('<') && component === false) {
            return false;
        }

        if ((lineContent.includes('>') || lineContent.includes('</')) && component === false) {
            return false;
        }

        lineToCheck--;
    } while (component === false);

    return component;
}
async function getPropsForLine(line, character = null) {
    const component = getComponentNameForLine(line, character);

    if (!component) {
        return;
    }

    const files = await getVueFiles();

    const file = files.find(file => file.includes(component));

    if (!file) {
        return;
    }

    return parsePropsFromSFC(file);
}

function isCursorInsideComponent() {
    const position = getActiveEditorPosition();

    if (!position) {
        return false;
    }

    return getComponentNameForLine(position.line, position.character) !== false;
}
function activate(context) {
    vscode.languages.registerHoverProvider({ pattern: '**/*.vue' }, {
        async provideHover(document, position) {
            if (!isPositionInBetweenTag('template', position)) {
                return;
            }

            jsFiles = await getJsFiles();
            const props = await getPropsForLine(position.line);

            if (!props) {
                return;
            }


            return {
                contents: Object.keys(props).map(propName => {
                    const { required, type } = props[propName];
                    let hoverContent = '';

                    if (required) {
                        hoverContent += '(required) ';
                    }

                    hoverContent += propName;

                    if (type) {
                        hoverContent += `: ${type.name}`;
                    }

                    return hoverContent;
                }),
            };
        },
    });

    const componentsCompletionItemProvider = vscode.languages.registerCompletionItemProvider({ pattern: '**/*.vue' }, {
        async provideCompletionItems() {
            if (!isCursorInTemplateSection() || isCursorInsideComponent()) {
                return;
            }
            jsFiles = await getJsFiles();
            const files = await getVueFiles();

            return files.map(createComponentCompletionItem);
        },
    });

    const propsCompletionItemProvider = vscode.languages.registerCompletionItemProvider({ pattern: '**/*.vue' }, {
        async provideCompletionItems(document, position) {
            if (!isCursorInsideComponent()) {
                return;
            }

            jsFiles = await getJsFiles();
            const props = await getPropsForLine(position.line, position.character);

            if (!props) {
                return;
            }

            return Object.keys(props).map(createPropCompletionItem);
        },
    }, ':');

    const importFile = vscode.commands.registerCommand('vueDiscovery.importFile', async (file, fileName) => {
        if (!hasScriptTagInactiveTextEditor()) {
            return vscode.window.showWarningMessage('Looks like there is no script tag in this file!');
        }
        jsFiles = await getJsFiles();

        const editor = vscode.window.activeTextEditor;

        await insertImport(editor, file, fileName);
        await insertComponent(editor, fileName);
        await insertSippet(editor, file, fileName);
    });

    context.subscriptions.push(componentsCompletionItemProvider, propsCompletionItemProvider, importFile);
}

module.exports = {
    activate,
};