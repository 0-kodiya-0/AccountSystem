import * as vscode from 'vscode';

interface Config {
  multiLineStart: string;
  multiLineEnd: string;
  singleLineMarker: string;
  productionOnlyStart: string;
  productionOnlyEnd: string;
  developmentOnlyStart: string;
  developmentOnlyEnd: string;
  testOnlyStart: string;
  testOnlyEnd: string;
  debugStart: string;
  debugEnd: string;
  useSpacing: boolean;
  defaultCommentStyle: 'multiline' | 'singleline';
  preserveIndentation: boolean;
  addEmptyLines: boolean;
}

function getConfig(): Config {
  const config = vscode.workspace.getConfiguration('codeRemoval');
  return {
    multiLineStart: config.get('multiLineStart', 'BUILD_REMOVE_START'),
    multiLineEnd: config.get('multiLineEnd', 'BUILD_REMOVE_END'),
    singleLineMarker: config.get('singleLineMarker', 'BUILD_REMOVE'),
    productionOnlyStart: config.get('productionOnlyStart', 'PRODUCTION_ONLY_START'),
    productionOnlyEnd: config.get('productionOnlyEnd', 'PRODUCTION_ONLY_END'),
    developmentOnlyStart: config.get('developmentOnlyStart', 'DEV_ONLY_START'),
    developmentOnlyEnd: config.get('developmentOnlyEnd', 'DEV_ONLY_END'),
    testOnlyStart: config.get('testOnlyStart', 'TEST_ONLY_START'),
    testOnlyEnd: config.get('testOnlyEnd', 'TEST_ONLY_END'),
    debugStart: config.get('debugStart', 'DEBUG_START'),
    debugEnd: config.get('debugEnd', 'DEBUG_END'),
    useSpacing: config.get('useSpacing', true),
    defaultCommentStyle: config.get('defaultCommentStyle', 'multiline'),
    preserveIndentation: config.get('preserveIndentation', true),
    addEmptyLines: config.get('addEmptyLines', true)
  };
}

function getIndentation(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

function wrapWithComments(
  editor: vscode.TextEditor,
  startMarker: string,
  endMarker: string,
  useMultiLineStyle: boolean = true,
  inline: boolean = false
) {
  const config = getConfig();
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const spacing = config.useSpacing ? ' ' : '';
  let startComment: string;
  let endComment: string;

  if (useMultiLineStyle) {
    startComment = `/*${spacing}${startMarker}${spacing}*/`;
    endComment = `/*${spacing}${endMarker}${spacing}*/`;
  } else {
    startComment = `//${spacing}${startMarker}`;
    endComment = `//${spacing}${endMarker}`;
  }

  let wrappedText: string;

  if (inline) {
    // Inline wrapping - everything on one line
    const cleanText = selectedText.replace(/\n\s*/g, ' ').trim();
    wrappedText = `${startComment} ${cleanText} ${endComment}`;
  } else {
    // Block wrapping - preserve structure
    const firstLine = editor.document.lineAt(selection.start.line);
    const indent = config.preserveIndentation ? getIndentation(firstLine.text) : '';
    
    if (config.addEmptyLines) {
      wrappedText = `${indent}${startComment}\n${selectedText}\n${indent}${endComment}`;
    } else {
      wrappedText = `${indent}${startComment}\n${selectedText}\n${indent}${endComment}`;
    }
  }

  editor.edit(editBuilder => {
    editBuilder.replace(selection, wrappedText);
  });
}

function removeExistingMarkers(editor: vscode.TextEditor) {
  const config = getConfig();
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  // List of all possible markers to remove
  const markers = [
    config.multiLineStart, config.multiLineEnd,
    config.productionOnlyStart, config.productionOnlyEnd,
    config.developmentOnlyStart, config.developmentOnlyEnd,
    config.testOnlyStart, config.testOnlyEnd,
    config.debugStart, config.debugEnd,
    config.singleLineMarker
  ];

  let cleanedText = selectedText;

  // Remove multi-line comment markers
  markers.forEach(marker => {
    const multiLineRegex = new RegExp(`\\/\\*\\s*${escapeRegex(marker)}\\s*\\*\\/`, 'g');
    const singleLineRegex = new RegExp(`\\/\\/\\s*${escapeRegex(marker)}`, 'g');
    cleanedText = cleanedText.replace(multiLineRegex, '');
    cleanedText = cleanedText.replace(singleLineRegex, '');
  });

  // Clean up extra whitespace and empty lines
  cleanedText = cleanedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  editor.edit(editBuilder => {
    editBuilder.replace(selection, cleanedText);
  });

  vscode.window.showInformationMessage('Removal markers cleaned up');
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\');
}

function convertToInline(editor: vscode.TextEditor) {
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  // Check if it's already a block comment structure
  const blockPattern = /\/\*\s*(\w+)\s*\*\/([\s\S]*?)\/\*\s*(\w+)\s*\*\//;
  const match = selectedText.match(blockPattern);

  if (match) {
    const startMarker = match[1];
    const content = match[2].trim().replace(/\n\s*/g, ' ');
    const endMarker = match[3];
    
    const config = getConfig();
    const spacing = config.useSpacing ? ' ' : '';
    const inlineText = `/*${spacing}${startMarker}${spacing}*/ ${content} /*${spacing}${endMarker}${spacing}*/`;

    editor.edit(editBuilder => {
      editBuilder.replace(selection, inlineText);
    });

    vscode.window.showInformationMessage('Converted to inline format');
  } else {
    vscode.window.showWarningMessage('Selected text does not appear to be a removal block');
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Code Removal Comments extension is now active!');

  // Command: Wrap with multi-line comments
  const wrapMultiLine = vscode.commands.registerCommand('codeRemoval.wrapMultiLine', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.multiLineStart, config.multiLineEnd, true, false);
    vscode.window.showInformationMessage('Code wrapped with multi-line removal comments');
  });

  // Command: Wrap with single-line comments
  const wrapSingleLine = vscode.commands.registerCommand('codeRemoval.wrapSingleLine', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.multiLineStart, config.multiLineEnd, false, false);
    vscode.window.showInformationMessage('Code wrapped with single-line removal comments');
  });

  // Command: Wrap inline with multi-line comments
  const wrapInlineMultiLine = vscode.commands.registerCommand('codeRemoval.wrapInlineMultiLine', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.multiLineStart, config.multiLineEnd, true, true);
    vscode.window.showInformationMessage('Code wrapped inline with removal comments');
  });

  // Command: Wrap as production only
  const wrapProductionOnly = vscode.commands.registerCommand('codeRemoval.wrapProductionOnly', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.productionOnlyStart, config.productionOnlyEnd, true, false);
    vscode.window.showInformationMessage('Code marked as production-only');
  });

  // Command: Wrap as development only
  const wrapDevelopmentOnly = vscode.commands.registerCommand('codeRemoval.wrapDevelopmentOnly', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.developmentOnlyStart, config.developmentOnlyEnd, true, false);
    vscode.window.showInformationMessage('Code marked as development-only');
  });

  // Command: Wrap as test only
  const wrapTestOnly = vscode.commands.registerCommand('codeRemoval.wrapTestOnly', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.testOnlyStart, config.testOnlyEnd, true, false);
    vscode.window.showInformationMessage('Code marked as test-only');
  });

  // Command: Wrap as debug block
  const wrapDebugBlock = vscode.commands.registerCommand('codeRemoval.wrapDebugBlock', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    wrapWithComments(editor, config.debugStart, config.debugEnd, true, false);
    vscode.window.showInformationMessage('Code wrapped as debug block');
  });

  // Command: Mark line for removal
  const markLine = vscode.commands.registerCommand('codeRemoval.markLine', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const config = getConfig();
    const selection = editor.selection;

    editor.edit(editBuilder => {
      // If text is selected, mark each line
      if (!selection.isEmpty) {
        for (let lineNumber = selection.start.line; lineNumber <= selection.end.line; lineNumber++) {
          const line = editor.document.lineAt(lineNumber);
          const spacing = config.useSpacing ? ' ' : '';
          const marker = `${spacing}//${spacing}${config.singleLineMarker}`;
          
          // Add marker at the end of the line
          const endOfLine = new vscode.Position(lineNumber, line.text.length);
          editBuilder.insert(endOfLine, marker);
        }
      } else {
        // Mark current line
        const currentLine = editor.document.lineAt(selection.active.line);
        const spacing = config.useSpacing ? ' ' : '';
        const marker = `${spacing}//${spacing}${config.singleLineMarker}`;
        
        const endOfLine = new vscode.Position(selection.active.line, currentLine.text.length);
        editBuilder.insert(endOfLine, marker);
      }
    });

    vscode.window.showInformationMessage('Line(s) marked for removal');
  });

  // Command: Remove existing markers
  const removeMarkers = vscode.commands.registerCommand('codeRemoval.removeExistingMarkers', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    removeExistingMarkers(editor);
  });

  // Command: Convert to inline
  const convertInline = vscode.commands.registerCommand('codeRemoval.convertToInline', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    convertToInline(editor);
  });

  // Command: Configure patterns
  const configure = vscode.commands.registerCommand('codeRemoval.configure', async () => {
    const config = getConfig();
    
    const options = [
      'Change Multi-line Start Pattern',
      'Change Multi-line End Pattern', 
      'Change Single-line Marker',
      'Change Production-Only Patterns',
      'Change Development-Only Patterns',
      'Change Test-Only Patterns',
      'Change Debug Patterns',
      'Toggle Spacing',
      'Toggle Indentation Preservation',
      'Toggle Empty Lines',
      'Change Default Style',
      'Reset to Defaults'
    ];

    const choice = await vscode.window.showQuickPick(options, {
      placeHolder: 'What would you like to configure?'
    });

    if (!choice) {
      return;
    }

    const workspaceConfig = vscode.workspace.getConfiguration('codeRemoval');

    switch (choice) {
      case 'Change Multi-line Start Pattern':
        const newStart = await vscode.window.showInputBox({
          prompt: 'Enter new start pattern',
          value: config.multiLineStart,
          placeHolder: 'BUILD_REMOVE_START'
        });
        if (newStart) {
          await workspaceConfig.update('multiLineStart', newStart, vscode.ConfigurationTarget.Global);
        }
        break;

      case 'Change Multi-line End Pattern':
        const newEnd = await vscode.window.showInputBox({
          prompt: 'Enter new end pattern',
          value: config.multiLineEnd,
          placeHolder: 'BUILD_REMOVE_END'
        });
        if (newEnd) {
          await workspaceConfig.update('multiLineEnd', newEnd, vscode.ConfigurationTarget.Global);
        }
        break;

      case 'Change Single-line Marker':
        const newMarker = await vscode.window.showInputBox({
          prompt: 'Enter new single-line marker',
          value: config.singleLineMarker,
          placeHolder: 'BUILD_REMOVE'
        });
        if (newMarker) {
          await workspaceConfig.update('singleLineMarker', newMarker, vscode.ConfigurationTarget.Global);
        }
        break;

      case 'Change Production-Only Patterns':
        const prodStart = await vscode.window.showInputBox({
          prompt: 'Enter production start pattern',
          value: config.productionOnlyStart,
          placeHolder: 'PRODUCTION_ONLY_START'
        });
        if (prodStart) {
          await workspaceConfig.update('productionOnlyStart', prodStart, vscode.ConfigurationTarget.Global);
          const prodEnd = await vscode.window.showInputBox({
            prompt: 'Enter production end pattern',
            value: config.productionOnlyEnd,
            placeHolder: 'PRODUCTION_ONLY_END'
          });
          if (prodEnd) {
            await workspaceConfig.update('productionOnlyEnd', prodEnd, vscode.ConfigurationTarget.Global);
          }
        }
        break;

      case 'Change Development-Only Patterns':
        const devStart = await vscode.window.showInputBox({
          prompt: 'Enter development start pattern',
          value: config.developmentOnlyStart,
          placeHolder: 'DEV_ONLY_START'
        });
        if (devStart) {
          await workspaceConfig.update('developmentOnlyStart', devStart, vscode.ConfigurationTarget.Global);
          const devEnd = await vscode.window.showInputBox({
            prompt: 'Enter development end pattern',
            value: config.developmentOnlyEnd,
            placeHolder: 'DEV_ONLY_END'
          });
          if (devEnd) {
            await workspaceConfig.update('developmentOnlyEnd', devEnd, vscode.ConfigurationTarget.Global);
          }
        }
        break;

      case 'Change Test-Only Patterns':
        const testStart = await vscode.window.showInputBox({
          prompt: 'Enter test start pattern',
          value: config.testOnlyStart,
          placeHolder: 'TEST_ONLY_START'
        });
        if (testStart) {
          await workspaceConfig.update('testOnlyStart', testStart, vscode.ConfigurationTarget.Global);
          const testEnd = await vscode.window.showInputBox({
            prompt: 'Enter test end pattern',
            value: config.testOnlyEnd,
            placeHolder: 'TEST_ONLY_END'
          });
          if (testEnd) {
            await workspaceConfig.update('testOnlyEnd', testEnd, vscode.ConfigurationTarget.Global);
          }
        }
        break;

      case 'Change Debug Patterns':
        const debugStart = await vscode.window.showInputBox({
          prompt: 'Enter debug start pattern',
          value: config.debugStart,
          placeHolder: 'DEBUG_START'
        });
        if (debugStart) {
          await workspaceConfig.update('debugStart', debugStart, vscode.ConfigurationTarget.Global);
          const debugEnd = await vscode.window.showInputBox({
            prompt: 'Enter debug end pattern',
            value: config.debugEnd,
            placeHolder: 'DEBUG_END'
          });
          if (debugEnd) {
            await workspaceConfig.update('debugEnd', debugEnd, vscode.ConfigurationTarget.Global);
          }
        }
        break;

      case 'Toggle Spacing':
        await workspaceConfig.update('useSpacing', !config.useSpacing, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Spacing ${!config.useSpacing ? 'enabled' : 'disabled'}`);
        break;

      case 'Toggle Indentation Preservation':
        await workspaceConfig.update('preserveIndentation', !config.preserveIndentation, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Indentation preservation ${!config.preserveIndentation ? 'enabled' : 'disabled'}`);
        break;

      case 'Toggle Empty Lines':
        await workspaceConfig.update('addEmptyLines', !config.addEmptyLines, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Empty lines ${!config.addEmptyLines ? 'enabled' : 'disabled'}`);
        break;

      case 'Change Default Style':
        const styleChoice = await vscode.window.showQuickPick(['multiline', 'singleline'], {
          placeHolder: 'Choose default comment style'
        });
        if (styleChoice) {
          await workspaceConfig.update('defaultCommentStyle', styleChoice, vscode.ConfigurationTarget.Global);
        }
        break;

      case 'Reset to Defaults':
        const confirmReset = await vscode.window.showWarningMessage(
          'This will reset all settings to defaults. Continue?',
          'Yes', 'No'
        );
        if (confirmReset === 'Yes') {
          await workspaceConfig.update('multiLineStart', 'BUILD_REMOVE_START', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('multiLineEnd', 'BUILD_REMOVE_END', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('singleLineMarker', 'BUILD_REMOVE', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('productionOnlyStart', 'PRODUCTION_ONLY_START', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('productionOnlyEnd', 'PRODUCTION_ONLY_END', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('developmentOnlyStart', 'DEV_ONLY_START', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('developmentOnlyEnd', 'DEV_ONLY_END', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('testOnlyStart', 'TEST_ONLY_START', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('testOnlyEnd', 'TEST_ONLY_END', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('debugStart', 'DEBUG_START', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('debugEnd', 'DEBUG_END', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('useSpacing', true, vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('defaultCommentStyle', 'multiline', vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('preserveIndentation', true, vscode.ConfigurationTarget.Global);
          await workspaceConfig.update('addEmptyLines', true, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage('Settings reset to defaults');
        }
        break;
    }
  });

  // Command: Quick wrap (uses default style)
  const quickWrap = vscode.commands.registerCommand('codeRemoval.quickWrap', () => {
    const config = getConfig();
    if (config.defaultCommentStyle === 'multiline') {
      vscode.commands.executeCommand('codeRemoval.wrapMultiLine');
    } else {
      vscode.commands.executeCommand('codeRemoval.wrapSingleLine');
    }
  });

  // Register all commands
  context.subscriptions.push(
    wrapMultiLine,
    wrapSingleLine,
    wrapInlineMultiLine,
    wrapProductionOnly,
    wrapDevelopmentOnly,
    wrapTestOnly,
    wrapDebugBlock,
    markLine,
    removeMarkers,
    convertInline,
    configure,
    quickWrap
  );

  // Show activation message
  vscode.window.showInformationMessage('Code Removal Comments extension activated! Use Ctrl+Shift+R to access commands.');
}

export function deactivate() {
  console.log('Code Removal Comments extension deactivated');
}