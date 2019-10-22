/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getLanguageService, LanguageSettings } from '../src/languageservice/yamlLanguageService';
import path = require('path');
import { schemaRequestService, workspaceContext, createJSONLanguageService }  from './utils/testHelper';
import assert = require('assert');
import { TextDocument } from '../src';

const languageService = getLanguageService(schemaRequestService, workspaceContext, [], null);

function toFsPath(str): string {
    if (typeof str !== 'string') {
        throw new TypeError(`Expected a string, got ${typeof str}`);
    }

    let pathName;
    pathName = path.resolve(str);
    pathName = pathName.replace(/\\/g, '/');
    // Windows drive letter must be prefixed with a slash
    if (pathName[0] !== '/') {
        pathName = `/${pathName}`;
    }
    return encodeURI(`file://${pathName}`).replace(/[?#]/g, encodeURIComponent);
}

const uri = toFsPath(path.join(__dirname, './fixtures/customMultipleSchemaSequences.json'));
const languageSettings: LanguageSettings = {
    schemas: [],
    validate: true,
    customTags: [],
    hover: true
};
const fileMatch = ['*.yml', '*.yaml'];
languageSettings.schemas.push({ uri, fileMatch: fileMatch });
languageSettings.customTags.push('!Test');
languageSettings.customTags.push('!Ref sequence');
languageService.configure(languageSettings);
// Defines a Mocha test suite to group tests of similar kind together
suite('Multiple Documents Validation Tests', () => {

    // Tests for validator
    describe('Multiple Documents Validation', function () {
        function setup(content: string) {
            return TextDocument.create('file://~/Desktop/vscode-k8s/test.yaml', 'yaml', 0, content);
        }

        function validatorSetup(content: string) {
            const testTextDocument = setup(content);
            const yDoc = parseYAML(testTextDocument.getText(), languageSettings.customTags);
            return languageService.doValidation(testTextDocument, yDoc);
        }

        function hoverSetup(content: string, position) {
            const testTextDocument = setup(content);
            const jsonDocument = parseYAML2(testTextDocument.getText());
            const jsonLanguageService = createJSONLanguageService();
            jsonLanguageService.configure({
                schemas: [{
                    fileMatch,
                    uri
                }]
            });
            return languageService.doHover(testTextDocument, testTextDocument.positionAt(position));
        }

        it('Should validate multiple documents', done => {
            const content = `
name: jack
age: 22
---
analytics: true
            `;
            const validator = validatorSetup(content);
            validator.then(result => {
                assert.equal(result.length, 0);
            }).then(done, done);
        });

        it('Should find errors in both documents', done => {
            const content = `name1: jack
age: asd
---
cwd: False`;
            const validator = validatorSetup(content);
            validator.then(function (result) {
                assert.equal(result.length, 3);
            }).then(done, done);
        });

        it('Should find errors in first document', done => {
            const content = `name: jack
age: age
---
analytics: true`;
            const validator = validatorSetup(content);
            validator.then(function (result) {
                assert.equal(result.length, 1);
            }).then(done, done);
        });

        it('Should find errors in second document', done => {
            const content = `name: jack
age: 22
---
cwd: False`;
            const validator = validatorSetup(content);
            validator.then(function (result) {
                assert.equal(result.length, 1);
            }).then(done, done);
        });

        it('Should hover in first document', done => {
            const content = 'name: jack\nage: 22\n---\ncwd: False';
            const hover = hoverSetup(content, 1 + content.indexOf('age'));
            hover.then(function (result) {
                assert.notEqual((result.contents as string).length, 0);
                assert.equal(result.contents[0], 'The age of this person');
            }).then(done, done);
        });
    });
});
