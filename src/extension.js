const vscode = require('vscode');
const glob = require('glob')
var fs = require('fs');

/**
 * Finds all .vue files in the src directory
 * @param {String} src
 */
function getVueFiles(src) {
    return new Promise((resolve, reject) => {
        glob(src + '/src/**/*.vue',  function (err, res) {
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
function createCompletionItem(file) {
    const fileName = retrieveComponentNameFromFile(file)
    const snippetCompletion = new vscode.CompletionItem(fileName, 3);

    snippetCompletion.detail = retrieveWithDirectoryInformationFromFile(file)
    snippetCompletion.command = { title: 'Import file', command: 'vueIntellisense.importFile', arguments: [ file, fileName ] }

    // We don't want to insert anything here since this will be done in the importFile command
    snippetCompletion.insertText = '';

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
        .get(`vueIntellisense.${key}`)
}

/**
 * Parses the props from a SFC and returns them as an object
 * @param {String} file
 */
function parsePropsFromSFC(file) {
    const content = fs.readFileSync(file,'utf8')
    const propsStartIndex = /props: {/.exec(content)

    if(!propsStartIndex || propsStartIndex.index === -1) {
        return 'props: {}'
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

    return eval(`({${toSearch.substring(0, index)}})`).props
}

/**
 * Returns an array of required props from a SFC
 * @param {String} file
 */
function parseRequiredPropsFromSfc(file) {
    const props = parsePropsFromSFC(file)

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
    const requiredProps  = parseRequiredPropsFromSfc(file)

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
    const importPath = file.replace(`${vscode.workspace.rootPath}/src`, '@')

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

        componentString = `\n${propIndent}components: {\n${indent}${componentName}\n${propIndent}},`

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

    let matchInsertIndex = match[0].length - 1

    let found = false

    while (!found) {
        matchInsertIndex--

        if (/[\S]/.test(match[0].charAt(matchInsertIndex))) {
            found = true
        }
    }

    const insertIndex = match.index + matchInsertIndex
    const insertPosition = document.positionAt(insertIndex)

    const componentString = `\n${indent}${componentName}`

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

function activate(context) {
	let completionItemProvider = vscode.languages.registerCompletionItemProvider('vue', {
		async provideCompletionItems() {
            const rootPath = config('rootDirectory')
                ? config('rootDirectory')
                : vscode.workspace.rootPath

                const files = await getVueFiles(rootPath)

            return files.map(createCompletionItem)
		}
    });

	let importFile = vscode.commands.registerCommand('vueIntellisense.importFile', async (file, fileName) => {
        if(!hasScriptTagInactiveTextEditor()) {
            return vscode.window.showWarningMessage('Looks like there is no script tag in this file!');
        }

        const editor = vscode.window.activeTextEditor;

        await insertImport(editor, file, fileName)
        await insertComponent(editor, fileName)
        await insertSippet(editor, file, fileName)
    });

	context.subscriptions.push(completionItemProvider, importFile);
}

module.exports = {
    activate
}