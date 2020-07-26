const vscode = require('vscode');

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

const events = [
    new vscode.CompletionItem('eventInComponent', vscode.CompletionItemKind.Event),
    new vscode.CompletionItem('eventInMixin', vscode.CompletionItemKind.Event),
    new vscode.CompletionItem('eventInSubMixin', vscode.CompletionItemKind.Event),
];

const hover = [
    '(required) name: `String`',
    '(required) names: `Array`',
    'label: `String`',
    '(required) defaultValue: `String`',
];

module.exports = {
    components,
    props,
    events,
    hover,
};