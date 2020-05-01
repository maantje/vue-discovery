const vscode = require('vscode');
const glob = require('glob')
var fs = require('fs');

let jsFiles = []

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
    })
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
    })
}



/**
 * Retrieve the component name from a path
 * eg src/components/Table.vue returns Table
 * @param {String} file
 */
function retrieveComponentNameFromFile(file) {
    const parts = file.split('/')

    return parts[parts.length - 1].split('.')[0]
}

/**
 * Retrieve the component name with directory
 * eg src/components/Table.vue returns components/Table.vue
 * @param {String} file
 */
function retrieveWithDirectoryInformationFromFile(file) {
    const parts = file.split('/')

    return parts.slice(parts.length - 2, parts.length).join('/')
}

/**
 * Creates a completion item for a components from a path
 * @param {String} file
 */
function createComponentCompletionItem(file) {
    const fileName = retrieveComponentNameFromFile(file)
    const snippetCompletion = new vscode.CompletionItem(fileName, 3);

    snippetCompletion.detail = retrieveWithDirectoryInformationFromFile(file)
    snippetCompletion.command = { title: 'Import file', command: 'vueDiscovery.importFile', arguments: [ file, fileName ] }

    // We don't want to insert anything here since this will be done in the importFile command
    snippetCompletion.insertText = '';

    return snippetCompletion
}

function createPropCompletionItem(prop) {
    const snippetCompletion = new vscode.CompletionItem(prop, 5);

    snippetCompletion.insertText = new vscode.SnippetString(`${prop}="$0"`);

    return snippetCompletion
}


function hasScriptTagInactiveTextEditor () {
    const text = vscode.window.activeTextEditor.document.getText()

    const scriptTagMatch = /<script/.exec(text)
    return scriptTagMatch && scriptTagMatch.index > -1
}

function config(key) {
    return vscode.workspace
        .getConfiguration()
        .get(`vueDiscovery.${key}`)
}

/**
 * Parses the props from a SFC and returns them as an object
 * @param {String} content
 */
function parseMixinsFromContent(content) {
    const mixinsStart = /mixins: \[/.exec(content)

        if(!mixinsStart || mixinsStart.index === -1) {
        return false
    }

    const toSearch = content.substring(mixinsStart.index, content.length)

    let foundEnd = false

    let index = 0

    while (!foundEnd) {
        ++index

        if (toSearch[index] === ']') {
            foundEnd = true
        }
    }

    return toSearch.substring(9, index).split(',').map(mixin => mixin.trim());
}


/**
 * Parses the props from a SFC and returns them as an object
 * @param {String} file
 */
function parsePropsFromSFC(file) {
    const content = fs.readFileSync(file,'utf8')

    const mixins = parseMixinsFromContent(content)
    let mixinProps = {}

    if (mixins) {
        mixinProps = mixins.reduce((accumulator, mixin) => {
            const file = jsFiles.find(file => file.includes(mixin))

            if (!file) {
                return accumulator
            }

            return {...accumulator, ...parsePropsFromSFC(file)}
        }, {})
    }


    const propsStartIndex = /props: {/.exec(content)

    if(!propsStartIndex || propsStartIndex.index === -1) {
        return mixinProps
    }

    const toSearch = content.substring(propsStartIndex.index, content.length)

    let hasNotFoundStart = true
    let openingBrace = 0
    let index = 0

    while (openingBrace !== 0 || hasNotFoundStart) {
        if (toSearch[index] === '{') {
            hasNotFoundStart = false
            ++openingBrace
        }
        if (toSearch[index] === '}') {
            --openingBrace
        }
        ++index
    }

    // parseMixinsFromContent(content)

    return {...eval(`({${toSearch.substring(0, index)}})`).props, ...mixinProps}
}

/**
 * Returns an array of required props from a SFC
 * @param {String} file
 */
function parseRequiredPropsFromSfc(file) {
    const props = parsePropsFromSFC(file)

    if (!props) {
        return
    }

    return Object.keys(props).filter(prop => {
        return props[prop].required
    })
}

/**
 * Inserts the snippet for the component in the template section
 * @param {Object} editor
 * @param {String} file
 * @param {String} fileName
 */
function insertSippet(editor, file, fileName) {
    const requiredProps = parseRequiredPropsFromSfc(file)

    let tabStop = 1;

    let snippetString = requiredProps.reduce((accumulator, prop) => {
        return accumulator += ` :$${tabStop++}${prop}="$${tabStop++}"`
    }, '')

    snippetString = `<${fileName}${snippetString}>$0</${fileName}>`

    editor.insertSnippet(new vscode.SnippetString(snippetString))
}

/**
 * Inserts the import in the scripts section
 * @param {Object} editor
 * @param {String} file
 * @param {String} fileName
 */
async function insertImport(editor, file, fileName) {
    const document = editor.document
    const text = document.getText()

    const match = /<script/.exec(text)

    const fileWithoutRootPath = file.replace(getRootPath() + '/', '')

    const aliases = findAliases()
    const aliasKey = Object.keys(aliases).find(alias => fileWithoutRootPath.startsWith(aliases[alias][0].replace('*', '')))

    let alias = null

    if (aliasKey) {
        alias = { value: aliasKey.replace('*', ''), path: aliases[aliasKey][0].replace('*', '') }
    }

    let importPath = null

    if (alias) {
        importPath = fileWithoutRootPath.replace(`${alias.path}`, alias.value)
    } else {
        importPath = fileWithoutRootPath.replace('src/', '@/')
    }



    if (text.indexOf(`import ${fileName} from '${importPath}`) === -1) {
        const scriptTagPosition = document.positionAt(match.index)
        const insertPosition = new vscode.Position(scriptTagPosition.line + 1, 0)
        await editor.edit(edit => {
            edit.insert(insertPosition, `import ${fileName} from '${importPath}'\n`)
        })
    }
}

/**
 * Inserts the component in a new components section
 * @param {Object} editor
 * @param {String} text
 * @param {String} componentName
 */
async function insertComponents(editor, text, componentName) {
    const document = editor.document
    const indentBase = editor.options.insertSpaces
        ? ' '.repeat(editor.options.tabSize)
        : '\t'
    const indent = indentBase.repeat(2)
    const match = /export[\s]*default[\s]*\{/.exec(text)

    if (match && match.index > -1) {
        let insertIndex = match.index + match[0].length

        const propIndent = indentBase.repeat(1)
        let componentString = ''

        componentString = `\n${propIndent}components: {\n${indent}${componentName},\n${propIndent}},`

        const position = document.positionAt(insertIndex)

        await editor.edit(edit => {
            edit.insert(position, componentString)
        })
    }
}

/**
 * Inserts the component in an existing components section
 * @param {Object} editor
 * @param {Object} match
 * @param {String} componentName
 */
async function insertInExistingComponents(editor, match, componentName) {
    const document = editor.document
    const indentBase = editor.options.insertSpaces
    ? ' '.repeat(editor.options.tabSize)
    : '\t'
    const indent = indentBase.repeat(2)

    let matchInsertIndex = match[0].length

    let found = false

    while (!found) {
        matchInsertIndex--

        if (/[\S]/.test(match[0].charAt(matchInsertIndex))) {
            found = true
        }
    }

    const insertIndex = match.index + matchInsertIndex + 1
    const insertPosition = document.positionAt(insertIndex)

    const componentString = `\n${indent}${componentName},`

    await editor.edit(edit => {
        edit.insert(insertPosition, componentString)
    })
}

/**
 * Checks whether to create a new components section or append to an existing one and appends it
 * @param {Object} editor
 * @param {String} componentName
 */
async function insertComponent(editor, componentName) {
    const document = editor.document
    const text = document.getText()
    const indentBase = editor.options.insertSpaces
    ? ' '.repeat(editor.options.tabSize)
    : '\t'
    const indent = indentBase.repeat(2)

    // Component already registered
    if(text.indexOf(`\n${indent}${componentName}`) !== -1) {
        return
    }

    const match = /components( )*:( )*{[\s\S]*?(?=})/.exec(text)

    // Components not yet defined add section with component
    if (!match || match.index === -1) {
        return insertComponents(editor, text, componentName)
    }

    // Add the component to components
    insertInExistingComponents(editor, match, componentName)
}
function getLine(line) {
    const editor = vscode.window.activeTextEditor;
    const document = editor.document
    const text = document.getText()


    return text.split('\n')[line]
}
function isCursorInBetweenTag(selector) {
    const editor = vscode.window.activeTextEditor;
    const document = editor.document
    const text = document.getText()

    const start = text.indexOf(`<${selector}>`)
    const end = text.indexOf(`</${selector}>`)

    if (start === -1 || end === -1) {
        return false
    }

    const startLine = document.positionAt(start).line
    const endLine = document.positionAt(end).line

    const position = editor.selection.active;

    return position.line > startLine && position.line < endLine
}
function getActiveEditorPosition() {
    const editor = vscode.window.activeTextEditor;

    return editor.selection.active;
}

function isInTemplateSection () {
    return isCursorInBetweenTag('template')
}
function findAliases () {
    try {
        const { compilerOptions } = require(getRootPath() + '/jsconfig.json')

        return compilerOptions.paths
    } catch (e) {
        return []
    }
}
function getRootPath() {
    return config('rootDirectory')
        ? config('rootDirectory')
        : vscode.workspace.rootPath
}
function getComponentNameForLine(line, character = null) {
    let matchTagName = (markup) => {
        const pattern = /<([^\s></]+)/

        const match = markup.match(pattern)

        if (match) {
            return match[1]
        }

        return false
    }

    let component = false
    let lineToCheck = line

    do {
        let lineContent = getLine(lineToCheck)

        if (lineToCheck === line && character) {
            lineContent = lineContent.substring(0, character)
        }

        component = matchTagName(lineContent)

        if (lineContent.includes('>') && lineContent.includes('<')) {
            return false
        }

        if ((lineContent.includes('>') || lineContent.includes('</')) && component === false) {
            return false
        }

        lineToCheck--
    } while (component === false);

    return component
}
async function getPropsForLine(line, character) {
    const component = getComponentNameForLine(line, character)

    if (!component) {
        return
    }

    const files = await getVueFiles()

    const file = files.find(file => file.includes(component))

    if (!file) {
        return
    }
    console.log(parsePropsFromSFC(file))
    return parsePropsFromSFC(file)
}

function isCursorInsideComponent() {
    const position = getActiveEditorPosition()

    if (!position) {
        return false
    }

    return getComponentNameForLine(position.line, position.character) !== false
}
function activate(context) {
    vscode.languages.registerHoverProvider('vue', {
        async provideHover(document, position) {
            if (!isInTemplateSection()) {
                return
            }

            jsFiles = await getJsFiles()
            const props = await getPropsForLine(position.line, position.character)

            if (!props) {
                return;
            }


            return {
                contents: Object.keys(props).map(propName => {
                    const { required, type } = props[propName]
                    let hoverContent = ''

                    if (required) {
                        hoverContent += '(required) '
                    }

                    hoverContent += propName

                    if (type) {
                        hoverContent += `: ${type.name}`
                    }

                    return hoverContent
                })
            };
        }
    });

	let componentsCompletionItemProvider = vscode.languages.registerCompletionItemProvider({ language: 'vue', scheme: 'file' }, {
		async provideCompletionItems() {
            if (!isInTemplateSection() || isCursorInsideComponent()) {
                return
            }

            const files = await getVueFiles()

            return files.map(createComponentCompletionItem)
		}
    });

    let propsCompletionItemProvider = vscode.languages.registerCompletionItemProvider({ language: 'vue', scheme: 'file' }, {
		async provideCompletionItems(document, position) {
            if (!isCursorInsideComponent()) {
                return
            }

            const props = await getPropsForLine(position.line, position.character)

            if (!props) {
                return
            }

            return Object.keys(props).map(createPropCompletionItem)
		}
    }, ':');

	let importFile = vscode.commands.registerCommand('vueDiscovery.importFile', async (file, fileName) => {
        if(!hasScriptTagInactiveTextEditor()) {
            return vscode.window.showWarningMessage('Looks like there is no script tag in this file!');
        }

        const editor = vscode.window.activeTextEditor;

        await insertImport(editor, file, fileName)
        await insertComponent(editor, fileName)
        await insertSippet(editor, file, fileName)
    });

	context.subscriptions.push(componentsCompletionItemProvider, propsCompletionItemProvider, importFile);
}

module.exports = {
    activate
}