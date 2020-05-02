const assert = require('assert');
const vscode = require('vscode');

function rangeEquals(range, value) {
    const editor = vscode.window.activeTextEditor;
    const text = editor.document.getText(range);

    assert.equal(text, value);
}

function testLineEquals(line, value) {
    const editor = vscode.window.activeTextEditor;
    const { text } = editor.document.lineAt(line);

    assert.equal(text, value);
}

async function triggerCompletion(docUri, position) {
    vscode.window.activeTextEditor.selection = new vscode.Selection(position, position);

    return (await vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider',
        docUri,
        position,
    ));
}

async function testCompletionDoesNotContainItems(docUri,position, illegalItems) {
    const { items } = await triggerCompletion(docUri, position);
    const illegalItemsInItems = items.filter(({ label }) => illegalItems.find(i => i.label === label));

    assert.equal(illegalItemsInItems.length, 0);
}

async function testCompletion(docUri, position, expectedItems) {
    const result = await triggerCompletion(docUri, position);

    expectedItems.forEach(expectedItem => {
        if (typeof expectedItem === 'string') {
            assert.ok(result.items.find(i => i.label === expectedItem));
            return;
        }

        const match = result.items.find(i => i.label === expectedItem.label);

        if (!match) {
            assert.fail(
                `Can't find matching item for\n${JSON.stringify(expectedItem, null, 2)}\nSeen items:\n${JSON.stringify(
                    result.items,
                    null,
                    2,
                )}`,
            );
            return;
        }

        assert.equal(match.label, expectedItem.label);

        if (expectedItem.kind) {
            assert.equal(match.kind, expectedItem.kind);
        }
        if (expectedItem.detail) {
            assert.equal(match.detail, expectedItem.detail);
        }

        if (expectedItem.documentation) {
            if (typeof match.documentation === 'string') {
                assert.equal(match.documentation, expectedItem.documentation);
            } else {
                if (expectedItem.documentation && expectedItem.documentation.value && match.documentation) {
                    assert.equal(
                        match.documentation.value,
                        expectedItem.documentation.value,
                    );
                }
            }
        }

        if (expectedItem.documentationStart) {
            if (typeof match.documentation === 'string') {
                assert.ok(match.documentation.startsWith(expectedItem.documentationStart));
            } else {
                assert.ok(match.documentation.value.startsWith(expectedItem.documentationStart));
            }
        }
    });
}

async function testHover(docUri, position, expectedHover) {
    const result = (await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        docUri,
        position,
    ));

    if (!result[0]) {
        throw Error('Hover failed');
    }

    const contents = result[0].contents;

    contents.forEach((c, i) => {
        const actualContent = markedStringToString(c);
        const expectedContent = markedStringToString(expectedHover.contents[i]);
        assert.ok(actualContent.startsWith(expectedContent));
    });
}


function markedStringToString(s) {
    return typeof s === 'string' ? s : s.value;
}

module.exports = {
    testHover,
    rangeEquals,
    testLineEquals,
    testCompletion,
    triggerCompletion,
    testCompletionDoesNotContainItems,
};