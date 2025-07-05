import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after, describe, it } from 'mocha';

// Wait for extension activation
async function activateExtension() {
  const extension = vscode.extensions.getExtension('code-removal-comments.code-removal-comments');
  if (extension && !extension.isActive) {
    await extension.activate();
  }
  // Wait a bit for activation to complete
  await new Promise(resolve => setTimeout(resolve, 100));
}

describe('Code Removal Comments Extension', () => {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  before(async function() {
    this.timeout(15000); // Increase timeout for setup
    
    // Activate the extension
    await activateExtension();

    // Create a test document
    document = await vscode.workspace.openTextDocument({
      content: `function test() {
  console.log("keep this");
  console.log("remove this");
  console.log("keep this too");
}`,
      language: 'typescript',
    });

    editor = await vscode.window.showTextDocument(document);
  });

  after(async function() {
    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  describe('Multi-line Wrapping', () => {
    it('should wrap selected text with multi-line comments', async function() {
      this.timeout(5000);
      
      // Reset document content
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("keep this");
  console.log("remove this");
  console.log("keep this too");
}`);
      });

      // Select the middle line (including indentation)
      const selection = new vscode.Selection(new vscode.Position(2, 0), new vscode.Position(2, 28));
      editor.selection = selection;

      // Execute the command
      await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('BUILD_REMOVE_START'), 'Should contain BUILD_REMOVE_START');
      assert.ok(text.includes('BUILD_REMOVE_END'), 'Should contain BUILD_REMOVE_END');
      assert.ok(text.includes('console.log("remove this")'), 'Should contain the selected text');
    });
  });

  describe('Single-line Wrapping', () => {
    it('should wrap selected text with single-line comments', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("keep this");
  console.log("remove this");
  console.log("keep this too");
}`);
      });

      // Select the middle line
      const selection = new vscode.Selection(new vscode.Position(2, 0), new vscode.Position(2, 28));
      editor.selection = selection;

      // Execute the command
      await vscode.commands.executeCommand('codeRemoval.wrapSingleLine');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('BUILD_REMOVE_START'), 'Should contain BUILD_REMOVE_START');
      assert.ok(text.includes('BUILD_REMOVE_END'), 'Should contain BUILD_REMOVE_END');
      // Should use 
      // style comments
      assert.ok(text.includes('// BUILD_REMOVE_START'), 'Should use single-line comment style');
    });
  });

  describe('Inline Wrapping', () => {
    it('should wrap selected text inline with multi-line comments', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  const debug = true;
  console.log("normal line");
}`);
      });

      // Select just the variable declaration
      const selection = new vscode.Selection(new vscode.Position(1, 2), new vscode.Position(1, 19));
      editor.selection = selection;

      // Execute the inline wrap command
      await vscode.commands.executeCommand('codeRemoval.wrapInlineMultiLine');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('BUILD_REMOVE_START'), 'Should contain BUILD_REMOVE_START');
      assert.ok(text.includes('BUILD_REMOVE_END'), 'Should contain BUILD_REMOVE_END');
      // Should be on one line
      const lines = text.split('\n');
      const wrappedLine = lines.find(line => line.includes('BUILD_REMOVE_START'));
      assert.ok(wrappedLine?.includes('const debug = true'), 'Should contain the selected code inline');
    });
  });

  describe('Environment-Specific Wrapping', () => {
    it('should wrap with production-only comments', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("production code");
}`);
      });

      // Select the line
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 30));
      editor.selection = selection;

      // Execute production-only command
      await vscode.commands.executeCommand('codeRemoval.wrapProductionOnly');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('PRODUCTION_ONLY_START'), 'Should contain PRODUCTION_ONLY_START');
      assert.ok(text.includes('PRODUCTION_ONLY_END'), 'Should contain PRODUCTION_ONLY_END');
    });

    it('should wrap with development-only comments', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("dev code");
}`);
      });

      // Select the line
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 24));
      editor.selection = selection;

      // Execute development-only command
      await vscode.commands.executeCommand('codeRemoval.wrapDevelopmentOnly');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('DEV_ONLY_START'), 'Should contain DEV_ONLY_START');
      assert.ok(text.includes('DEV_ONLY_END'), 'Should contain DEV_ONLY_END');
    });

    it('should wrap with test-only comments', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("test code");
}`);
      });

      // Select the line
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 25));
      editor.selection = selection;

      // Execute test-only command
      await vscode.commands.executeCommand('codeRemoval.wrapTestOnly');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('TEST_ONLY_START'), 'Should contain TEST_ONLY_START');
      assert.ok(text.includes('TEST_ONLY_END'), 'Should contain TEST_ONLY_END');
    });

    it('should wrap with debug block comments', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  debugger;
  console.log("debug info");
}`);
      });

      // Select both lines
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(2, 26));
      editor.selection = selection;

      // Execute debug block command
      await vscode.commands.executeCommand('codeRemoval.wrapDebugBlock');

      // Check the result
      const text = document.getText();
      assert.ok(text.includes('DEBUG_START'), 'Should contain DEBUG_START');
      assert.ok(text.includes('DEBUG_END'), 'Should contain DEBUG_END');
    });
  });

  describe('Line Marking', () => {
    it('should mark line with removal comment', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("keep this");
  console.log("remove this");
  console.log("keep this too");
}`);
      });

      // Place cursor on middle line
      const position = new vscode.Position(2, 10);
      editor.selection = new vscode.Selection(position, position);

      // Execute the command
      await vscode.commands.executeCommand('codeRemoval.markLine');

      // Check the result
      const text = document.getText();
      const lines = text.split('\n');
      assert.ok(lines[2].includes('BUILD_REMOVE'), 'Line should contain BUILD_REMOVE marker');
      assert.ok(lines[2].includes('// BUILD_REMOVE'), 'Should use correct comment format');
    });

    it('should mark multiple selected lines', async function() {
      this.timeout(5000);
      
      // Reset document
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("line 1");
  console.log("line 2");
  console.log("line 3");
}`);
      });

      // Select multiple lines
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(2, 25));
      editor.selection = selection;

      // Execute the command
      await vscode.commands.executeCommand('codeRemoval.markLine');

      // Check the result
      const text = document.getText();
      const lines = text.split('\n');
      assert.ok(lines[1].includes('BUILD_REMOVE'), 'First selected line should be marked');
      assert.ok(lines[2].includes('BUILD_REMOVE'), 'Second selected line should be marked');
    });
  });

  describe('Remove Existing Markers', () => {
    it('should remove existing removal markers', async function() {
      this.timeout(5000);
      
      // Create document with existing markers
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  /* BUILD_REMOVE_START */
  console.log("debug");
  /* BUILD_REMOVE_END */
  console.log("normal"); // BUILD_REMOVE
  /* DEBUG_START */
  debugger;
  /* DEBUG_END */
}`);
      });

      // Select all content
      const selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(8, 1));
      editor.selection = selection;

      // Execute remove markers command
      await vscode.commands.executeCommand('codeRemoval.removeExistingMarkers');

      // Check the result
      const text = document.getText();
      assert.ok(!text.includes('BUILD_REMOVE_START'), 'Should remove BUILD_REMOVE_START');
      assert.ok(!text.includes('BUILD_REMOVE_END'), 'Should remove BUILD_REMOVE_END');
      assert.ok(!text.includes('BUILD_REMOVE'), 'Should remove BUILD_REMOVE');
      assert.ok(!text.includes('DEBUG_START'), 'Should remove DEBUG_START');
      assert.ok(!text.includes('DEBUG_END'), 'Should remove DEBUG_END');
      assert.ok(text.includes('console.log("debug")'), 'Should keep the actual code');
      assert.ok(text.includes('console.log("normal")'), 'Should keep normal code');
      assert.ok(text.includes('debugger'), 'Should keep debugger statement');
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async function() {
      this.timeout(5000);
      
      // Update configuration
      const config = vscode.workspace.getConfiguration('codeRemoval');
      await config.update('multiLineStart', 'CUSTOM_START', vscode.ConfigurationTarget.Global);
      await config.update('multiLineEnd', 'CUSTOM_END', vscode.ConfigurationTarget.Global);

      // Wait for config update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reset document and select text
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("remove this");
}`);
      });

      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 28));
      editor.selection = selection;

      // Execute command
      await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');

      // Check custom patterns are used
      const text = document.getText();
      assert.ok(text.includes('CUSTOM_START'), 'Should use custom start pattern');
      assert.ok(text.includes('CUSTOM_END'), 'Should use custom end pattern');

      // Reset configuration
      await config.update('multiLineStart', 'BUILD_REMOVE_START', vscode.ConfigurationTarget.Global);
      await config.update('multiLineEnd', 'BUILD_REMOVE_END', vscode.ConfigurationTarget.Global);
    });

    it('should respect spacing configuration', async function() {
      this.timeout(5000);
      
      // Disable spacing
      const config = vscode.workspace.getConfiguration('codeRemoval');
      await config.update('useSpacing', false, vscode.ConfigurationTarget.Global);

      // Wait for config update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reset document and select text
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("test");
}`);
      });

      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 20));
      editor.selection = selection;

      // Execute command
      await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');

      // Check no spacing is used
      const text = document.getText();
      assert.ok(text.includes('/*BUILD_REMOVE_START*/'), 'Should not have spacing around markers');

      // Reset configuration
      await config.update('useSpacing', true, vscode.ConfigurationTarget.Global);
    });
  });

  describe('Indentation Preservation', () => {
    it('should preserve indentation when wrapping code', async function() {
      this.timeout(5000);
      
      // Create indented content
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
    if (true) {
        console.log("nested code");
    }
}`);
      });

      // Select the nested line
      const selection = new vscode.Selection(new vscode.Position(2, 0), new vscode.Position(2, 35));
      editor.selection = selection;

      // Execute command
      await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');

      // Check indentation is preserved
      const text = document.getText();
      const lines = text.split('\n');

      // Find the comment lines and check their indentation
      const startCommentLine = lines.find((line) => line.includes('BUILD_REMOVE_START'));
      const endCommentLine = lines.find((line) => line.includes('BUILD_REMOVE_END'));

      assert.ok(startCommentLine?.startsWith('        '), 'Start comment should preserve indentation');
      assert.ok(endCommentLine?.startsWith('        '), 'End comment should preserve indentation');
    });
  });

  describe('Multi-line Selection', () => {
    it('should handle multi-line selections correctly', async function() {
      this.timeout(5000);
      
      // Create multi-line content
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  console.log("line 1");
  console.log("line 2");
  console.log("line 3");
  return true;
}`);
      });

      // Select multiple lines
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(3, 26));
      editor.selection = selection;

      // Execute command
      await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');

      // Check that all selected lines are wrapped
      const text = document.getText();
      assert.ok(text.includes('BUILD_REMOVE_START'), 'Should contain start marker');
      assert.ok(text.includes('BUILD_REMOVE_END'), 'Should contain end marker');
      assert.ok(text.includes('console.log("line 1")'), 'Should contain line 1');
      assert.ok(text.includes('console.log("line 2")'), 'Should contain line 2');
      assert.ok(text.includes('console.log("line 3")'), 'Should contain line 3');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty selection gracefully', async function() {
      this.timeout(5000);
      
      // Clear selection
      editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

      // Try to execute command - should show warning but not throw
      try {
        await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');
        assert.ok(true, 'Command should handle empty selection without throwing');
      } catch (error) {
        assert.fail(`Command should not throw error: ${error}`);
      }
    });

    it('should handle invalid command execution gracefully', async function() {
      this.timeout(5000);
      
      // Close the editor to simulate no active editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

      try {
        await vscode.commands.executeCommand('codeRemoval.wrapMultiLine');
        assert.ok(true, 'Command should handle no active editor without throwing');
      } catch (error) {
        assert.fail(`Command should not throw error: ${error}`);
      }

      // Reopen the document for other tests
      editor = await vscode.window.showTextDocument(document);
    });
  });

  describe('Convert to Inline', () => {
    it('should convert block comments to inline format', async function() {
      this.timeout(5000);
      
      // Create document with block comments
      await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        editBuilder.replace(fullRange, `function test() {
  /* BUILD_REMOVE_START */
  console.log("debug");
  /* BUILD_REMOVE_END */
}`);
      });

      // Select the block
      const selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(3, 24));
      editor.selection = selection;

      // Execute convert to inline command
      await vscode.commands.executeCommand('codeRemoval.convertToInline');

      // Check the result
      const text = document.getText();
      const lines = text.split('\n');
      const convertedLine = lines.find(line => 
        line.includes('BUILD_REMOVE_START') && 
        line.includes('BUILD_REMOVE_END') && 
        line.includes('console.log("debug")')
      );
      
      assert.ok(convertedLine, 'Should convert to inline format');
    });
  });
});