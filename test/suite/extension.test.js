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
    new vscode.CompletionItem('name', vscode.CompletionItemKind.Variable),
    new vscode.CompletionItem('names', vscode.CompletionItemKind.Variable),
];

describe('Interactions', function () {
    const docUri = getDocUri('App.vue');

    before('activate', async () => {
        await showFile(docUri);
    });

    it('adds a component to the template section', async () => {
        const pos = position(3, 8);
        const editor = vscode.window.activeTextEditor;

        await editor.edit(edit => {
            edit.insert(position(3, 0), '\t\t');
        });

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/ComponentWithProps.vue'), 'ComponentWithProps');

        await sleep(20);

        testLineEquals(3, '\t\t<ComponentWithProps :name="" :names=""></ComponentWithProps>');
    });

    it('imports a component and respects alias', async () => {
        testLineEquals(8, 'import ComponentWithProps from \'@/components/ComponentWithProps.vue\'');
    });

    it('registers the component', async () => {
        const expected = '    components: {\n        ComponentWithProps,\n    },\n';
        rangeEquals(range(10, 0, 13, 0), expected);
    });

    it('shows props when hovering a component', async () => {
        await testHover(docUri, position(3, 10), {
            contents: [
                '(required) name: String',
                '(required) names: Array',
                'label: String',
            ],
        });
    });

    it('shows available components', async () => {
        await testCompletion(docUri, position(4, 9), components);
    });

    it('does not show available components when inside attributes', async () => {
        await testCompletionDoesNotContainItems(docUri, position(3, 40), components);
    });

    it('completes props on a component', async () => {
        await testCompletion(docUri, position(3, 40), props);
    });

    it('adds the same component to the template section', async () => {
        const pos = position(3, 62);
        const editor = vscode.window.activeTextEditor;

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/ComponentWithProps.vue'), 'ComponentWithProps');

        await sleep(40);

        testLineEquals(3, '\t\t<ComponentWithProps :name="" :names=""></ComponentWithProps><ComponentWithProps :name="" :names=""></ComponentWithProps>');
    });

    it('does not import the component twice', async () => {
        const text = vscode.window.activeTextEditor.document.getText();
        const occurrences = text.split('import ComponentWithProps from \'@/components/ComponentWithProps.vue\'').length - 1;
        assert.ok(occurrences === 1);
    });

    it('does not register the component twice', async () => {
        const expected = '    components: {\n        ComponentWithProps,\n    },\n';
        rangeEquals(range(10, 0, 13, 0), expected);
    });

    it('adds another component to the template section', async () => {
        const pos = position(3, 122);
        const editor = vscode.window.activeTextEditor;

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/AnotherComponent.vue'), 'AnotherComponent');

        await sleep(40);

        testLineEquals(3, '\t\t<ComponentWithProps :name="" :names=""></ComponentWithProps><ComponentWithProps :name="" :names=""></ComponentWithProps><AnotherComponent :name="" :names=""></AnotherComponent>');
    });

    it('imports another component and respects alias', async () => {
        testLineEquals(8, 'import AnotherComponent from \'@/components/AnotherComponent.vue\'');
    });

    it('registers another component', async () => {
        const expected = '    components: {\n        ComponentWithProps,\n        AnotherComponent,\n    },\n';
        rangeEquals(range(11, 0, 15, 0), expected);
    });
});
