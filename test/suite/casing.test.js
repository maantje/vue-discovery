const assert = require('assert');
const vscode = require('vscode');
const { showFile, getDocUri, position, getDocPath, sleep, range } = require('../util');
const { testLineEquals, rangeEquals, testHover, testCompletion, testCompletionDoesNotContainItems } = require('../helpers');

const components = [
    Object.assign(new vscode.CompletionItem('ComponentWithProps', vscode.CompletionItemKind.Constructor), { detail: 'components/ComponentWithProps.vue' }),
    Object.assign(new vscode.CompletionItem('AnotherComponent', vscode.CompletionItemKind.Constructor), { detail: 'components/AnotherComponent.vue' }),
    Object.assign(new vscode.CompletionItem('App', vscode.CompletionItemKind.Constructor), { detail: 'src/App.vue' }),
];

const props = [
    new vscode.CompletionItem('label', vscode.CompletionItemKind.Variable),
    new vscode.CompletionItem('defaultValue', vscode.CompletionItemKind.Variable),
    new vscode.CompletionItem('name', vscode.CompletionItemKind.Variable),
    new vscode.CompletionItem('names', vscode.CompletionItemKind.Variable),
];

describe('Interactions', function () {
    const docUri = getDocUri('App.vue');
    const componentWithoutPropsSnippet = '<component-with-props :name="" :names="" :defaultValue=""></component-with-props>';

    before('activate', async () => {
        await vscode.commands.executeCommand('vueDiscovery.tests.setConfigOption', 'componentCase', 'kebab');
        await vscode.commands.executeCommand('vueDiscovery.tests.setConfigOption', 'propCase', 'camel');
        await vscode.commands.executeCommand('vueDiscovery.tests.setConfigOption', 'addTrailingComma', false);
        await sleep(50);

        await showFile(docUri);
    });

    it('shows available components', async () => {
        await testCompletion(docUri, position(3, 8), components);
    });

    it('adds a component to the template section', async () => {
        const pos = position(3, 8);
        const editor = vscode.window.activeTextEditor;

        await editor.edit(edit => {
            edit.insert(position(3, 0), '\t\t');
        });

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/ComponentWithProps.vue'), 'ComponentWithProps');

        await sleep(50);

        testLineEquals(3, `\t\t${componentWithoutPropsSnippet}`);
    });

    it('imports a component and respects alias', async () => {
        testLineEquals(8, 'import ComponentWithProps from \'@/components/ComponentWithProps.vue\'');
    });

    it('registers the component', async () => {
        const expected = '    components: {\n        \'component-with-props\': ComponentWithProps\n    },\n';
        rangeEquals(range(10, 0, 13, 0), expected);
    });

    it('shows props when hovering a component', async () => {
        await testHover(docUri, position(3, 10), {
            contents: [
                '(required) name: String',
                '(required) names: Array',
                'label: String',
                '(required) defaultValue: String',
            ],
        });
    });

    it('does not show available components when inside attributes', async () => {
        await testCompletionDoesNotContainItems(docUri, position(3, 40), components);
    });

    it('completes props on a component', async () => {
        await testCompletion(docUri, position(3, 40), props);
    });

    it('adds the same component to the template section', async () => {
        const pos = position(3, componentWithoutPropsSnippet.length + 2);
        const editor = vscode.window.activeTextEditor;

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/ComponentWithProps.vue'), 'ComponentWithProps');

        await sleep(50);

        testLineEquals(3, `\t\t${componentWithoutPropsSnippet}${componentWithoutPropsSnippet}`);
    });

    it('does not import the component twice', async () => {
        const text = vscode.window.activeTextEditor.document.getText();
        const occurrences = text.split('import ComponentWithProps from \'@/components/ComponentWithProps.vue\'').length - 1;
        assert.ok(occurrences === 1);
    });

    it('does not register the component twice', async () => {
        const expected = '    components: {\n        \'component-with-props\': ComponentWithProps\n    },\n';
        rangeEquals(range(10, 0, 13, 0), expected);
    });

    it('adds another component to the template section', async () => {
        const pos = position(3, componentWithoutPropsSnippet.length * 2 + 2);
        const editor = vscode.window.activeTextEditor;

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/AnotherComponent.vue'), 'AnotherComponent');

        await sleep(50);

        testLineEquals(3, `\t\t${componentWithoutPropsSnippet}${componentWithoutPropsSnippet}<another-component :name="" :names=""></another-component>`);
    });

    it('imports another component and respects alias', async () => {
        testLineEquals(8, 'import AnotherComponent from \'@/components/AnotherComponent.vue\'');
    });

    it('registers another component', async () => {
        const expected = '    components: {\n        \'component-with-props\': ComponentWithProps,\n        \'another-component\': AnotherComponent\n    },\n';
        rangeEquals(range(11, 0, 15, 0), expected);
    });
});
