const vscode = require('vscode');
const { showFile, getDocUri, position, getDocPath, sleep } = require('../util');
const { testLineEquals, testHover, testCompletion, testCompletionDoesNotContainItems } = require('../helpers');
const { components, props, events, hover } = require('../fixtures');

describe('Interactions', function () {
    const docUri = getDocUri('different-extension.blade.php');
    const componentWithoutPropsSnippet = '<ComponentWithProps :name="" :names="" :default-value=""></ComponentWithProps>';

    before('activate', async () => {
        await vscode.commands.executeCommand('vueDiscovery.tests.setConfigOption', 'extensions', ['.blade.php']);
        await showFile(docUri);
    });

    it('shows available components', async () => {
        await testCompletion(docUri, position(8, 8), components);
    });

    it('adds a component to the template section', async () => {
        const pos = position(8, 8);
        const editor = vscode.window.activeTextEditor;

        await editor.edit(edit => {
            edit.insert(position(8, 0), '\t\t');
        });

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/ComponentWithProps.vue'), 'ComponentWithProps');

        await sleep(50);

        testLineEquals(8, `\t\t${componentWithoutPropsSnippet}`);
    });

    it('shows props when hovering a component', async () => {
        await testHover(docUri, position(8, 10), {
            contents: hover,
        });
    });

    it('does not show available components when inside attributes', async () => {
        await testCompletionDoesNotContainItems(docUri, position(8, 40), components);
    });

    it('completes props and events on a component', async () => {
        await testCompletion(docUri, position(8, 40), [...props, ...events]);
    });

    it('adds the same component to the template section', async () => {
        const pos = position(8, componentWithoutPropsSnippet.length + 2);
        const editor = vscode.window.activeTextEditor;

        editor.selection = new vscode.Selection(pos, pos);

        await vscode.commands.executeCommand('vueDiscovery.importFile', getDocPath('components/ComponentWithProps.vue'), 'ComponentWithProps');

        await sleep(50);

        testLineEquals(8, `\t\t${componentWithoutPropsSnippet}${componentWithoutPropsSnippet}`);
    });
});
